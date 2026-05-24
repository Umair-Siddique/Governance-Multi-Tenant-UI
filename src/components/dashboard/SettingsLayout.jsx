import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function SettingsLayout({ children, title }) {
    const location = useLocation();

    const settingsNavItems = [
        { label: 'LLM Provider', path: '/dashboard/settings/llm-providers' },
        { label: 'Profile Setting', path: '/dashboard/settings/profile' },
        { label: 'Branding', path: '/dashboard/settings/branding' },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="h-screen overflow-hidden bg-slate-50 flex">
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="admin-header z-30">
                    <div className="px-6 py-4 flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 leading-tight">{title || 'Settings'}</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Admin Panel</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* Settings sub-sidebar */}
                    <aside className="w-56 bg-slate-50 p-4 pt-6 overflow-auto shrink-0 border-r border-slate-100">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 px-1">Settings</p>
                        <div className="space-y-0.5">
                            {settingsNavItems.map((item) => (
                                <Link
                                    key={item.label}
                                    to={item.path}
                                    className={`block px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 ${
                                        isActive(item.path)
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-slate-600 hover:bg-white hover:text-slate-900'
                                    }`}
                                    style={isActive(item.path) ? { boxShadow: 'inset 3px 0 0 #1D4ED8' } : undefined}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </aside>

                    {/* Settings Content */}
                    <main className="flex-1 overflow-auto p-6">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}

