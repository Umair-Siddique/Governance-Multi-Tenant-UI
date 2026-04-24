import React from 'react';
import { Link } from 'react-router-dom';
import EditorSidebar from '../../components/editor/EditorSidebar';
import ThemeToggle from '../../components/ui/ThemeToggle';

export default function EditorLayout({ title, headerInfo, children }) {
  return (
    <div className="min-h-screen bg-background-main flex">
      <EditorSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-background-surface shadow border-b border-border-default">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">{title}</h1>
            <div className="flex items-center gap-2">
              {headerInfo ? <span className="text-sm font-medium text-text-primary">{headerInfo}</span> : null}
              <ThemeToggle />
              <Link
                to="/editor/upload"
                className="px-3 py-2 rounded-md bg-primary-500 text-text-inverse text-sm font-medium hover:bg-primary-600 transition-colors"
              >
                Upload
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
