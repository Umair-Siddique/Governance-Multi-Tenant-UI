// ApprovedDocuments.jsx
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import ReviewerLayout from './ReviewerLayout';
import { formatDate, toneByStatus } from './reviewerData';
import { getDocuments, publishToPinecone } from '../../api/documents';
import { getTask } from '../../api/tasks';
import {
  extractPineconeId,
  extractTaskPairsFromPublishResponse,
  isTerminalTaskStatus,
  loadPineconeTrackingMap,
  normalizeTaskStatus,
  savePineconeTrackingEntry,
} from '../../utils/pineconeTasks';

// ── Pinecone status badge color
function pineconeTone(status) {
  const s = (status || 'idle').toLowerCase();
  if (['completed', 'succeeded', 'success'].includes(s))
    return 'bg-green-100 text-green-800';
  if (['failed', 'error'].includes(s))
    return 'bg-red-100 text-red-800';
  if (['queued', 'processing', 'pending'].includes(s))
    return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

function getApprovedAt(doc) {
  const approvedVersion = (doc.versions || []).find(
    (entry) => (entry.action || '').toLowerCase() === 'approved'
  );
  return (
    approvedVersion?.at ||
    doc.updated_at ||
    doc.updatedAt ||
    doc.created_at ||
    doc.uploadedAt ||
    null
  );
}

export default function ApprovedDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [pineconeByDocument, setPineconeByDocument] = useState({});
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const pollTimersRef = useRef({});

  // ── Fetch approved documents on mount
  useEffect(() => {
    async function fetchDocs() {
      try {
        setLoading(true);
        const data = await getDocuments();
        setDocuments(Array.isArray(data) ? data : data.documents || []);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDocs();
  }, []);

  // ── Patch pinecone state for a single document
  function updatePineconeState(documentId, patch) {
    if (!documentId) return;
    setPineconeByDocument((prev) => {
      const next = { ...(prev[documentId] || {}), ...patch, documentId };
      return { ...prev, [documentId]: next };
    });
    savePineconeTrackingEntry(documentId, patch);
  }

  // ── Poll a single task — stable reference via useCallback
  const startTaskPolling = useCallback((taskId, documentId) => {
    if (!taskId || !documentId) return;

    // Clear any existing timer for this document before starting fresh
    if (pollTimersRef.current[documentId]) {
      clearTimeout(pollTimersRef.current[documentId]);
      delete pollTimersRef.current[documentId];
    }

    async function poll() {
      try {
        const task = await getTask(taskId);
        const status = normalizeTaskStatus(task);
        const pineconeId = extractPineconeId(task);

        console.log(`[Pinecone] Poll — doc:${documentId} task:${taskId} status:${status}`);

        updatePineconeState(documentId, { taskId, status, pineconeId, error: '' });

        if (isTerminalTaskStatus(status)) return; // stop polling

        pollTimersRef.current[documentId] = setTimeout(poll, 30_000);
      } catch (err) {
        console.warn(`[Pinecone] Poll error — doc:${documentId}:`, err.message);
        updatePineconeState(documentId, {
          taskId,
          error: err?.message || 'Failed to fetch Pinecone task status',
        });
        // Retry even on network errors
        pollTimersRef.current[documentId] = setTimeout(poll, 30_000);
      }
    }

    poll();
  }, []);

  // ── Restore persisted Pinecone tracking on mount and resume polling
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

  // ── Derived: approved documents
  const approvedDocuments = useMemo(
    () => documents.filter((doc) => (doc.status || '').toLowerCase() === 'approved'),
    [documents]
  );

  // ── Derived: filtered by search
  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return approvedDocuments;
    return approvedDocuments.filter((doc) => {
      const title = doc.title || doc.filename || doc.fileName || '';
      const docId = doc.id || doc._id || '';
      const source = doc.upload_source || doc.uploadSource || '';
      return [title, docId, source].some((v) => v.toLowerCase().includes(query));
    });
  }, [approvedDocuments, search]);

  // ── Derived: Pinecone status counts
  const pineconeCounts = useMemo(() => {
    let processing = 0, done = 0, failed = 0;
    filteredDocuments.forEach((doc) => {
      const s = (pineconeByDocument[doc.id || doc._id]?.status || 'idle').toLowerCase();
      if (['queued', 'processing', 'pending'].includes(s)) processing++;
      else if (['completed', 'succeeded', 'success'].includes(s)) done++;
      else if (['failed', 'error'].includes(s)) failed++;
    });
    return { processing, done, failed };
  }, [filteredDocuments, pineconeByDocument]);

  // ── Selection helpers
  const allVisibleSelected =
    filteredDocuments.length > 0 &&
    filteredDocuments.every((doc) => selectedKeys.includes(doc.id || doc._id));

  function toggleOne(doc) {
    const key = doc.id || doc._id;
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visibleKeySet = new Set(filteredDocuments.map((doc) => doc.id || doc._id));
      setSelectedKeys((prev) => prev.filter((key) => !visibleKeySet.has(key)));
      return;
    }
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      filteredDocuments.forEach((doc) => next.add(doc.id || doc._id));
      return Array.from(next);
    });
  }

  // ── Publish selected documents to Pinecone
  async function handlePublishSelected() {
    if (selectedKeys.length === 0) return;
    try {
      setPublishing(true);
      const publishResult = await publishToPinecone(selectedKeys);

      console.log('[Pinecone] Publish response:', publishResult);

      const taskPairs = extractTaskPairsFromPublishResponse(publishResult, selectedKeys);

      console.log('[Pinecone] Extracted task pairs:', taskPairs);

      if (taskPairs.length === 0) {
        alert('Publish requested, but no Pinecone task ID was returned by the API.');
        return;
      }

      // Build a map of documentId → taskId from what the backend returned
      const docToTask = new Map(
        taskPairs
          .filter((p) => p.documentId && p.taskId)
          .map((p) => [p.documentId, p.taskId])
      );

      // FIX: Fall back to the batch task ID for any selected document
      // that the backend didn't return an explicit task pair for.
      // This handles the common case where the backend returns ONE
      // task_id for the entire batch instead of one per document.
      const batchTaskId = taskPairs[0]?.taskId;

      selectedKeys.forEach((docId) => {
        const taskId = docToTask.get(docId) || batchTaskId;
        if (!taskId) {
          console.warn('[Pinecone] No taskId found for doc:', docId);
          return;
        }
        console.log(`[Pinecone] Assigning task:${taskId} → doc:${docId}`);
        updatePineconeState(docId, {
          taskId,
          status: 'queued',
          pineconeId: '',
          error: '',
        });
        startTaskPolling(taskId, docId);
      });

      setSelectedKeys([]);
    } catch (err) {
      console.error('[Pinecone] Publish failed:', err);
      alert('Publish failed: ' + err.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <ReviewerLayout title="Approved Documents">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Stats cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <article className="bg-background-surface border border-border-default rounded-lg p-5">
            <p className="text-xs text-text-muted uppercase tracking-wide">Approved Library</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{approvedDocuments.length}</p>
            <p className="mt-2 text-sm text-text-muted">
              Documents approved and available for governed use.
            </p>
          </article>
          <article className="bg-background-surface border border-border-default rounded-lg p-5">
            <p className="text-xs text-text-muted uppercase tracking-wide">Search Scope</p>
            <p className="mt-2 text-sm text-text-primary">Title, document ID, and source</p>
            <p className="mt-2 text-sm text-text-muted">
              Use the list below to open an approved document and inspect its full review trail.
            </p>
          </article>
        </section>

        {/* ── Search */}
        <section className="bg-background-surface border border-border-default rounded-lg p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Find Approved Documents</h2>
            <p className="mt-1 text-sm text-text-muted">
              All documents shown here already passed reviewer approval.
            </p>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, id, or source"
            className="w-full px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm"
          />
        </section>

        {/* ── Documents table */}
        <section className="bg-background-surface border border-border-default rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border-default flex flex-col space-y-3">

            {/* Header row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Approved Documents</h2>
                <p className="text-xs text-text-muted mt-1">
                  Only documents with APPROVED status are listed here.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-text-secondary hidden sm:block">
                  Showing {filteredDocuments.length} of {approvedDocuments.length}
                </div>
                <div className="text-sm font-medium text-text-primary">
                  Selected: {selectedKeys.length}
                </div>
              </div>
            </div>

            {/* Pinecone publish toolbar */}
            {filteredDocuments.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-background-subtle p-3 rounded-md border border-border-default">
                <div className="flex space-x-4 text-sm w-full sm:w-auto">
                  <span className="text-text-secondary">
                    Total:{' '}
                    <span className="font-semibold text-text-primary">
                      {filteredDocuments.length}
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
                <button
                  type="button"
                  onClick={handlePublishSelected}
                  disabled={selectedKeys.length === 0 || publishing}
                  className="px-4 py-2 rounded-md bg-primary-500 text-text-inverse text-sm font-medium disabled:opacity-50 transition-colors hover:bg-primary-600"
                >
                  {publishing ? 'Publishing...' : 'Publish to Pinecone'}
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-default">
              <thead className="bg-background-subtle">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="rounded border-border-default text-primary-500 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Approved On
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    CMS Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Pinecone
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background-surface divide-y divide-border-default">

                {loading && (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-sm text-text-muted">
                      Loading approved documents...
                    </td>
                  </tr>
                )}

                {error && (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-sm text-red-500">
                      {error}
                    </td>
                  </tr>
                )}

                {!loading && !error && filteredDocuments.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-sm text-text-muted">
                      No approved documents found.
                    </td>
                  </tr>
                )}

                {!loading && !error && filteredDocuments.map((doc) => {
                  const docId = doc.id || doc._id;
                  const title = doc.title || doc.filename || doc.fileName || 'Untitled';
                  const source = doc.upload_source || doc.uploadSource || 'manual';
                  const pineconeEntry = pineconeByDocument[docId] || {};
                  const pineconeStatus = pineconeEntry.status || 'idle';

                  return (
                    <tr key={docId}>
                      <td className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedKeys.includes(docId)}
                          onChange={() => toggleOne(doc)}
                          className="rounded border-border-default text-primary-500 focus:ring-primary-500"
                        />
                      </td>

                      <td className="px-4 py-3 text-sm">
                        <Link
                          className="text-primary-500 hover:text-primary-600 font-medium"
                          to={`/reviewer/documents/${docId}`}
                          state={{ from: '/reviewer/approved' }}
                        >
                          {title}
                        </Link>
                        <p className="text-xs text-text-muted mt-1">{docId}</p>
                      </td>

                      <td className="px-4 py-3 text-sm text-text-secondary capitalize">
                        {String(source).replace(/_/g, ' ')}
                      </td>

                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {formatDate(getApprovedAt(doc))}
                      </td>

                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${toneByStatus(doc.status)}`}
                        >
                          {doc.status}
                        </span>
                      </td>

                      {/* Pinecone publish status */}
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${pineconeTone(pineconeStatus)}`}
                        >
                          {pineconeStatus}
                        </span>
                        {pineconeEntry.error && (
                          <p
                            className="text-xs text-error-500 mt-1 max-w-xs truncate"
                            title={pineconeEntry.error}
                          >
                            ⚠ {pineconeEntry.error}
                          </p>
                        )}
                        {pineconeEntry.pineconeId && (
                          <p
                            className="text-xs text-text-muted mt-1 truncate"
                            title={pineconeEntry.pineconeId}
                          >
                            ID: {pineconeEntry.pineconeId}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm text-right">
                        <Link
                          className="text-primary-500 hover:text-primary-600 font-medium"
                          to={`/reviewer/documents/${docId}`}
                          state={{ from: '/reviewer/approved' }}
                        >
                          View Detail
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </ReviewerLayout>
  );
}