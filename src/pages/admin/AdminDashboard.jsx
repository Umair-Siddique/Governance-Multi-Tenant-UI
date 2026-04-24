import React from 'react';
import AdminLayout from './AdminLayout';
import { editorAndReviewerSummary } from './adminData';

export default function AdminDashboard() {
  const summary = editorAndReviewerSummary();

  return (
    <AdminLayout title="Admin Dashboard">
      <div className="max-w-7xl mx-auto">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <article className="bg-background-surface border border-border-default rounded-lg p-4">
            <p className="text-xs text-text-muted uppercase">Draft</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{summary.draft}</p>
          </article>
          <article className="bg-background-surface border border-border-default rounded-lg p-4">
            <p className="text-xs text-text-muted uppercase">Review Queue</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{summary.review}</p>
          </article>
          <article className="bg-background-surface border border-border-default rounded-lg p-4">
            <p className="text-xs text-text-muted uppercase">Approved</p>
            <p className="mt-2 text-3xl font-bold text-text-primary">{summary.approved}</p>
          </article>
        </section>
      </div>
    </AdminLayout>
  );
}
