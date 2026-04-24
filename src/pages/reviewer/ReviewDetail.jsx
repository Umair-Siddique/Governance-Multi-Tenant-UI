import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ReviewerLayout from './ReviewerLayout';
import { formatDate, toneByQuality, toneByStatus } from './reviewerData';
import { getDocument, bulkApproveDocuments, bulkRejectDocuments, publishToPinecone } from '../../api/documents';
import { getTask } from '../../api/tasks';
import { getTenantProfile, normalizeTenantProfile } from '../../api/tenantSettings';
import { getUserRole } from '../../utils/authUtils';
import {
  extractPineconeId,
  extractTaskPairsFromPublishResponse,
  getPineconeTrackingEntry,
  isTerminalTaskStatus,
  normalizeTaskStatus,
  savePineconeTrackingEntry,
} from '../../utils/pineconeTasks';

export default function ReviewDetail() {
  const { documentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [eventLog, setEventLog] = useState([]);
  const [expandedChunks, setExpandedChunks] = useState({});
  const [pineconeTask, setPineconeTask] = useState({
    taskId: '',
    status: 'idle',
    pineconeId: '',
    error: '',
  });
  const [tenantNameFromProfile, setTenantNameFromProfile] = useState('');
  const [tenantTypeFromProfile, setTenantTypeFromProfile] = useState('');
  const pollTimerRef = useRef(null);

  const fetchDoc = async () => {
    try {
      setLoading(true);
      const [data, tenantRes] = await Promise.all([
        getDocument(documentId),
        getTenantProfile().catch(() => null),
      ]);
      setDoc(data.document || data);
      setChunks(data.chunks || []);

      const normalizedTenant = normalizeTenantProfile(tenantRes);
      setTenantNameFromProfile(normalizedTenant?.tenant_name || '');
      setTenantTypeFromProfile(normalizedTenant?.tenant_type || '');

      const documentPayload = data.document || data;
      const apiTaskId =
        documentPayload?.pinecone_task_id ||
        documentPayload?.pineconeTaskId ||
        documentPayload?.pinecone?.task_id ||
        documentPayload?.pinecone?.taskId ||
        '';
      const rawApiStatus =
        documentPayload?.pinecone_sync_status ||
        documentPayload?.pineconeStatus ||
        documentPayload?.pinecone?.status ||
        '';

      const apiTaskStatus = typeof rawApiStatus === 'object' && rawApiStatus !== null
        ? rawApiStatus.stage || rawApiStatus.status || JSON.stringify(rawApiStatus)
        : rawApiStatus;

      const apiPineconeId =
        documentPayload?.pinecone_id ||
        documentPayload?.pineconeId ||
        documentPayload?.pinecone?.id ||
        '';
      const apiPineconeError =
        documentPayload?.pinecone_error ||
        documentPayload?.pineconeError ||
        documentPayload?.pinecone?.error ||
        '';

      setPineconeTask((prev) => ({
        taskId: apiTaskId || prev.taskId || '',
        status: apiTaskStatus || prev.status || 'idle',
        pineconeId: apiPineconeId || prev.pineconeId || '',
        error: apiPineconeError || prev.error || '',
      }));

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentId) fetchDoc();
  }, [documentId]);

  useEffect(() => {
    if (!documentId) return;

    const persisted = getPineconeTrackingEntry(documentId);
    if (!persisted) return;

    setPineconeTask((prev) => ({
      ...prev,
      taskId: persisted.taskId || '',
      status: persisted.status || 'idle',
      pineconeId: persisted.pineconeId || '',
      error: persisted.error || '',
    }));
  }, [documentId]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pineconeTask.taskId) return;
    if (isTerminalTaskStatus(pineconeTask.status)) return;

    pollPineconeTask(pineconeTask.taskId, documentId);
  }, [documentId, pineconeTask.taskId]);

  async function pollPineconeTask(taskId, trackedDocumentId = documentId) {
    if (!taskId || !trackedDocumentId) return;

    try {
      const task = await getTask(taskId);
      const status = normalizeTaskStatus(task);
      const pineconeId = extractPineconeId(task);

      setPineconeTask((prev) => ({
        ...prev,
        taskId,
        status,
        pineconeId: pineconeId || prev.pineconeId,
        error: '',
      }));

      savePineconeTrackingEntry(trackedDocumentId, {
        taskId,
        status,
        pineconeId: pineconeId || '',
        error: '',
      });

      if (isTerminalTaskStatus(status)) {
        if (status === 'completed' || status === 'succeeded' || status === 'success') {
          setEventLog((prev) => [
            ...prev,
            {
              at: new Date().toISOString(),
              action: 'pinecone-sync-completed',
              note: pineconeId ? `Pinecone sync completed. Pinecone ID: ${pineconeId}` : 'Pinecone sync completed.',
            },
          ]);
        }
        return;
      }

      pollTimerRef.current = setTimeout(() => {
        pollPineconeTask(taskId, trackedDocumentId);
      }, 30000);
    } catch (err) {
      const message = err?.message || 'Failed to fetch Pinecone task status';
      setPineconeTask((prev) => ({
        ...prev,
        taskId,
        error: message,
      }));

      savePineconeTrackingEntry(trackedDocumentId, {
        taskId,
        error: message,
      });

      pollTimerRef.current = setTimeout(() => {
        pollPineconeTask(taskId, trackedDocumentId);
      }, 30000);
    }
  }

  function toggleChunk(index) {
    setExpandedChunks((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  function expandAll() {
    const all = {};
    chunks.forEach((_, i) => { all[i] = true; });
    setExpandedChunks(all);
  }

  function collapseAll() {
    setExpandedChunks({});
  }

  async function approve() {
    try {
      await bulkApproveDocuments([documentId]);

      const role = getUserRole();
      const canPublishToPinecone = role === 'admin' || role === 'editor';
      let taskId = '';

      if (canPublishToPinecone) {
        const publishResult = await publishToPinecone([documentId]);
        const taskPairs = extractTaskPairsFromPublishResponse(publishResult, [documentId]);
        taskId = taskPairs[0]?.taskId || '';

        if (taskId) {
          setPineconeTask({ taskId, status: 'queued', pineconeId: '', error: '' });
          savePineconeTrackingEntry(documentId, {
            taskId,
            status: 'queued',
            pineconeId: '',
            error: '',
          });
          pollPineconeTask(taskId, documentId);
        }
      } else if (role === 'reviewer') {
        // Reviewer role: backend does not permit Pinecone publish.
        // Document is approved; Pinecone sync will be triggered by admin/editor.
        setPineconeTask({ taskId: '', status: 'pending-admin', pineconeId: '', error: '' });
        savePineconeTrackingEntry(documentId, {
          status: 'pending-admin',
          pineconeId: '',
          error: '',
        });
      }

      setEventLog((prev) => [
        ...prev,
        {
          at: new Date().toISOString(),
          action: 'approved',
          note: taskId
            ? `Approval recorded. Pinecone publish task started (Task ID: ${taskId}).`
            : 'Approval recorded.',
        },
      ]);
      fetchDoc();
    } catch (err) {
      alert(err.message);
    }
  }

  async function reject() {
    if (!rejectReason.trim()) return;
    try {
      await bulkRejectDocuments([documentId], rejectReason);
      setEventLog((prev) => [
        ...prev,
        {
          at: new Date().toISOString(),
          action: 'rejected',
          note: `Rejected: ${rejectReason.trim()}`,
        },
      ]);
      setRejectReason('');
      fetchDoc();
    } catch (err) {
      alert(err.message);
    }
  }

  const displayTenantType = tenantTypeFromProfile === 'self_managed'
    ? 'Self-managed'
    : tenantTypeFromProfile === 'managed'
      ? 'Managed'
      : tenantTypeFromProfile;

  const headerInfo = tenantNameFromProfile
    ? `${tenantNameFromProfile}${displayTenantType ? ` (${displayTenantType})` : ''}`
    : '';

  if (loading) return <ReviewerLayout title="Review Detail" headerInfo={headerInfo}><div className="p-5">Loading...</div></ReviewerLayout>;
  if (error) return <ReviewerLayout title="Review Detail" headerInfo={headerInfo}><div className="p-5 text-red-500">{error}</div></ReviewerLayout>;
  if (!doc) return <ReviewerLayout title="Review Detail" headerInfo={headerInfo}><div className="p-5">Document not found</div></ReviewerLayout>;

  const status = doc.status || 'UNKNOWN';
  const tenantName =
    tenantNameFromProfile ||
    doc.tenant_name ||
    doc.tenantName ||
    doc.tenant?.name ||
    doc.tenant?.tenant_name ||
    doc.tenant_id ||
    'N/A';
  const backRoute = location.state?.from || '/reviewer/queue';
  const canReview = ['draft', 'review', 'pending'].includes(status.toLowerCase());

  return (
    <ReviewerLayout title="Review Detail" headerInfo={headerInfo}>
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Document Header ── */}
        <section className="bg-background-surface border border-border-default rounded-lg p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(backRoute)} className="p-1.5 rounded-md hover:bg-background-subtle transition-colors" title="Back to List">
                <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{doc.filename || doc.title || 'Untitled'}</h2>
                <p className="text-xs text-text-muted mt-1">{doc.id || doc._id}</p>
              </div>
            </div>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${toneByStatus(status)}`}>
              {status}
            </span>
          </div>
        </section>

        {/* ── Metadata ── */}
        <section className="bg-background-surface border border-border-default rounded-lg p-5">
          <h3 className="text-base font-semibold text-text-primary">Metadata</h3>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="border border-border-default rounded-md p-3">
              <dt className="text-xs text-text-muted">File Type</dt>
              <dd className="mt-1 text-text-primary">{doc.file_type || doc.fileType || 'N/A'}</dd>
            </div>
            <div className="border border-border-default rounded-md p-3">
              <dt className="text-xs text-text-muted">Chunk Count</dt>
              <dd className="mt-1 text-text-primary">{doc.chunk_count ?? chunks.length ?? 'N/A'}</dd>
            </div>
            <div className="border border-border-default rounded-md p-3">
              <dt className="text-xs text-text-muted">Created At</dt>
              <dd className="mt-1 text-text-primary">{doc.created_at ? formatDate(doc.created_at) : 'N/A'}</dd>
            </div>
            <div className="border border-border-default rounded-md p-3">
              <dt className="text-xs text-text-muted">Updated At</dt>
              <dd className="mt-1 text-text-primary">{doc.updated_at ? formatDate(doc.updated_at) : 'N/A'}</dd>
            </div>
            <div className="border border-border-default rounded-md p-3">
              <dt className="text-xs text-text-muted">Tenant Name</dt>
              <dd className="mt-1 text-text-primary break-all">{tenantName}</dd>
            </div>
            <div className="border border-border-default rounded-md p-3">
              <dt className="text-xs text-text-muted">Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${toneByStatus(status)}`}>
                  {status}
                </span>
              </dd>
            </div>

            {/* Custom API Metadata */}
            {doc.metadata && Object.entries(doc.metadata).map(([key, value]) => (
              <div key={key} className="border border-border-default rounded-md p-3 bg-background-subtle">
                <dt className="text-xs text-text-muted capitalize">{key.replace(/_/g, ' ')}</dt>
                <dd className="mt-1 text-text-primary break-words">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── OCR Warnings (if available) ── */}
        {doc.ocr && (
          <section className="bg-background-surface border border-border-default rounded-lg p-5">
            <h3 className="text-base font-semibold text-text-primary">OCR Warnings</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="border border-border-default rounded-md p-3">
                <p className="text-xs text-text-muted">Quality</p>
                <p className="mt-1">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${toneByQuality(doc.ocr?.quality)}`}>
                    {doc.ocr?.quality || 'N/A'}
                  </span>
                </p>
              </div>
              <div className="border border-border-default rounded-md p-3">
                <p className="text-xs text-text-muted">Warnings</p>
                <p className="mt-1 text-text-primary">{doc.ocr?.flags?.length ? doc.ocr.flags.join(', ') : 'No warnings'}</p>
              </div>
            </div>
          </section>
        )}

        {/* ── Document Chunks ── */}
        <section className="bg-background-surface border border-border-default rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border-default flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                Document Content
                <span className="ml-2 text-xs font-normal text-text-muted">
                  ({chunks.length} chunk{chunks.length !== 1 ? 's' : ''})
                </span>
              </h3>
              <p className="text-xs text-text-muted mt-1">Review each chunk before approving.</p>
            </div>
            {chunks.length > 0 && (
              <div className="flex gap-2">
                <button type="button" onClick={expandAll} className="px-3 py-1.5 rounded-md border border-border-default text-xs font-medium text-text-primary hover:bg-background-subtle transition-colors">Expand All</button>
                <button type="button" onClick={collapseAll} className="px-3 py-1.5 rounded-md border border-border-default text-xs font-medium text-text-primary hover:bg-background-subtle transition-colors">Collapse All</button>
              </div>
            )}
          </div>

          <div className="divide-y divide-border-default">
            {chunks.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-text-muted">No content chunks available.</div>
            )}
            {chunks
              .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
              .map((chunk, idx) => {
                const isExpanded = !!expandedChunks[idx];
                return (
                  <div key={chunk.id || idx} className="px-5 py-3">
                    <button type="button" onClick={() => toggleChunk(idx)} className="w-full flex items-center justify-between text-left group">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-50 text-primary-600 text-xs font-semibold border border-primary-200">
                          {(chunk.chunk_index ?? idx) + 1}
                        </span>
                        <span className="text-sm font-medium text-text-primary group-hover:text-primary-500 transition-colors">
                          Chunk {(chunk.chunk_index ?? idx) + 1}
                        </span>
                        <span className="text-xs text-text-muted">{chunk.char_count || chunk.content?.length || 0} characters</span>
                      </div>
                      <svg className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="mt-3 ml-10 border border-border-default rounded-md p-4 bg-background-subtle max-h-64 overflow-auto">
                        <pre className="whitespace-pre-wrap text-sm text-text-secondary">{chunk.content || 'No content.'}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>

        {/* ── Audit Trail ── */}
        {((doc.versions || []).length > 0 || eventLog.length > 0) && (
          <section className="bg-background-surface border border-border-default rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border-default">
              <h3 className="text-base font-semibold text-text-primary">Versions and Audit Trail</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-default">
                <thead className="bg-background-subtle">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Version</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Actor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">At</th>
                  </tr>
                </thead>
                <tbody className="bg-background-surface divide-y divide-border-default">
                  {(doc.versions || []).map((entry) => (
                    <tr key={`${doc.id || doc._id}-${entry.version}`}>
                      <td className="px-4 py-3 text-sm text-text-primary">v{entry.version}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{entry.actor}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{entry.action}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(entry.at || entry.updatedAt)}</td>
                    </tr>
                  ))}
                  {eventLog.map((entry, idx) => (
                    <tr key={`event-${idx}`}>
                      <td className="px-4 py-3 text-sm text-text-primary">event</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">reviewer@tenant.com</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{entry.action} - {entry.note}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(entry.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Reviewer Actions ── */}
        {canReview && (
          <section className="bg-background-surface border border-border-default rounded-lg p-5 space-y-3">
            <h3 className="text-base font-semibold text-text-primary">Reviewer Actions</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={approve}
                className="px-4 py-2 rounded-md bg-success-500 text-text-inverse text-sm font-medium"
              >
                Approve
              </button>
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reject reason"
                className="px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm min-w-64"
              />
              <button
                type="button"
                onClick={reject}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 rounded-md bg-error-500 text-text-inverse text-sm font-medium disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => navigate(backRoute)}
                className="px-4 py-2 rounded-md border border-border-default text-sm font-medium text-text-primary"
              >
                Back to List
              </button>
            </div>
          </section>
        )}
      </div>
    </ReviewerLayout>
  );
}
