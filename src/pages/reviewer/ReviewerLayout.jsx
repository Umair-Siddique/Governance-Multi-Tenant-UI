import React from 'react';
import { Link } from 'react-router-dom';
import ReviewerSidebar from '../../components/reviewer/ReviewerSidebar';

export default function ReviewerLayout({ title, headerInfo, children }) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ReviewerSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="admin-header">
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">{title}</h1>
              <p className="text-xs text-slate-400 mt-0.5">Reviewer Portal</p>
            </div>
            <div className="flex items-center gap-3">
              {headerInfo && (
                <span className="text-sm font-medium text-slate-600">{headerInfo}</span>
              )}
              <Link
                to="/reviewer/queue"
                className="btn-primary-gradient flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              >
                Review Queue
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
