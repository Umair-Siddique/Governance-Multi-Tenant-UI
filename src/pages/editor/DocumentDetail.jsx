import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import EditorLayout from './EditorLayout';
import { formatDate, statusTone } from './editorData';
import { getDocument } from '../../api/documents';
import { getTenantProfile, normalizeTenantProfile } from '../../api/tenantSettings';
import { getCsvRegistryItem, updateCsvRegistryMetadata } from '../../api/csvRegistry';

export default function DocumentDetail() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [doc, setDoc] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedChunks, setExpandedChunks] = useState({});
  const [tenantNameFromProfile, setTenantNameFromProfile] = useState('');
  const [csvFilename, setCsvFilename] = useState('');
  const [csvSummary, setCsvSummary] = useState('');
  const [savingCsv, setSavingCsv] = useState(false);
  const [csvMessage, setCsvMessage] = useState('');

  useEffect(() => {
    async function fetchDoc() {
      try {
        const source = new URLSearchParams(location.search).get('source');
        const isCsvSource = source === 'csv';

        const [documentRes, tenantRes] = await Promise.all([
          isCsvSource ? getCsvRegistryItem(documentId) : getDocument(documentId),
          getTenantProfile().catch(() => null),
        ]);

        const rawDoc = isCsvSource
          ? (documentRes.file || documentRes.item || documentRes.csv || documentRes)
          : (documentRes.document || documentRes);
        const rawChunks = isCsvSource
          ? (documentRes.chunks || rawDoc?.chunks || [])
          : (documentRes.chunks || []);

        setDoc(rawDoc);
        setChunks(rawChunks);
        setCsvFilename(rawDoc?.filename || rawDoc?.file_name || rawDoc?.fileName || '');
        setCsvSummary(rawDoc?.summary || '');

        const normalizedTenant = normalizeTenantProfile(tenantRes);
        const fetchedTenantName = normalizedTenant?.tenant_name || tenantRes?.tenant?.tenant_name || tenantRes?.tenant_name || '';
        setTenantNameFromProfile(fetchedTenantName);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (documentId) {
       fetchDoc();
    }
  }, [documentId, location.search]);

  async function handleSaveCsvMetadata() {
    if (!doc) return;
    const fileId = doc.id || doc._id || doc.file_id || doc.fileId;
    if (!fileId) {
      setCsvMessage('CSV file id is missing.');
      return;
    }

    try {
      setSavingCsv(true);
      setCsvMessage('');
      await updateCsvRegistryMetadata(fileId, {
        filename: csvFilename,
        summary: csvSummary,
      });
      setDoc((prev) => ({ ...(prev || {}), filename: csvFilename, summary: csvSummary }));
      setCsvMessage('CSV metadata saved successfully.');
    } catch (err) {
      setCsvMessage(err.message || 'Failed to update CSV metadata.');
    } finally {
      setSavingCsv(false);
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

  if (loading) return <EditorLayout title="Document Detail"><div className="p-5">Loading...</div></EditorLayout>;
  if (error) return <EditorLayout title="Document Detail"><div className="p-5 text-red-500">{error}</div></EditorLayout>;
  if (!doc) return <EditorLayout title="Document Detail"><div className="p-5">Document not found</div></EditorLayout>;

  const normalizedStatus = String(doc.status || '').toLowerCase();
  const isRejected = normalizedStatus === 'rejected';
  const isCsvFile = String(doc.file_type || doc.fileType || '').toLowerCase() === 'csv';
  const tenantName =
    tenantNameFromProfile ||
    doc.tenant_name ||
    doc.tenantName ||
    doc.tenant?.name ||
    doc.tenant?.tenant_name ||
    'N/A';

  return (
    <EditorLayout title="Document Detail">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Document Header ── */}
        <section className="bg-background-surface border border-border-default rounded-lg p-5">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/editor/library')} className="p-1.5 rounded-md hover:bg-background-subtle transition-colors" title="Back to Library">
                <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{doc.filename || doc.title || 'Untitled'}</h2>
                <p className="text-xs text-text-muted font-mono mt-1">{doc.id || doc._id}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusTone(doc.status)}`}>
                {doc.status}
              </span>
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-background-subtle text-text-muted">
                Editor cannot approve here
              </span>
            </div>
          </div>
        </section>

        {/* ── Metadata Grid ── */}
        <section className="bg-background-surface border border-border-default rounded-lg p-5">
          <h3 className="text-base font-semibold text-text-primary">Document Metadata</h3>
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
              <dt className="text-xs text-text-muted">Uploaded By</dt>
              <dd className="mt-1 text-text-primary font-mono text-xs break-all">{doc.uploaded_by || doc.uploadedBy || 'N/A'}</dd>
            </div>
            <div className="border border-border-default rounded-md p-3">
              <dt className="text-xs text-text-muted">Created At</dt>
              <dd className="mt-1 text-text-primary">{doc.created_at || doc.uploadedAt ? formatDate(doc.created_at || doc.uploadedAt) : 'N/A'}</dd>
            </div>
            <div className="border border-border-default rounded-md p-3">
              <dt className="text-xs text-text-muted">Updated At</dt>
              <dd className="mt-1 text-text-primary">{doc.updated_at ? formatDate(doc.updated_at) : 'N/A'}</dd>
            </div>
            <div className="border border-border-default rounded-md p-3">
              <dt className="text-xs text-text-muted">Tenant Name</dt>
              <dd className="mt-1 text-text-primary">{tenantName}</dd>
            </div>
            <div className="border border-border-default rounded-md p-3">
              <dt className="text-xs text-text-muted">Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusTone(doc.status)}`}>
                  {doc.status}
                </span>
              </dd>
            </div>
            {isRejected && (
              <div className="border border-border-default rounded-md p-3">
                <dt className="text-xs text-text-muted">Rejection Reason</dt>
                <dd className="mt-1 text-text-primary">{doc.rejection_reason || 'None'}</dd>
              </div>
            )}
          </dl>
        </section>

        {isCsvFile && (
          <section className="bg-background-surface border border-border-default rounded-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-text-primary">CSV Metadata</h3>
              <button
                type="button"
                onClick={handleSaveCsvMetadata}
                disabled={savingCsv}
                className="px-3 py-1.5 rounded-md bg-primary-500 text-text-inverse text-xs font-medium hover:bg-primary-600 disabled:opacity-50"
              >
                {savingCsv ? 'Saving...' : 'Save CSV metadata'}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Filename</label>
                <input
                  type="text"
                  value={csvFilename}
                  onChange={(e) => setCsvFilename(e.target.value)}
                  className="w-full px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Summary</label>
                <textarea
                  value={csvSummary}
                  onChange={(e) => setCsvSummary(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-border-default rounded-md bg-background-surface text-sm"
                />
              </div>
            </div>
            {csvMessage && (
              <p className="mt-3 text-sm text-text-secondary">{csvMessage}</p>
            )}
          </section>
        )}

        {/* ── OCR Status (if available) ── */}
        {doc.ocr && (
          <section className="bg-background-surface border border-border-default rounded-lg p-5">
            <h3 className="text-base font-semibold text-text-primary">OCR Status and Confidence</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="border border-border-default rounded-md p-3">
                <p className="text-xs text-text-muted">OCR Used</p>
                <p className="mt-1 text-text-primary">{doc.ocr?.used ? 'Yes' : 'No'}</p>
              </div>
              <div className="border border-border-default rounded-md p-3">
                <p className="text-xs text-text-muted">OCR Status</p>
                <p className="mt-1">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusTone(doc.ocr?.status || 'UNKNOWN')}`}>
                    {doc.ocr?.status || 'UNKNOWN'}
                  </span>
                </p>
              </div>
              <div className="border border-border-default rounded-md p-3">
                <p className="text-xs text-text-muted">Confidence</p>
                <p className="mt-1 text-text-primary">
                  {doc.ocr?.confidence != null ? `${Math.round(doc.ocr.confidence * 100)}%` : 'N/A'}
                </p>
              </div>
            </div>
            {(doc.ocr?.flags || []).length > 0 && (
              <div className="mt-3 border border-border-default rounded-md p-3">
                <p className="text-xs text-text-muted">OCR Warnings</p>
                <p className="mt-1 text-sm text-text-primary">{doc.ocr.flags.join(', ')}</p>
              </div>
            )}
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
              <p className="text-xs text-text-muted mt-1">Content is split into chunks for AI processing.</p>
            </div>
            {chunks.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="px-3 py-1.5 rounded-md border border-border-default text-xs font-medium text-text-primary hover:bg-background-subtle transition-colors"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-3 py-1.5 rounded-md border border-border-default text-xs font-medium text-text-primary hover:bg-background-subtle transition-colors"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>

          <div className="divide-y divide-border-default">
            {chunks.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-text-muted">
                No content chunks available.
              </div>
            )}
            {chunks
              .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
              .map((chunk, idx) => {
                const isExpanded = !!expandedChunks[idx];
                return (
                  <div key={chunk.id || idx} className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => toggleChunk(idx)}
                      className="w-full flex items-center justify-between text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-50 text-primary-600 text-xs font-semibold border border-primary-200">
                          {chunk.chunk_index != null ? chunk.chunk_index + 1 : idx + 1}
                        </span>
                        <span className="text-sm font-medium text-text-primary group-hover:text-primary-500 transition-colors">
                          Chunk {chunk.chunk_index != null ? chunk.chunk_index + 1 : idx + 1}
                        </span>
                        <span className="text-xs text-text-muted">
                          {chunk.char_count || chunk.content?.length || 0} characters
                        </span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
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

        {/* ── Version History ── */}
        {(doc.versions || []).length > 0 && (
          <section className="bg-background-surface border border-border-default rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border-default">
              <h3 className="text-base font-semibold text-text-primary">Version History</h3>
              <p className="text-xs text-text-muted mt-1">Read-only timeline</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-default">
                <thead className="bg-background-subtle">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Version</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Updated At</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Actor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Note</th>
                  </tr>
                </thead>
                <tbody className="bg-background-surface divide-y divide-border-default">
                  {(doc.versions || []).map((entry) => (
                    <tr key={`${doc.id || doc._id}-v${entry.version}`}>
                      <td className="px-4 py-3 text-sm text-text-primary">v{entry.version}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(entry.updatedAt || entry.at)}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{entry.actor}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{entry.note || entry.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </EditorLayout>
  );
}
