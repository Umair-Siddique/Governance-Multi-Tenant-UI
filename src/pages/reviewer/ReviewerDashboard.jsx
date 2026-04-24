import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ReviewerLayout from './ReviewerLayout';
import { getDocuments } from '../../api/documents';

function normalizeStatus(value) {
  return String(value || '').toLowerCase();
}

export default function ReviewerDashboard() {
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    async function loadDocuments() {
      try {
        const data = await getDocuments();
        const rows = Array.isArray(data) ? data : data.documents || [];
        setDocuments(rows);
      } catch {
        setDocuments([]);
      }
    }

    loadDocuments();
  }, []);

  const reviewQueueCount = useMemo(
    () => documents.filter((doc) => normalizeStatus(doc.status) === 'review').length,
    [documents]
  );

  const approvedCount = useMemo(
    () => documents.filter((doc) => normalizeStatus(doc.status) === 'approved').length,
    [documents]
  );

  return (
    <ReviewerLayout title="Reviewer Dashboard">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <article className="bg-background-surface border border-border-default rounded-lg p-5">
            <p className="text-xs text-text-muted uppercase tracking-wide">Review Queue</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{reviewQueueCount}</p>
          </article>
          <article className="bg-background-surface border border-border-default rounded-lg p-5">
            <p className="text-xs text-text-muted uppercase tracking-wide">Approved Documents</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{approvedCount}</p>
          </article>
        </section>

        <section className="bg-background-surface border border-border-default rounded-lg p-5">
          <h2 className="text-base font-semibold text-text-primary">Fast Access</h2>
          <div className="mt-4">
            <Link
              to="/reviewer/queue"
              className="inline-flex px-4 py-2 rounded-md bg-primary-500 text-text-inverse text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              Open Review Queue
            </Link>
          </div>
        </section>
      </div>
    </ReviewerLayout>
  );
}
