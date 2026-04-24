import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import ThemeToggle from '../ui/ThemeToggle';

export default function SettingsLayout({ children, title }) {
    const location = useLocation();

    const settingsNavItems = [
        { label: 'LLM Provider', path: '/dashboard/settings/llm-providers' },
        { label: 'Profile Setting', path: '/dashboard/settings/profile' },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="h-screen overflow-hidden bg-background-main flex">
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Header (sticky) */}
                <header className="bg-background-surface shadow z-30 sticky top-0">
                    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-text-primary">{title || 'Settings'}</h1>
                        <div className="flex items-center gap-3">
                            <ThemeToggle />
                            <span className="text-sm font-medium text-text-primary">Welcome Admin</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* Settings Sidebar (sticky under header) */}
                    <aside className="w-64 bg-background-main p-4 pt-8 overflow-auto sticky" style={{ top: '5rem', height: 'calc(100vh - 5rem)' }}>
                        <div className="bg-background-surface rounded-lg shadow border border-border-default overflow-hidden">
                            <div className="p-4 space-y-1">
                                {settingsNavItems.map((item) => (
                                    <Link
                                        key={item.label}
                                        to={item.path}
                                        className={`block px-4 py-2 text-sm font-medium rounded-md transition-colors ${isActive(item.path)
                                            ? 'bg-primary-soft text-primary-500'
                                            : 'text-text-secondary hover:bg-background-subtle hover:text-text-primary'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </aside>

                    {/* Settings Content — only this area scrolls */}
                    <main className="flex-1 overflow-auto p-6" style={{ height: 'calc(100vh - 5rem)' }}>
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}

