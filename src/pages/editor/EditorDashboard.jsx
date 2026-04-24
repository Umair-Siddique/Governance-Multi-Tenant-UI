import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EditorLayout from './EditorLayout';
import { bulkSubmitReview, getDocuments } from '../../api/documents';
import { getTenantProfile, normalizeTenantProfile } from '../../api/tenantSettings';

function normalizeStatus(value) {
  return String(value || '').toLowerCase();
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export default function EditorDashboard() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [movingToReview, setMovingToReview] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantType, setTenantType] = useState('');

  async function loadDocuments() {
    try {
      setLoading(true);
      setError('');
      const data = await getDocuments();
      const rows = Array.isArray(data) ? data : data.documents || [];
      setDocuments(rows);
    } catch (e) {
      setError(e.message || 'Failed to fetch documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    async function loadTenantInfo() {
      try {
        const profile = await getTenantProfile();
        const normalized = normalizeTenantProfile(profile);
        if (!normalized) return;
        setTenantName(normalized.tenant_name || '');
        setTenantType(normalized.tenant_type || '');
      } catch {
        // Keep header info empty if tenant profile is unavailable.
      }
    }

    loadTenantInfo();
  }, []);

  const draftDocuments = useMemo(
    () => documents.filter((doc) => normalizeStatus(doc.status) === 'draft'),
    [documents]
  );

  const draftCount = draftDocuments.length;
  const reviewCount = useMemo(
    () => documents.filter((doc) => normalizeStatus(doc.status) === 'review').length,
    [documents]
  );
  const approvedCount = useMemo(
    () => documents.filter((doc) => normalizeStatus(doc.status) === 'approved').length,
    [documents]
  );
  const rejectedCount = useMemo(
    () => documents.filter((doc) => normalizeStatus(doc.status) === 'rejected').length,
    [documents]
  );

  const allDraftSelected = draftDocuments.length > 0 && draftDocuments.every((doc) => {
    const id = doc.id || doc._id;
    return selectedIds.includes(id);
  });

  function toggleSelectAllDrafts() {
    if (allDraftSelected) {
      setSelectedIds([]);
      return;
    }

    const ids = draftDocuments.map((doc) => doc.id || doc._id).filter(Boolean);
    setSelectedIds(ids);
  }

  function toggleSelectOne(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function moveSelectedToReview() {
    if (selectedIds.length === 0) return;
    try {
      setMovingToReview(true);
      setError('');
      await bulkSubmitReview(selectedIds);
      setSelectedIds([]);
      await loadDocuments();
    } catch (e) {
      setError(e.message || 'Failed to move selected drafts to review');
    } finally {
      setMovingToReview(false);
    }
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
    <EditorLayout title="Editor Dashboard" headerInfo={headerInfo}>
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <article className="bg-background-surface border border-border-default rounded-lg p-5">
            <p className="text-xs text-text-muted uppercase tracking-wide">Draft</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{draftCount}</p>
          </article>
          <article className="bg-background-surface border border-border-default rounded-lg p-5">
            <p className="text-xs text-text-muted uppercase tracking-wide">Review</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{reviewCount}</p>
          </article>
          <article className="bg-background-surface border border-border-default rounded-lg p-5">
            <p className="text-xs text-text-muted uppercase tracking-wide">Approved</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{approvedCount}</p>
          </article>
          <article className="bg-background-surface border border-border-default rounded-lg p-5">
            <p className="text-xs text-text-muted uppercase tracking-wide">Rejected</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{rejectedCount}</p>
          </article>
        </section>

        <section className="bg-background-surface border border-border-default rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border-default flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">Draft Documents</h2>
            <button
              type="button"
              onClick={moveSelectedToReview}
              disabled={movingToReview || selectedIds.length === 0}
              className="px-3 py-1.5 rounded-md bg-primary-500 text-text-inverse text-xs font-medium hover:bg-primary-600 disabled:opacity-50"
            >
              {movingToReview ? 'Moving...' : 'Move selected to review'}
            </button>
          </div>

          {error && (
            <div className="mx-5 mt-4 p-3 bg-error-soft text-error-500 border border-error-500 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-default">
              <thead className="bg-background-subtle">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    <input type="checkbox" checked={allDraftSelected} onChange={toggleSelectAllDrafts} />
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Filename</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Uploaded By</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Created At</th>
                </tr>
              </thead>
              <tbody className="bg-background-surface divide-y divide-border-default">
                {loading && (
                  <tr>
                    <td colSpan="5" className="px-5 py-8 text-center text-sm text-text-muted">Loading draft documents...</td>
                  </tr>
                )}

                {!loading && draftDocuments.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-5 py-8 text-center text-sm text-text-muted">No draft documents found.</td>
                  </tr>
                )}

                {!loading && draftDocuments.map((doc) => {
                  const id = doc.id || doc._id;
                  const selected = selectedIds.includes(id);
                  return (
                    <tr key={id}>
                      <td className="px-5 py-3 text-sm">
                        <input type="checkbox" checked={selected} onChange={() => toggleSelectOne(id)} />
                      </td>
                      <td className="px-5 py-3 text-sm text-text-primary font-medium">{doc.filename || doc.title || doc.fileName || 'Untitled'}</td>
                      <td className="px-5 py-3 text-sm text-text-secondary">{String(doc.file_type || doc.fileType || '-').toLowerCase()}</td>
                      <td className="px-5 py-3 text-sm text-text-secondary">{doc.uploaded_by || doc.uploadedBy || '-'}</td>
                      <td className="px-5 py-3 text-sm text-text-secondary">{formatDate(doc.created_at || doc.createdAt || doc.uploadedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-background-surface border border-border-default rounded-lg p-5">
          <h2 className="text-base font-semibold text-text-primary">Quick Links</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/editor/upload" className="px-4 py-2 rounded-md bg-primary-500 text-text-inverse text-sm font-medium hover:bg-primary-600 transition-colors">
              Upload
            </Link>
            <Link to="/editor/library" className="px-4 py-2 rounded-md border border-border-default text-text-primary text-sm font-medium hover:bg-background-subtle transition-colors">
              CMS Library
            </Link>
          </div>
        </section>
      </div>
    </EditorLayout>
  );
}
