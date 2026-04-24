import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import EditorLayout from './EditorLayout';
import { EDITOR_STATUSES, formatDate, statusTone } from './editorData';
import { deleteDocument, getDocuments } from '../../api/documents';

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export default function CMSLibrary() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingIds, setDeletingIds] = useState([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    async function fetchDocs() {
      try {
        const data = await getDocuments();
        setDocuments(Array.isArray(data) ? data : data.documents || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDocs();
  }, []);

  const allFileTypes = useMemo(() => {
    const typeMap = new Map();
    documents.forEach((doc) => {
      const raw = doc.file_type || doc.fileType;
      const normalized = normalizeText(raw);
      if (!normalized) return;
      if (!typeMap.has(normalized)) {
        typeMap.set(normalized, raw);
      }
    });
    return Array.from(typeMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, label]) => ({ value, label }));
  }, [documents]);

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      const query = normalizeText(search);
      const title = doc.title || doc.filename || doc.fileName || '';
      const docId = doc.id || doc._id || '';
      const statusValue = normalizeText(doc.status);
      const fileTypeValue = normalizeText(doc.file_type || doc.fileType);
      const matchSearch =
        !query ||
        normalizeText(title).includes(query) ||
        normalizeText(docId).includes(query);
      const matchStatus = statusFilter === 'all' || statusValue === normalizeText(statusFilter);
      const matchFileType = !fileTypeFilter || fileTypeValue === normalizeText(fileTypeFilter);

      const uploadedDate = new Date(doc.created_at || doc.uploadedAt);
      const hasValidDate = !Number.isNaN(uploadedDate.getTime());
      const matchFromDate = !fromDate || (hasValidDate && uploadedDate >= new Date(fromDate));
      const matchToDate = !toDate || (hasValidDate && uploadedDate <= new Date(`${toDate}T23:59:59`));

      return (
        matchSearch &&
        matchStatus &&
        matchFileType &&
        matchFromDate &&
        matchToDate
      );
    });
  }, [documents, search, statusFilter, fileTypeFilter, fromDate, toDate]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((doc) => selectedIds.includes(doc.id));

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filtered.some((doc) => doc.id === id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((doc) => next.add(doc.id));
      return Array.from(next);
    });
  }

  function toggleOne(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function openDeleteModal(docId, title) {
    if (!docId) return;
    setDeleteTarget({ id: docId, title });
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    if (deleteTarget && deletingIds.includes(deleteTarget.id)) return;
    setDeleteModalOpen(false);
    setDeleteTarget(null);
  }

  async function handleDeleteDocument() {
    const docId = deleteTarget?.id;
    const title = deleteTarget?.title;
    if (!docId) return;

    try {
      setDeletingIds((prev) => [...prev, docId]);
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((doc) => (doc.id || doc._id) !== docId));
      setSelectedIds((prev) => prev.filter((id) => id !== docId));
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== docId));
    }
  }

  return (
    <EditorLayout title="CMS Library">
      <div className="max-w-7xl mx-auto space-y-5">
        <section className="bg-background-surface border border-border-default rounded-lg p-4 sm:p-5 space-y-4">
          <h2 className="text-base font-semibold text-text-primary">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or id"
              className="px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm"
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm">
              <option value="all">All status</option>
              {EDITOR_STATUSES.map((status) => <option key={status} value={normalizeText(status)}>{status}</option>)}
            </select>
            <select value={fileTypeFilter} onChange={(e) => setFileTypeFilter(e.target.value)} className="px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm">
              <option value="">All file types</option>
              {allFileTypes.map((ft) => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
            </select>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm" />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm" />
          </div>
        </section>

        <section className="bg-background-surface border border-border-default rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border-default">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Documents</h2>
              <p className="text-xs text-text-muted mt-1">Bulk selection enabled. Selected: {selectedIds.length}</p>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">File Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-muted uppercase tracking-wider">Delete</th>
                </tr>
              </thead>
              <tbody className="bg-background-surface divide-y divide-border-default">
                {loading && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-sm text-text-muted">
                      Loading documents...
                    </td>
                  </tr>
                )}
                {error && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-sm text-red-500">
                      {error}
                    </td>
                  </tr>
                )}
                {!loading && !error && filtered.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-sm text-text-muted">
                      No documents found with current filters.
                    </td>
                  </tr>
                )}
                {!loading && !error && filtered.map((doc) => {
                  const docId = doc.id || doc._id;
                  const title = doc.title || doc.filename || doc.fileName || 'Untitled';
                  return (
                  <tr key={docId} className="hover:bg-background-subtle">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(docId)}
                        onChange={() => toggleOne(docId)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link className="text-primary-500 hover:text-primary-600 font-medium" to={`/editor/documents/${docId}`}>
                        {title}
                      </Link>
                      <p className="text-xs text-text-muted font-mono mt-1">{docId}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusTone(doc.status)}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{doc.file_type || doc.fileType || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {formatDate(doc.created_at || doc.uploadedAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => openDeleteModal(docId, title)}
                        disabled={deletingIds.includes(docId)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-error-500 hover:bg-error-50 disabled:opacity-50"
                        title="Delete document"
                        aria-label="Delete document"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </section>

        {deleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/60"
              onClick={closeDeleteModal}
              aria-label="Close delete modal"
            />
            <div className="relative w-full max-w-md rounded-lg border border-border-default bg-background-surface p-5 shadow-xl space-y-4">
              <div>
                <h3 id="delete-modal-title" className="text-base font-semibold text-text-primary">Delete document</h3>
                <p className="text-sm text-text-muted mt-1">Are you sure you want to delete "{deleteTarget?.title || 'this document'}"?</p>
                <p className="text-xs text-error-500 mt-1">This action cannot be undone.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={deleteTarget && deletingIds.includes(deleteTarget.id)}
                  className="px-3 py-2 rounded-md border border-border-default text-text-primary text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDocument}
                  disabled={!deleteTarget || deletingIds.includes(deleteTarget.id)}
                  className="px-3 py-2 rounded-md bg-error-500 text-text-inverse text-sm font-medium disabled:opacity-50"
                >
                  {deleteTarget && deletingIds.includes(deleteTarget.id) ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EditorLayout>
  );
}
