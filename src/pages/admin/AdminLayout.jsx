import React from 'react';
import Sidebar from '../../components/dashboard/Sidebar';

export default function AdminLayout({ title, children }) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-100 sticky top-0 z-10"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">{title}</h1>
              <p className="text-xs text-slate-400 mt-0.5">Admin Panel</p>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
