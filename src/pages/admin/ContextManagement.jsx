// ContextManagement.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from './AdminLayout';
import {
  bulkApproveDocuments,
  bulkRejectDocuments,
  bulkSubmitReview,
  deleteDocument,
  getDocument,
  getDocuments,
  publishToPinecone,
  updateDocumentStatus,
} from '../../api/documents';
import {
  getCsvRegistry,
  getCsvRegistryItem,
  updateCsvRegistryStatus,
} from '../../api/csvRegistry';
import {
  extractPineconeId,
  extractTaskPairsFromPublishResponse,
  isTerminalTaskStatus,
  loadPineconeTrackingMap,
  normalizeTaskStatus,
  savePineconeTrackingEntry,
} from '../../utils/pineconeTasks';
import { getTask } from '../../api/tasks';

const STATUS_TABS = [
  { key: 'draft', label: 'Draft' },
  { key: 'review', label: 'Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'pending_processing', label: 'Pending processing' },
  { key: 'processing_failed', label: 'Processing failed' },
];

const OVERRIDE_STATUSES = ['draft', 'review', 'approved'];

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function normalizeStatus(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '_');
}

function statusTone(status) {
  const s = normalizeStatus(status);
  if (s === 'approved') return 'bg-success-soft text-success-500';
  if (s === 'rejected' || s === 'processing_failed') return 'bg-error-soft text-error-500';
  if (s === 'review' || s === 'pending_processing') return 'bg-warning-soft text-warning-500';
  return 'bg-background-subtle text-text-muted';
}

function pineconeTone(status) {
  const s = (status || 'idle').toLowerCase();
  if (['completed', 'succeeded', 'success'].includes(s)) return 'bg-green-100 text-green-800';
  if (['failed', 'error'].includes(s)) return 'bg-red-100 text-red-800';
  if (['queued', 'processing', 'pending'].includes(s)) return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

function rowKey(row) {
  return `${row.source}:${row.id}`;
}

function normalizeListResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.documents)) return data.documents;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.files)) return data.files;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeRow(item, source) {
  return {
    id: item.id || item._id || item.file_id || item.fileId,
    source,
    filename: item.filename || item.file_name || item.fileName || item.title || 'Untitled',
    fileType: item.file_type || item.fileType || (source === 'csv' ? 'csv' : 'unknown'),
    status: normalizeStatus(item.status),
    createdAt: item.created_at || item.createdAt || item.uploadedAt || null,
    chunkCount: item.chunk_count ?? item.chunkCount ?? (Array.isArray(item.chunks) ? item.chunks.length : 0),
    rejectionReason: item.rejection_reason || item.rejectionReason || '',
    // ── Read pinecone_status directly from backend document record
    // This enables cross-device visibility without localStorage
    pineconeStatus: normalizeStatus(
      item.pinecone_status || item.pineconeStatus || 'idle'
    ),
    pineconeId: item.pinecone_id || item.pineconeId || '',
    raw: item,
  };
}

function normalizeDetailResponse(data, source) {
  if (source === 'document') {
    const documentItem = data?.document || data;
    const chunks = data?.chunks || documentItem?.chunks || [];
    return { item: documentItem, chunks: Array.isArray(chunks) ? chunks : [] };
  }
  const csvItem = data?.file || data?.item || data?.csv || data;
  const chunks = data?.chunks || csvItem?.chunks || [];
  return { item: csvItem, chunks: Array.isArray(chunks) ? chunks : [] };
}

// ── Resolve the best available Pinecone status for a document
// Priority: in-memory tracking (from active task poll) > backend field > 'idle'
function resolvePineconeStatus(row, pineconeByDocument) {
  const tracked = pineconeByDocument[row.id];
  // If we have an actively tracked status that is non-idle, prefer it
  if (tracked?.status && tracked.status !== 'idle' && tracked.status !== 'unknown') {
    return { status: tracked.status, pineconeId: tracked.pineconeId || row.pineconeId || '', error: tracked.error || '' };
  }
  // Fall back to what the backend returned on the document record
  if (row.pineconeStatus && row.pineconeStatus !== 'idle') {
    return { status: row.pineconeStatus, pineconeId: row.pineconeId || '', error: '' };
  }
  return { status: tracked?.status || 'idle', pineconeId: tracked?.pineconeId || '', error: tracked?.error || '' };
}

export default function ContextManagement() {
  const [activeTab, setActiveTab] = useState('draft');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overrideStatusByKey, setOverrideStatusByKey] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  const [detailRow, setDetailRow] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailData, setDetailData] = useState(null);
  const [detailRejectReason, setDetailRejectReason] = useState('');

  const [pineconeByDocument, setPineconeByDocument] = useState({});
  const pollTimersRef = useRef({});

  function updatePineconeState(documentId, patch) {
    if (!documentId) return;
    setPineconeByDocument((prev) => {
      const next = { ...(prev[documentId] || {}), ...patch, documentId };
      return { ...prev, [documentId]: next };
    });
    savePineconeTrackingEntry(documentId, patch);
  }

  const startTaskPolling = useCallback((taskId, documentId) => {
    if (!taskId || !documentId) return;

    if (pollTimersRef.current[documentId]) {
      clearTimeout(pollTimersRef.current[documentId]);
      delete pollTimersRef.current[documentId];
    }

    async function poll() {
      try {
        const task = await getTask(taskId);
        const status = normalizeTaskStatus(task);
        const pineconeId = extractPineconeId(task);

        console.log(`[Pinecone/Admin] Poll — doc:${documentId} task:${taskId} status:${status}`);
        updatePineconeState(documentId, { taskId, status, pineconeId, error: '' });

        if (isTerminalTaskStatus(status)) return;
        pollTimersRef.current[documentId] = setTimeout(poll, 30_000);
      } catch (err) {
        console.warn(`[Pinecone/Admin] Poll error — doc:${documentId}:`, err.message);
        updatePineconeState(documentId, {
          taskId,
          error: err?.message || 'Failed to fetch Pinecone task status',
        });
        pollTimersRef.current[documentId] = setTimeout(poll, 30_000);
      }
    }

    poll();
  }, []);

  // ── Mount: restore persisted tracking + resume in-progress polls
  useEffect(() => {
    const persisted = loadPineconeTrackingMap();
    setPineconeByDocument(persisted);

    Object.entries(persisted).forEach(([docId, entry]) => {
      if (!entry?.taskId) return;
      if (isTerminalTaskStatus(entry.status)) return;
      startTaskPolling(entry.taskId, docId);
    });

    return () => {
      Object.values(pollTimersRef.current).forEach(clearTimeout);
      pollTimersRef.current = {};
    };
  }, [startTaskPolling]);

  // ── Refresh pinecone map when switching to Approved tab
  useEffect(() => {
    if (activeTab !== 'approved') return;
    const latest = loadPineconeTrackingMap();
    setPineconeByDocument(latest);
  }, [activeTab]);

  async function loadByStatus(statusKey) {
    try {
      setLoading(true);
      setError('');

      const [docsRes, csvRes] = await Promise.all([
        getDocuments({ status: statusKey }),
        getCsvRegistry({ status: statusKey }).catch(() => []),
      ]);

      const docRows = normalizeListResponse(docsRes).map((item) => normalizeRow(item, 'document'));
      const csvRows = normalizeListResponse(csvRes).map((item) => normalizeRow(item, 'csv'));
      const merged = [...docRows, ...csvRows];
      const filtered = merged.filter((r) => normalizeStatus(r.status) === statusKey);

      setRows(filtered);
      setSelectedKeys([]);
      setOverrideStatusByKey({});
    } catch (e) {
      setError(e.message || 'Failed to load lifecycle data.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadByStatus(activeTab); }, [activeTab]);

  // ── Selection helpers
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedKeys.includes(rowKey(r))),
    [rows, selectedKeys]
  );
  const allChecked = rows.length > 0 && rows.every((r) => selectedKeys.includes(rowKey(r)));

  function toggleSelectAll() {
    if (allChecked) { setSelectedKeys([]); return; }
    setSelectedKeys(rows.map((r) => rowKey(r)));
  }

  function toggleSelectRow(row) {
    const key = rowKey(row);
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function getOverrideStatus(row) {
    const key = rowKey(row);
    const current = normalizeStatus(row.status);
    if (overrideStatusByKey[key]) return overrideStatusByKey[key];
    if (OVERRIDE_STATUSES.includes(current)) return current;
    return 'review';
  }

  // ── Pinecone counts for the stats bar (approved tab only)
  const pineconeCounts = useMemo(() => {
    if (activeTab !== 'approved') return { total: 0, processing: 0, done: 0, failed: 0 };

    const docRows = rows.filter((r) => r.source === 'document');
    let processing = 0, done = 0, failed = 0;

    docRows.forEach((row) => {
      const { status } = resolvePineconeStatus(row, pineconeByDocument);
      const s = status.toLowerCase();
      if (['queued', 'processing', 'pending'].includes(s)) processing++;
      else if (['completed', 'succeeded', 'success'].includes(s)) done++;
      else if (['failed', 'error'].includes(s)) failed++;
    });

    return { total: docRows.length, processing, done, failed };
  }, [rows, pineconeByDocument, activeTab]);

  // ── Bulk actions
  async function handleBulkApproveSelected() {
    if (selectedRows.length === 0) return;
    try {
      setIsSubmitting(true);
      await bulkApproveDocuments(selectedRows.map((r) => r.id));
      await loadByStatus(activeTab);
    } catch (e) {
      setError(e.message || 'Bulk approve failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBulkRejectSelected() {
    if (selectedRows.length === 0 || !bulkRejectReason.trim()) return;
    try {
      setIsSubmitting(true);
      await bulkRejectDocuments(selectedRows.map((r) => r.id), bulkRejectReason.trim());
      setBulkRejectReason('');
      await loadByStatus(activeTab);
    } catch (e) {
      setError(e.message || 'Bulk reject failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApproveAllDrafts() {
    try {
      setIsSubmitting(true);
      await bulkApproveDocuments();
      await loadByStatus(activeTab);
    } catch (e) {
      setError(e.message || 'Approve all drafts failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePublishToPineconeSelected() {
    const documentRows = selectedRows.filter((r) => r.source === 'document');
    const documentIds = documentRows.map((r) => r.id);

    if (documentIds.length === 0) {
      alert('Please select at least one document (not CSV) to publish.');
      return;
    }

    try {
      setIsSubmitting(true);
      const publishResult = await publishToPinecone(documentIds);

      console.log('[Pinecone/Admin] Publish response:', publishResult);

      const taskPairs = extractTaskPairsFromPublishResponse(publishResult, documentIds);
      const batchTaskId = taskPairs[0]?.taskId;

      console.log('[Pinecone/Admin] Extracted task pairs:', taskPairs);

      if (!batchTaskId && taskPairs.length === 0) {
        alert('Publish requested, but no Pinecone task ID was returned by the API.');
        return;
      }

      const docToTask = new Map(
        taskPairs
          .filter((p) => p.documentId && p.taskId)
          .map((p) => [p.documentId, p.taskId])
      );

      documentIds.forEach((docId) => {
        const taskId = docToTask.get(docId) || batchTaskId;
        if (!taskId) { console.warn('[Pinecone/Admin] No taskId for doc:', docId); return; }
        updatePineconeState(docId, { taskId, status: 'queued', pineconeId: '', error: '' });
        startTaskPolling(taskId, docId);
      });

      setSuccessMessage(
        `Pinecone publish triggered for ${documentIds.length} document(s). Status will update automatically.`
      );
      setSelectedKeys([]);
      await loadByStatus(activeTab);
    } catch (e) {
      setError(e.message || 'Publish to Pinecone failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSingleStatusOverride(row) {
    const nextStatus = getOverrideStatus(row);
    try {
      setIsSubmitting(true);
      if (row.source === 'csv') {
        await updateCsvRegistryStatus(row.id, nextStatus);
      } else if (nextStatus === 'review') {
        await bulkSubmitReview([row.id]);
      } else {
        await updateDocumentStatus(row.id, nextStatus);
      }
      await loadByStatus(activeTab);
    } catch (e) {
      setError(e.message || 'Failed to update status.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openDetail(row) {
    setDetailRow(row);
    setDetailLoading(true);
    setDetailError('');
    setDetailData(null);
    setDetailRejectReason('');
    try {
      const res = row.source === 'csv'
        ? await getCsvRegistryItem(row.id)
        : await getDocument(row.id);
      setDetailData(normalizeDetailResponse(res, row.source));
    } catch (e) {
      setDetailError(e.message || 'Failed to load details.');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailRow(null);
    setDetailData(null);
    setDetailError('');
    setDetailRejectReason('');
  }

  async function approveInDetail() {
    if (!detailRow) return;
    try {
      setIsSubmitting(true);
      if (detailRow.source === 'csv') {
        await updateCsvRegistryStatus(detailRow.id, 'approved');
      } else {
        await updateDocumentStatus(detailRow.id, 'approved');
      }
      await loadByStatus(activeTab);
      await openDetail(detailRow);
    } catch (e) {
      setDetailError(e.message || 'Failed to approve item.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function rejectInDetail() {
    if (!detailRow || !detailRejectReason.trim()) return;
    try {
      setIsSubmitting(true);
      await bulkRejectDocuments([detailRow.id], detailRejectReason.trim());
      setDetailRejectReason('');
      await loadByStatus(activeTab);
      await openDetail(detailRow);
    } catch (e) {
      setDetailError(e.message || 'Failed to reject item.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteRow(row) {
    if (row.source !== 'document') return;
    const ok = window.confirm(`Delete ${row.filename}? This action cannot be undone.`);
    if (!ok) return;
    try {
      setIsSubmitting(true);
      await deleteDocument(row.id);
      await loadByStatus(activeTab);
    } catch (e) {
      setError(e.message || 'Failed to delete document.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const detailChunks = detailData?.chunks || [];
  const showRejectionReasonColumn = activeTab === 'rejected';
  const showPineconeColumn = activeTab === 'approved';

  // checkbox + filename + type + status + createdAt + chunkCount
  // + (rejectionReason?) + (pinecone?) + override/detail + delete
  const tableColSpan =
    6 +
    (showRejectionReasonColumn ? 1 : 0) +
    (showPineconeColumn ? 1 : 0) +
    2;

  return (
    <AdminLayout title="Context Management">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Status tabs */}
        <section className="bg-background-surface border border-border-default rounded-lg p-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key
                    ? 'bg-primary-500 text-text-inverse'
                    : 'bg-background-subtle text-text-secondary hover:text-text-primary'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Bulk actions toolbar */}
        <section className="bg-background-surface border border-border-default rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">

            {activeTab !== 'approved' && (
              <>
                <button
                  type="button"
                  onClick={handleBulkApproveSelected}
                  disabled={isSubmitting || selectedRows.length === 0}
                  className="px-3 py-2 rounded-md bg-success-500 text-text-inverse text-sm font-medium disabled:opacity-50"
                >
                  Approve selected
                </button>

                <input
                  type="text"
                  value={bulkRejectReason}
                  onChange={(e) => setBulkRejectReason(e.target.value)}
                  placeholder="Reject reason (required for bulk reject)"
                  className="min-w-[280px] flex-1 px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm"
                />

                <button
                  type="button"
                  onClick={handleBulkRejectSelected}
                  disabled={isSubmitting || selectedRows.length === 0 || !bulkRejectReason.trim()}
                  className="px-3 py-2 rounded-md bg-error-500 text-text-inverse text-sm font-medium disabled:opacity-50"
                >
                  Reject selected
                </button>
              </>
            )}

            {activeTab === 'draft' && (
              <button
                type="button"
                onClick={handleApproveAllDrafts}
                disabled={isSubmitting}
                className="px-3 py-2 rounded-md border border-border-default text-text-primary text-sm font-medium hover:bg-background-subtle disabled:opacity-50"
              >
                Approve all drafts
              </button>
            )}

            {activeTab === 'approved' && (
              <button
                type="button"
                onClick={handlePublishToPineconeSelected}
                disabled={
                  isSubmitting ||
                  selectedRows.filter((r) => r.source === 'document').length === 0
                }
                className="px-3 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                Publish to Pinecone
              </button>
            )}
          </div>

          {/* ── Pinecone stats bar — only shown on Approved tab */}
          {activeTab === 'approved' && rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 px-3 py-2.5 bg-background-subtle border border-border-default rounded-md text-sm">
              <span className="text-text-secondary">
                Total:{' '}
                <span className="font-semibold text-text-primary">
                  {pineconeCounts.total}
                </span>
              </span>
              <span className="text-text-secondary">
                Processing:{' '}
                <span className="font-semibold text-warning-500">
                  {pineconeCounts.processing}
                </span>
              </span>
              <span className="text-text-secondary">
                Published:{' '}
                <span className="font-semibold text-success-500">
                  {pineconeCounts.done}
                </span>
              </span>
              <span className="text-text-secondary">
                Failed:{' '}
                <span className="font-semibold text-error-500">
                  {pineconeCounts.failed}
                </span>
              </span>
            </div>
          )}

          {error && <p className="text-xs text-error-500">{error}</p>}

          <p className="text-xs text-text-muted">
            Selected: {selectedRows.length} | Unified list includes CSV and PDF/DOCX records.
          </p>
        </section>

        {/* ── Main table */}
        <section className="bg-background-surface border border-border-default rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-default">
              <thead className="bg-background-subtle">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    <input type="checkbox" checked={allChecked} onChange={toggleSelectAll} />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Filename</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Created at</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Chunk count</th>
                  {showRejectionReasonColumn && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Rejection reason</th>
                  )}
                  {showPineconeColumn && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Pinecone</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    {activeTab === 'approved' ? 'Detail' : 'Status override'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Delete</th>
                </tr>
              </thead>

              <tbody className="bg-background-surface divide-y divide-border-default">
                {loading && (
                  <tr>
                    <td colSpan={tableColSpan} className="px-4 py-8 text-center text-sm text-text-muted">
                      Loading lifecycle items...
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={tableColSpan} className="px-4 py-8 text-center text-sm text-error-500">
                      {error}
                    </td>
                  </tr>
                )}
                {!loading && !error && rows.length === 0 && (
                  <tr>
                    <td colSpan={tableColSpan} className="px-4 py-8 text-center text-sm text-text-muted">
                      No items in this lifecycle state.
                    </td>
                  </tr>
                )}

                {!loading && !error && rows.map((row) => {
                  const key = rowKey(row);
                  const selected = selectedKeys.includes(key);
                  const overrideStatus = getOverrideStatus(row);

                  // Resolve best available Pinecone status — backend field OR active poll
                  const { status: pineconeStatus, pineconeId, error: pineconeError } =
                    resolvePineconeStatus(row, pineconeByDocument);

                  return (
                    <tr
                      key={key}
                      className="hover:bg-background-subtle cursor-pointer"
                      onClick={() => openDetail(row)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelectRow(row)}
                        />
                      </td>

                      <td className="px-4 py-3 text-sm text-text-primary">{row.filename}</td>

                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {String(row.fileType || '-').toLowerCase()}
                      </td>

                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusTone(row.status)}`}>
                          {String(row.status || '-').replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{row.chunkCount ?? '-'}</td>

                      {showRejectionReasonColumn && (
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {row.rejectionReason || '-'}
                        </td>
                      )}

                      {showPineconeColumn && (
                        <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                          {row.source === 'document' ? (
                            <>
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${pineconeTone(pineconeStatus)}`}>
                                {pineconeStatus}
                              </span>
                              {pineconeError && (
                                <p className="text-xs text-error-500 mt-1 max-w-xs truncate" title={pineconeError}>
                                  ⚠ {pineconeError}
                                </p>
                              )}
                              {pineconeId && (
                                <p className="text-xs text-text-muted mt-1 truncate" title={pineconeId}>
                                  ID: {pineconeId}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-text-muted">n/a</span>
                          )}
                        </td>
                      )}

                      <td className="px-4 py-3 text-right text-sm" onClick={(e) => e.stopPropagation()}>
                        {activeTab === 'approved' && row.source === 'document' ? (
                          <button
                            type="button"
                            onClick={() => openDetail(row)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border-default text-xs text-primary-500 hover:bg-background-subtle font-medium"
                          >
                            View Detail
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <select
                              value={overrideStatus}
                              onChange={(e) =>
                                setOverrideStatusByKey((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              className="px-2 py-1 border border-border-default rounded-md bg-background-surface text-xs"
                            >
                              <option value="draft">draft</option>
                              <option value="review">review</option>
                              <option value="approved">approved</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleSingleStatusOverride(row)}
                              disabled={isSubmitting}
                              className="px-2 py-1 rounded-md border border-border-default text-text-primary text-xs hover:bg-background-subtle disabled:opacity-50"
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right text-sm" onClick={(e) => e.stopPropagation()}>
                        {row.source === 'document' ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row)}
                            disabled={isSubmitting}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-error-500 hover:bg-error-soft disabled:opacity-50"
                            title="Delete document"
                            aria-label="Delete document"
                          >
                            <svg
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        ) : (
                          <span className="text-xs text-text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── Detail panel modal */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60"
            onClick={closeDetail}
            aria-label="Close details"
          />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-background-surface border border-border-default rounded-lg shadow-xl">
            <div className="px-5 py-4 border-b border-border-default flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary">{detailRow.filename}</h3>
                <p className="text-xs text-text-muted mt-1">{detailRow.id}</p>
              </div>
              <button type="button" onClick={closeDetail} className="px-2 py-1 text-sm text-text-secondary hover:text-text-primary">
                Close
              </button>
            </div>

            <div className="p-5 space-y-4">
              {detailLoading && <p className="text-sm text-text-muted">Loading details...</p>}
              {!detailLoading && detailError && <p className="text-sm text-error-500">{detailError}</p>}

              {!detailLoading && !detailError && detailData && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div className="border border-border-default rounded-md p-3">
                      <p className="text-xs text-text-muted">Type</p>
                      <p className="mt-1 text-text-primary">
                        {detailData.item?.file_type || detailData.item?.fileType || (detailRow.source === 'csv' ? 'csv' : '-')}
                      </p>
                    </div>
                    <div className="border border-border-default rounded-md p-3">
                      <p className="text-xs text-text-muted">Status</p>
                      <p className="mt-1 text-text-primary">{String(detailData.item?.status || '-')}</p>
                    </div>
                    <div className="border border-border-default rounded-md p-3">
                      <p className="text-xs text-text-muted">Chunk count</p>
                      <p className="mt-1 text-text-primary">{detailData.item?.chunk_count ?? detailChunks.length ?? 0}</p>
                    </div>
                    <div className="border border-border-default rounded-md p-3">
                      <p className="text-xs text-text-muted">Created at</p>
                      <p className="mt-1 text-text-primary">
                        {formatDate(detailData.item?.created_at || detailData.item?.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Pinecone status in detail — uses resolvePineconeStatus for cross-device */}
                  {detailRow.source === 'document' && (() => {
                    const resolved = resolvePineconeStatus(detailRow, pineconeByDocument);
                    return (
                      <div className="border border-border-default rounded-md p-3 flex flex-wrap items-center gap-3">
                        <p className="text-xs text-text-muted shrink-0">Pinecone</p>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${pineconeTone(resolved.status)}`}>
                          {resolved.status}
                        </span>
                        {resolved.pineconeId && (
                          <span className="text-xs text-text-muted truncate">ID: {resolved.pineconeId}</span>
                        )}
                        {resolved.error && (
                          <span className="text-xs text-error-500 truncate">⚠ {resolved.error}</span>
                        )}
                      </div>
                    );
                  })()}

                  {String(detailData.item?.status || '').toLowerCase() !== 'approved' && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={approveInDetail}
                        disabled={isSubmitting}
                        className="px-3 py-2 rounded-md bg-success-500 text-text-inverse text-sm font-medium disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <input
                        type="text"
                        value={detailRejectReason}
                        onChange={(e) => setDetailRejectReason(e.target.value)}
                        placeholder="Reject reason"
                        className="min-w-[240px] flex-1 px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm"
                      />
                      <button
                        type="button"
                        onClick={rejectInDetail}
                        disabled={isSubmitting || !detailRejectReason.trim()}
                        className="px-3 py-2 rounded-md bg-error-500 text-text-inverse text-sm font-medium disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  <section className="border border-border-default rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-border-default bg-background-subtle">
                      <h4 className="text-sm font-semibold text-text-primary">Chunk preview</h4>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-border-default">
                      {detailChunks.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-text-muted">No chunks available.</div>
                      ) : (
                        detailChunks.map((chunk, index) => {
                          const text = chunk?.text || chunk?.content || chunk?.chunk_text || chunk?.value || '';
                          return (
                            <div key={chunk?.id || chunk?.chunk_id || index} className="px-4 py-3">
                              <p className="text-xs text-text-muted mb-1">Chunk {index + 1}</p>
                              <p className="text-sm text-text-primary whitespace-pre-wrap break-words">
                                {text || JSON.stringify(chunk)}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Success toast */}
      {successMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setSuccessMessage('')}
            aria-label="Close notification"
          />
          <div className="relative w-full max-w-sm rounded-lg border border-border-default bg-background-surface p-5 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-semibold text-success-500 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Success
              </h3>
              <p className="text-sm text-text-primary mt-2">{successMessage}</p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSuccessMessage('')}
                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
