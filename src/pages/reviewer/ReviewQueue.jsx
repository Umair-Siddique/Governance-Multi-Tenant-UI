import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ReviewerLayout from './ReviewerLayout';
import { formatDate, toneByStatus } from './reviewerData';
import { bulkApproveDocuments, getDocuments, bulkRejectDocuments, publishToPinecone, updateDocumentStatus } from '../../api/documents';
import { bulkRejectCsvRegistry, getCsvRegistry, updateCsvRegistryStatus } from '../../api/csvRegistry';
import { getTask } from '../../api/tasks';
import { getTenantProfile, normalizeTenantProfile } from '../../api/tenantSettings';
import { getUserRole } from '../../utils/authUtils';
import {
  extractPineconeId,
  extractTaskPairsFromPublishResponse,
  isTerminalTaskStatus,
  loadPineconeTrackingMap,
  normalizeTaskStatus,
  savePineconeTrackingEntry,
} from '../../utils/pineconeTasks';

function itemKey(item) {
  return `${item.source}:${item.id}`;
}

export default function ReviewQueue() {
  const [documents, setDocuments] = useState([]);
  const [csvItems, setCsvItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('review');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetKeys, setRejectTargetKeys] = useState([]);
  const [submittingReject, setSubmittingReject] = useState(false);
  const [pineconeByDocument, setPineconeByDocument] = useState({});
  const [tenantName, setTenantName] = useState('');
  const [tenantType, setTenantType] = useState('');
  const pollTimersRef = useRef({});

  useEffect(() => {
    async function loadTenantInfo() {
      try {
        const profile = await getTenantProfile();
        const normalized = normalizeTenantProfile(profile);
        if (!normalized) return;
        setTenantName(normalized.tenant_name || '');
        setTenantType(normalized.tenant_type || '');
      } catch {
        // Keep empty if unavailable
      }
    }
    loadTenantInfo();
  }, []);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const [docData, csvData] = await Promise.all([
        getDocuments(),
        getCsvRegistry().catch(() => []),
      ]);

      setDocuments(Array.isArray(docData) ? docData : docData.documents || []);
      setCsvItems(Array.isArray(csvData) ? csvData : csvData.files || csvData.items || csvData.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  useEffect(() => {
    const persisted = loadPineconeTrackingMap();
    setPineconeByDocument(persisted);

    Object.entries(persisted).forEach(([docId, entry]) => {
      if (!entry?.taskId) return;
      if (isTerminalTaskStatus(entry.status)) return;
      startTaskPolling(entry.taskId, docId);
    });

    return () => {
      Object.values(pollTimersRef.current).forEach((timerId) => clearTimeout(timerId));
      pollTimersRef.current = {};
    };
  }, []);

  function updatePineconeState(documentId, patch) {
    if (!documentId) return;
    setPineconeByDocument((prev) => {
      const next = {
        ...(prev[documentId] || {}),
        ...patch,
        documentId,
      };
      return {
        ...prev,
        [documentId]: next,
      };
    });
    savePineconeTrackingEntry(documentId, patch);
  }

  async function startTaskPolling(taskId, documentId) {
    if (!taskId || !documentId) return;

    if (pollTimersRef.current[documentId]) {
      clearTimeout(pollTimersRef.current[documentId]);
      delete pollTimersRef.current[documentId];
    }

    try {
      const task = await getTask(taskId);
      const status = normalizeTaskStatus(task);
      const pineconeId = extractPineconeId(task);

      updatePineconeState(documentId, {
        taskId,
        status,
        pineconeId,
        error: '',
      });

      if (isTerminalTaskStatus(status)) {
        return;
      }

      pollTimersRef.current[documentId] = setTimeout(() => {
        startTaskPolling(taskId, documentId);
      }, 30000);
    } catch (err) {
      updatePineconeState(documentId, {
        taskId,
        error: err?.message || 'Failed to fetch Pinecone task status',
      });

      pollTimersRef.current[documentId] = setTimeout(() => {
        startTaskPolling(taskId, documentId);
      }, 30000);
    }
  }

  const queueItems = useMemo(() => {
    const docRows = documents.map((doc) => ({
      source: 'document',
      id: doc.id || doc._id,
      title: doc.title || doc.filename || doc.fileName || 'Untitled',
      status: String(doc.status || '').toLowerCase(),
      createdAt: doc.created_at || doc.uploadedAt,
      raw: doc,
    }));

    const csvRows = csvItems.map((file) => ({
      source: 'csv',
      id: file.id || file._id || file.file_id || file.fileId,
      title: file.filename || file.file_name || file.fileName || 'Untitled CSV',
      status: String(file.status || '').toLowerCase(),
      createdAt: file.created_at || file.createdAt || file.uploadedAt,
      raw: file,
    }));

    return [...docRows, ...csvRows].filter((item) => {
      const scopeOk = scopeFilter === 'all' || scopeFilter === item.source;
      const statusOk = !statusFilter || item.status === statusFilter;
      return scopeOk && statusOk;
    });
  }, [documents, csvItems, scopeFilter, statusFilter]);

  const filteredItems = useMemo(() => {
    return queueItems.filter((item) => {
      const query = search.trim().toLowerCase();
      const title = item.title || '';
      const itemId = item.id || '';
      const matchSearch = !query || title.toLowerCase().includes(query) || String(itemId).toLowerCase().includes(query);
      return matchSearch;
    });
  }, [queueItems, search]);

  const selectableItems = useMemo(
    () => filteredItems.filter((item) => item.source === 'document' && item.id),
    [filteredItems]
  );

  const allVisibleSelected = selectableItems.length > 0 && selectableItems.every((item) => selectedKeys.includes(itemKey(item)));

  const selectedItems = useMemo(
    () => queueItems.filter((item) => selectedKeys.includes(itemKey(item))),
    [queueItems, selectedKeys]
  );

  function toggleOne(item) {
    if (item.source !== 'document') return;
    const key = itemKey(item);
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visibleKeySet = new Set(selectableItems.map((item) => itemKey(item)));
      setSelectedKeys((prev) => prev.filter((key) => !visibleKeySet.has(key)));
      return;
    }
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      selectableItems.forEach((item) => next.add(itemKey(item)));
      return Array.from(next);
    });
  }

  async function updateStatus(items, nextStatus, reasonText) {
    try {
      const documentIds = items.filter((item) => item.source === 'document').map((item) => item.id);
      const csvIds = items.filter((item) => item.source === 'csv').map((item) => item.id);

      if (nextStatus === 'APPROVED') {
        await Promise.all([
          ...documentIds.map((id) => updateDocumentStatus(id, 'approved')),
          ...csvIds.map((id) => updateCsvRegistryStatus(id, 'approved')),
        ]);

        const role = getUserRole();
        const canPublishToPinecone = role === 'admin' || role === 'editor';

        if (canPublishToPinecone && documentIds.length > 0) {
          const publishResult = await publishToPinecone(documentIds);
          const taskPairs = extractTaskPairsFromPublishResponse(publishResult, documentIds);

          taskPairs.forEach(({ documentId, taskId }) => {
            const docId = documentId || documentIds[0];
            if (!docId || !taskId) return;

            updatePineconeState(docId, {
              taskId,
              status: 'queued',
              pineconeId: '',
              error: '',
            });

            startTaskPolling(taskId, docId);
          });

          if (taskPairs.length === 0) {
            alert('Approved, but Pinecone task ID was not returned by API response.');
          }
        } else if (role === 'reviewer' && documentIds.length > 0) {
          // Reviewer role: backend does not permit Pinecone publish.
          // Document is approved; Pinecone sync will be triggered by admin/editor.
          documentIds.forEach((docId) => {
            updatePineconeState(docId, {
              status: 'pending-admin',
              pineconeId: '',
              error: '',
            });
          });
        }
      } else {
        const requests = [];
        if (documentIds.length > 0) requests.push(bulkRejectDocuments(documentIds, reasonText));
        if (csvIds.length > 0) requests.push(bulkRejectCsvRegistry(csvIds, reasonText));
        await Promise.all(requests);
      }
      setSelectedKeys([]);
      await fetchDocs();
      return true;
    } catch (err) {
      console.error(err);
      alert('Action failed: ' + err.message);
      return false;
    }
  }

  function handleApproveSingle(id, source) {
    updateStatus([{ id, source }], 'APPROVED');
  }

  function openRejectModal(items) {
    setRejectTargetKeys(items.map((item) => itemKey(item)));
    setRejectReason('');
    setRejectModalOpen(true);
  }

  function closeRejectModal() {
    if (submittingReject) return;
    setRejectModalOpen(false);
    setRejectTargetKeys([]);
    setRejectReason('');
  }

  function handleRejectSingle(id, source) {
    openRejectModal([{ id, source }]);
  }

  function handleBulkApprove() {
    const selectedDocuments = selectedItems.filter((item) => item.source === 'document');
    if (selectedDocuments.length === 0) return;

    (async () => {
      try {
        const documentIds = selectedDocuments.map((item) => item.id);
        await bulkApproveDocuments(documentIds);

        const role = getUserRole();
        const canPublishToPinecone = role === 'admin' || role === 'editor';

        if (canPublishToPinecone) {
          const publishResult = await publishToPinecone(documentIds);
          const taskPairs = extractTaskPairsFromPublishResponse(publishResult, documentIds);

          taskPairs.forEach(({ documentId, taskId }) => {
            const docId = documentId || documentIds[0];
            if (!docId || !taskId) return;

            updatePineconeState(docId, {
              taskId,
              status: 'queued',
              pineconeId: '',
              error: '',
            });

            startTaskPolling(taskId, docId);
          });

          if (taskPairs.length === 0) {
            alert('Approved, but Pinecone task ID was not returned by API response.');
          }
        } else if (role === 'reviewer') {
          // Reviewer role: backend does not permit Pinecone publish.
          // Document is approved; Pinecone sync will be triggered by admin/editor.
          documentIds.forEach((docId) => {
            updatePineconeState(docId, {
              status: 'pending-admin',
              pineconeId: '',
              error: '',
            });
          });
        }

        setSelectedKeys([]);
        await fetchDocs();
      } catch (err) {
        console.error(err);
        alert('Action failed: ' + err.message);
      }
    })();
  }

  function handleBulkReject() {
    const selectedDocuments = selectedItems.filter((item) => item.source === 'document');
    if (selectedDocuments.length === 0) return;
    openRejectModal(selectedDocuments);
  }

  async function submitReject() {
    if (rejectTargetKeys.length === 0 || !rejectReason.trim()) return;
    const targetItems = queueItems.filter((item) => rejectTargetKeys.includes(itemKey(item)));
    setSubmittingReject(true);
    const ok = await updateStatus(targetItems, 'REJECTED', rejectReason);
    setSubmittingReject(false);
    if (!ok) return;
    setRejectModalOpen(false);
    setRejectTargetKeys([]);
    setRejectReason('');
  }

  const displayTenantType = tenantType === 'self_managed'
    ? 'Self-managed'
    : tenantType === 'managed'
      ? 'Managed'
      : tenantType;

  const headerInfo = tenantName
    ? `${tenantName}${displayTenantType ? ` (${displayTenantType})` : ''}`
    : '';

  return (
    <ReviewerLayout title="Review Queue" headerInfo={headerInfo}>
      <div className="max-w-7xl mx-auto space-y-5">
        <section className="bg-background-surface border border-border-default rounded-lg p-4 sm:p-5 space-y-4">
          <h2 className="text-base font-semibold text-text-primary">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm"
            >
              <option value="all">All</option>
              <option value="document">Documents</option>
              <option value="csv">CSV</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm"
            >
              <option value="review">Review</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or id"
              className="px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm"
            />
          </div>
        </section>

        <section className="bg-background-surface border border-border-default rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border-default space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Queue Items</h2>
                <p className="text-xs text-text-muted mt-1">Bulk approve/reject supported for large imports.</p>
              </div>
              <div className="text-sm text-text-secondary">Selected: {selectedKeys.length}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBulkApprove}
                disabled={selectedItems.length === 0}
                className="px-3 py-2 rounded-md bg-success-500 text-text-inverse text-sm font-medium disabled:opacity-50"
              >
                Bulk Approve
              </button>
              <button
                type="button"
                onClick={handleBulkReject}
                disabled={selectedItems.length === 0}
                className="px-3 py-2 rounded-md bg-error-500 text-text-inverse text-sm font-medium disabled:opacity-50"
              >
                Bulk Reject
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-default">
              <thead className="bg-background-subtle">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Scope</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-background-surface divide-y divide-border-default">
                {loading && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-sm text-text-muted">Loading items...</td>
                  </tr>
                )}
                {error && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-sm text-red-500">{error}</td>
                  </tr>
                )}
                {!loading && !error && filteredItems.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-sm text-text-muted">No items for selected filters.</td>
                  </tr>
                )}
                {!loading && !error && filteredItems.map((item) => {
                  const itemId = item.id;
                  const title = item.title;
                  const isDocument = item.source === 'document';
                  const isApproved = String(item.status || '').toLowerCase() === 'approved';
                  return (
                  <tr key={`${item.source}:${itemId}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" disabled={!isDocument} checked={selectedKeys.includes(itemKey(item))} onChange={() => toggleOne(item)} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isDocument ? (
                        <Link
                          className="text-primary-500 hover:text-primary-600 font-medium"
                          to={`/reviewer/documents/${itemId}`}
                          state={{ from: '/reviewer/queue' }}
                        >
                          {title}
                        </Link>
                      ) : (
                        <span className="text-text-primary font-medium">{title}</span>
                      )}
                      <p className="text-xs text-text-muted mt-1">{itemId} · {formatDate(item.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{isDocument ? 'Documents' : 'CSV'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${toneByStatus(item.status)}`}>
                        {item.status}
                      </span>
                      {isDocument && isApproved && (
                        <>
                          <p className="text-xs text-text-muted mt-1">
                            Pinecone: {typeof pineconeByDocument[itemId]?.status === 'object' && pineconeByDocument[itemId]?.status !== null ? pineconeByDocument[itemId].status.stage || pineconeByDocument[itemId].status.status || JSON.stringify(pineconeByDocument[itemId].status) : pineconeByDocument[itemId]?.status || 'idle'}
                          </p>
                          <p className="text-xs text-text-muted mt-1 break-all">
                            Pinecone ID: {pineconeByDocument[itemId]?.pineconeId || 'N/A'}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right space-x-2">
                      <button type="button" onClick={() => handleApproveSingle(itemId, item.source)} className="text-success-500 font-medium">Approve</button>
                      <button type="button" onClick={() => handleRejectSingle(itemId, item.source)} className="text-error-500 font-medium">Reject</button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </section>

        {rejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reject-modal-title">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/60"
              aria-label="Close reject reason modal"
              onClick={closeRejectModal}
            />
            <div className="relative w-full max-w-md rounded-lg border border-border-default bg-background-surface p-5 shadow-xl space-y-4">
              <div>
                <h3 id="reject-modal-title" className="text-base font-semibold text-text-primary">Reject document</h3>
                <p className="text-sm text-text-muted mt-1">
                  Provide a rejection reason for {rejectTargetKeys.length} selected {rejectTargetKeys.length === 1 ? 'item' : 'items'}.
                </p>
              </div>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Type rejection reason"
                rows={4}
                className="w-full px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRejectModal}
                  disabled={submittingReject}
                  className="px-3 py-2 rounded-md border border-border-default text-text-primary text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitReject}
                  disabled={submittingReject || !rejectReason.trim()}
                  className="px-3 py-2 rounded-md bg-error-500 text-text-inverse text-sm font-medium disabled:opacity-50"
                >
                  {submittingReject ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ReviewerLayout>
  );
}
