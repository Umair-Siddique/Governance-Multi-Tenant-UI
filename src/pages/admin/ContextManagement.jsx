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

  const checkboxCls = 'h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0';
  const badgeCls = (s) => {
    const n = normalizeStatus(s);
    if (n === 'approved') return 'badge-approved';
    if (n === 'rejected' || n === 'processing_failed') return 'badge-rejected';
    if (n === 'review' || n === 'pending_processing') return 'badge-review';
    if (n === 'draft') return 'badge-draft';
    return 'badge-default';
  };

  return (
    <AdminLayout title="Context Management">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Status tabs */}
        <section className="bg-white border border-slate-100 rounded-2xl p-4" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  activeTab === tab.key ? 'tab-active' : 'tab-inactive'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Bulk actions toolbar */}
        <section className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <div className="flex flex-wrap gap-2.5 items-center">
            {activeTab !== 'approved' && (
              <>
                <button
                  type="button"
                  onClick={handleBulkApproveSelected}
                  disabled={isSubmitting || selectedRows.length === 0}
                  className="btn-success px-4 py-2 rounded-xl text-sm font-semibold"
                >
                  Approve selected
                </button>

                <input
                  type="text"
                  value={bulkRejectReason}
                  onChange={(e) => setBulkRejectReason(e.target.value)}
                  placeholder="Reject reason (required for bulk reject)"
                  className="admin-input min-w-[260px] flex-1"
                />

                <button
                  type="button"
                  onClick={handleBulkRejectSelected}
                  disabled={isSubmitting || selectedRows.length === 0 || !bulkRejectReason.trim()}
                  className="btn-danger px-4 py-2 rounded-xl text-sm font-semibold"
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
                className="btn-outline px-4 py-2 rounded-xl text-sm font-semibold"
              >
                Approve all drafts
              </button>
            )}

            {activeTab === 'approved' && (
              <button
                type="button"
                onClick={handlePublishToPineconeSelected}
                disabled={isSubmitting || selectedRows.filter((r) => r.source === 'document').length === 0}
                className="btn-primary-gradient px-4 py-2 rounded-xl text-sm font-semibold text-white"
              >
                Publish to Pinecone
              </button>
            )}
          </div>

          {/* Pinecone stats bar */}
          {activeTab === 'approved' && rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-5 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
              <span className="text-slate-500">Total: <span className="font-bold text-slate-800">{pineconeCounts.total}</span></span>
              <span className="text-slate-500">Processing: <span className="font-bold text-amber-600">{pineconeCounts.processing}</span></span>
              <span className="text-slate-500">Published: <span className="font-bold text-green-600">{pineconeCounts.done}</span></span>
              <span className="text-slate-500">Failed: <span className="font-bold text-red-600">{pineconeCounts.failed}</span></span>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              {error}
            </p>
          )}

          <p className="text-xs text-slate-400">
            {selectedRows.length} selected &nbsp;·&nbsp; Unified list includes CSV and PDF/DOCX records.
          </p>
        </section>

        {/* Main table */}
        <section className="bg-white border border-slate-100 rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="admin-table-head">
                  <th style={{ paddingLeft: '1rem' }}>
                    <input type="checkbox" className={checkboxCls} checked={allChecked} onChange={toggleSelectAll} />
                  </th>
                  <th>Filename</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created at</th>
                  <th>Chunks</th>
                  {showRejectionReasonColumn && <th>Rejection reason</th>}
                  {showPineconeColumn && <th>Pinecone</th>}
                  <th style={{ textAlign: 'right', paddingRight: '1rem' }}>{activeTab === 'approved' ? 'Detail' : 'Override'}</th>
                  <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Delete</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr><td colSpan={tableColSpan} className="px-4 py-10 text-center text-sm text-slate-400">Loading…</td></tr>
                )}
                {!loading && error && (
                  <tr><td colSpan={tableColSpan} className="px-4 py-10 text-center text-sm text-red-500">{error}</td></tr>
                )}
                {!loading && !error && rows.length === 0 && (
                  <tr><td colSpan={tableColSpan} className="px-4 py-10 text-center text-sm text-slate-400">No items in this state.</td></tr>
                )}

                {!loading && !error && rows.map((row) => {
                  const key = rowKey(row);
                  const selected = selectedKeys.includes(key);
                  const overrideStatus = getOverrideStatus(row);
                  const { status: pineconeStatus, pineconeId, error: pineconeError } = resolvePineconeStatus(row, pineconeByDocument);

                  return (
                    <tr key={key} className="admin-table-row cursor-pointer" onClick={() => openDetail(row)}>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className={checkboxCls} checked={selected} onChange={() => toggleSelectRow(row)} />
                      </td>

                      <td className="px-4 py-3 text-sm font-medium text-slate-900 max-w-[260px] truncate">{row.filename}</td>

                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {String(row.fileType || '-').toLowerCase()}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeCls(row.status)}`}>
                          {String(row.status || '-').replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{row.chunkCount ?? '-'}</td>

                      {showRejectionReasonColumn && (
                        <td className="px-4 py-3 text-sm text-slate-500 max-w-[180px] truncate">{row.rejectionReason || '-'}</td>
                      )}

                      {showPineconeColumn && (
                        <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                          {row.source === 'document' ? (
                            <>
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${pineconeTone(pineconeStatus)}`}>{pineconeStatus}</span>
                              {pineconeError && <p className="text-xs text-red-500 mt-1 max-w-xs truncate">⚠ {pineconeError}</p>}
                              {pineconeId && <p className="text-xs text-slate-400 mt-1 truncate">ID: {pineconeId}</p>}
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">n/a</span>
                          )}
                        </td>
                      )}

                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {activeTab === 'approved' && row.source === 'document' ? (
                          <button
                            type="button"
                            onClick={() => openDetail(row)}
                            className="btn-outline px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-200"
                          >
                            View Detail
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <select
                              value={overrideStatus}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setOverrideStatusByKey((prev) => ({ ...prev, [key]: e.target.value }))}
                              className="admin-select"
                            >
                              <option value="draft">draft</option>
                              <option value="review">review</option>
                              <option value="approved">approved</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleSingleStatusOverride(row)}
                              disabled={isSubmitting}
                              className="btn-primary-gradient px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {row.source === 'document' ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row)}
                            disabled={isSubmitting}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete document"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
                            </svg>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
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

      {/* Detail modal */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeDetail} aria-label="Close" />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base font-bold text-slate-900">{detailRow.filename}</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{detailRow.id}</p>
              </div>
              <button type="button" onClick={closeDetail} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {detailLoading && <p className="text-sm text-slate-400">Loading details…</p>}
              {!detailLoading && detailError && <p className="text-sm text-red-500">{detailError}</p>}

              {!detailLoading && !detailError && detailData && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Type', value: detailData.item?.file_type || detailData.item?.fileType || (detailRow.source === 'csv' ? 'csv' : '-') },
                      { label: 'Status', value: String(detailData.item?.status || '-') },
                      { label: 'Chunk count', value: detailData.item?.chunk_count ?? detailChunks.length ?? 0 },
                      { label: 'Created at', value: formatDate(detailData.item?.created_at || detailData.item?.createdAt) },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>

                  {detailRow.source === 'document' && (() => {
                    const resolved = resolvePineconeStatus(detailRow, pineconeByDocument);
                    return (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pinecone</p>
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${pineconeTone(resolved.status)}`}>{resolved.status}</span>
                        {resolved.pineconeId && <span className="text-xs text-slate-400 font-mono truncate">ID: {resolved.pineconeId}</span>}
                        {resolved.error && <span className="text-xs text-red-500 truncate">⚠ {resolved.error}</span>}
                      </div>
                    );
                  })()}

                  {String(detailData.item?.status || '').toLowerCase() !== 'approved' && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={approveInDetail} disabled={isSubmitting} className="btn-success px-4 py-2 rounded-xl text-sm font-semibold">Approve</button>
                      <input
                        type="text"
                        value={detailRejectReason}
                        onChange={(e) => setDetailRejectReason(e.target.value)}
                        placeholder="Reject reason (required)"
                        className="admin-input min-w-[220px] flex-1"
                      />
                      <button type="button" onClick={rejectInDetail} disabled={isSubmitting || !detailRejectReason.trim()} className="btn-danger px-4 py-2 rounded-xl text-sm font-semibold">Reject</button>
                    </div>
                  )}

                  <section className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                      <h4 className="text-sm font-semibold text-slate-700">Chunk preview</h4>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {detailChunks.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-slate-400 text-center">No chunks available.</div>
                      ) : (
                        detailChunks.map((chunk, index) => {
                          const text = chunk?.text || chunk?.content || chunk?.chunk_text || chunk?.value || '';
                          return (
                            <div key={chunk?.id || chunk?.chunk_id || index} className="px-4 py-3">
                              <p className="text-xs font-semibold text-slate-400 mb-1">Chunk {index + 1}</p>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{text || JSON.stringify(chunk)}</p>
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

      {/* Success toast */}
      {successMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSuccessMessage('')} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-100 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Success</h3>
                <p className="text-sm text-slate-500 mt-1">{successMessage}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setSuccessMessage('')} className="btn-primary-gradient px-5 py-2 rounded-xl text-sm font-semibold text-white">OK</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
