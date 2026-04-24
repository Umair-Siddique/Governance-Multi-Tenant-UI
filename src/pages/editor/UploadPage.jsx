import React, { useState } from 'react';
import EditorLayout from './EditorLayout';
import { statusTone } from './editorData';
import { uploadDocument } from '../../api/documents';
import { getTask } from '../../api/tasks';

function createUploadRecord(file) {
  return {
    id: `${file.name}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    fileName: file.name,
    sizeKb: Math.ceil(file.size / 1024),
    status: 'queued',
    cmsStatus: 'DRAFT',
  };
}

// ── Normalize any status string to lowercase trimmed
function normalizeStatus(val) {
  return (val || '').toString().toLowerCase().trim();
}

const DONE_STATUSES = ['completed', 'done', 'success', 'finished', 'complete'];
const FAILED_STATUSES = ['failed', 'error', 'cancelled', 'rejected'];
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_RETRIES = 60; // 2 minutes max

// Matches API: repeated multipart field name "file" (PDF, CSV, zip, single or mixed).
const UPLOAD_INPUT_ACCEPT =
  '.pdf,.csv,.zip,application/pdf,text/csv,application/zip,application/x-zip-compressed';

export default function UploadPage() {
  const [uploads, setUploads] = useState([]);

  // ── Helper: patch a single upload record by id
  function patchUpload(recordId, patch) {
    setUploads((prev) =>
      prev.map((u) => (u.id === recordId ? { ...u, ...patch } : u))
    );
  }

  function patchDoneFromDoc(recordId, uploadedDoc) {
    const docStatus = uploadedDoc?.status || 'DRAFT';
    const backendId = uploadedDoc?.id || uploadedDoc?._id || '';
    const metadata = uploadedDoc?.metadata || {};
    const pageCount = metadata.page_numbers || metadata.pages || uploadedDoc?.page_count || '';
    patchUpload(recordId, {
      status: 'done',
      cmsStatus: docStatus,
      backendId,
      pageCount,
    });
  }

  async function processUploadBatch(files, recordIds) {
    try {
      recordIds.forEach((id) => patchUpload(id, { status: 'processing' }));

      const formData = new FormData();
      files.forEach((file) => formData.append('file', file));

      let res;
      try {
        res = await uploadDocument(formData);
      } catch (uploadErr) {
        console.error('[Upload] uploadDocument() threw:', uploadErr.message);
        recordIds.forEach((id) =>
          patchUpload(id, { status: 'failed', errorMessage: uploadErr.message })
        );
        return;
      }

      console.log('[Upload] Raw upload response:', res);

      if (res.errors && res.errors.length > 0) {
        console.error('[Upload] Backend reported errors:', res.errors);
        if (res.errors.length === recordIds.length) {
          res.errors.forEach((err, i) => {
            const msg = err?.error || err?.message || 'Upload failed on server';
            patchUpload(recordIds[i], { status: 'failed', errorMessage: msg });
          });
          return;
        }
        const firstError = res.errors[0]?.error || res.errors[0]?.message || 'Upload failed on server';
        recordIds.forEach((id) =>
          patchUpload(id, { status: 'failed', errorMessage: firstError })
        );
        return;
      }

      const taskId =
        res.batch_task_id ||
        res.task_id ||
        res.taskId ||
        null;

      console.log('[Upload] Task ID:', taskId);

      if (!taskId) {
        console.warn('[Upload] No task ID returned — treating as synchronous upload.');
        const uploadedList = Array.isArray(res.uploaded)
          ? res.uploaded
          : res.document
            ? [res.document]
            : [];

        if (uploadedList.length >= recordIds.length) {
          recordIds.forEach((id, i) => patchDoneFromDoc(id, uploadedList[i] || {}));
        } else if (uploadedList.length === 1 && recordIds.length === 1) {
          patchDoneFromDoc(recordIds[0], uploadedList[0]);
        } else {
          const doc = uploadedList[0] || {};
          recordIds.forEach((id) => patchDoneFromDoc(id, doc));
        }
        return;
      }

      let isDone = false;
      let retriesLeft = MAX_POLL_RETRIES;
      let finalDoc = res.uploaded?.[0] || res.document || {};
      let consecutiveNetworkErrors = 0;

      while (!isDone && retriesLeft > 0) {
        retriesLeft--;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        try {
          const taskRes = await getTask(taskId);
          consecutiveNetworkErrors = 0;

          console.log('[Upload] Poll response:', taskRes);

          const tStatus = normalizeStatus(
            taskRes.status ||
              taskRes.data?.status ||
              taskRes.task?.status ||
              ''
          );

          console.log(`[Upload] Normalized task status: "${tStatus}", retries left: ${retriesLeft}`);

          if (DONE_STATUSES.includes(tStatus)) {
            isDone = true;
            const batchDocs =
              taskRes.result?.documents ||
              taskRes.documents ||
              taskRes.result?.uploaded ||
              null;
            if (Array.isArray(batchDocs) && batchDocs.length >= recordIds.length) {
              recordIds.forEach((id, i) => {
                patchDoneFromDoc(id, batchDocs[i] || {});
              });
              return;
            }
            finalDoc =
              taskRes.result?.document ||
              taskRes.document ||
              taskRes.data?.document ||
              taskRes.task?.document ||
              finalDoc;
          } else if (FAILED_STATUSES.includes(tStatus)) {
            const reason =
              taskRes.error ||
              taskRes.message ||
              taskRes.data?.error ||
              taskRes.data?.message ||
              'Processing task failed on server';
            throw new Error(reason);
          } else {
            console.log(`[Upload] Task still running (status: "${tStatus}") — polling again…`);
          }
        } catch (pollErr) {
          if (
            FAILED_STATUSES.some((s) => pollErr.message?.toLowerCase().includes(s)) ||
            pollErr.message?.includes('Processing task failed')
          ) {
            throw pollErr;
          }

          consecutiveNetworkErrors++;
          console.warn(
            `[Upload] Poll network error (${consecutiveNetworkErrors}/5):`,
            pollErr.message
          );
          if (consecutiveNetworkErrors >= 5) {
            throw new Error(`Task polling failed 5 times in a row: ${pollErr.message}`);
          }
        }
      }

      if (!isDone) {
        throw new Error('Upload processing timed out after 2 minutes. Please refresh and check document status.');
      }

      const docStatus = finalDoc?.status || 'DRAFT';
      const backendId = finalDoc?.id || finalDoc?._id || '';
      const metadata = finalDoc?.metadata || {};
      const pageCount = metadata.page_numbers || metadata.pages || finalDoc?.page_count || '';

      console.log('[Upload] Completed. Final doc:', finalDoc);

      recordIds.forEach((id) => {
        patchUpload(id, {
          status: 'done',
          cmsStatus: docStatus,
          backendId,
          pageCount,
        });
      });
    } catch (error) {
      console.error('[Upload] Batch error:', error.message);
      recordIds.forEach((id) =>
        patchUpload(id, { status: 'failed', errorMessage: error.message })
      );
    }
  }

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const created = files.map((file) => createUploadRecord(file));
    setUploads((prev) => [...created, ...prev]);

    processUploadBatch(files, created.map((c) => c.id));

    event.target.value = '';
  }

  // ── Derived counts
  const counts = {
    total: uploads.length,
    processing: uploads.filter((u) => u.status === 'queued' || u.status === 'processing').length,
    done: uploads.filter((u) => u.status === 'done').length,
    failed: uploads.filter((u) => u.status === 'failed').length,
  };

  return (
    <EditorLayout title="Upload">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Upload trigger ── */}
        <section className="bg-background-surface border border-border-default rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-text-primary">Manual / Bulk Upload</h2>
          <p className="text-sm text-text-secondary">
            Select one or many files in a single request: PDF, CSV, or ZIP archives (or a mix). Processing
            runs in the background.
          </p>
          <div>
            <label className="inline-flex items-center px-4 py-2 rounded-md bg-primary-500 text-text-inverse text-sm font-medium hover:bg-primary-600 cursor-pointer transition-colors">
              Choose Files
              <input
                className="hidden"
                type="file"
                multiple
                accept={UPLOAD_INPUT_ACCEPT}
                onChange={handleFilesSelected}
              />
            </label>
          </div>
        </section>

        {/* ── Processing queue ── */}
        <section className="bg-background-surface border border-border-default rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border-default flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">Processing Queue</h2>

            {counts.total > 0 && (
              <div className="flex space-x-4 text-sm">
                <span className="text-text-secondary">
                  Total: <span className="font-semibold text-text-primary">{counts.total}</span>
                </span>
                <span className="text-text-secondary">
                  Processing: <span className="font-semibold text-warning-500">{counts.processing}</span>
                </span>
                <span className="text-text-secondary">
                  Done: <span className="font-semibold text-success-500">{counts.done}</span>
                </span>
                <span className="text-text-secondary">
                  Failed: <span className="font-semibold text-error-500">{counts.failed}</span>
                </span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-default">
              <thead className="bg-background-subtle">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">File</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">CMS Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Processing</th>
                </tr>
              </thead>
              <tbody className="bg-background-surface divide-y divide-border-default">
                {counts.total === 0 && (
                  <tr>
                    <td colSpan="3" className="px-4 py-8 text-center text-sm text-text-muted">
                      No uploads yet.
                    </td>
                  </tr>
                )}
                {uploads.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 text-sm text-text-primary">
                      <p className="font-medium">{u.fileName}</p>
                      <p className="text-xs text-text-muted mt-0.5 flex flex-wrap gap-x-2">
                        <span>{u.sizeKb} KB</span>
                        {u.backendId && (
                          <span className="border-l border-border-default pl-2">ID: {u.backendId}</span>
                        )}
                        {u.pageCount && (
                          <span className="border-l border-border-default pl-2">Pages: {u.pageCount}</span>
                        )}
                      </p>
                      {/* Show error message inline when failed */}
                      {u.status === 'failed' && u.errorMessage && (
                        <p className="text-xs text-error-500 mt-1 max-w-xs truncate" title={u.errorMessage}>
                          ⚠ {u.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusTone(u.cmsStatus)}`}>
                        {u.cmsStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusTone(u.status)}`}>
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </EditorLayout>
  );
}