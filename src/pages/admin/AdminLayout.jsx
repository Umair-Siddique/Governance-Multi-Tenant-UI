import React from 'react';
import Sidebar from '../../components/dashboard/Sidebar';
import ThemeToggle from '../../components/ui/ThemeToggle';

export default function AdminLayout({ title, children }) {
  return (
    <div className="min-h-screen bg-background-main flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-background-surface shadow border-b border-border-default">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">{title}</h1>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
