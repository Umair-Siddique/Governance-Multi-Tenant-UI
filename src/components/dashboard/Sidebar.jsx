import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { clearTokens } from '../../api/apiClient';
import { useBranding, clearBrandingCache } from '../../utils/BrandingContext';

const navItems = [
    {
        label: 'Dashboard',
        path: '/dashboard',
        icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        label: 'User Management',
        path: '/dashboard/user-management',
        icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
    {
        label: 'Context Management',
        path: '/dashboard/context-management',
        icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    },
    {
        label: 'Audit Logs',
        path: '/dashboard/audit-logs',
        icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
        ),
    },
    {
        label: 'Chat',
        path: '/dashboard/chat',
        icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        ),
    },
    {
        label: 'Settings',
        path: '/dashboard/settings',
        icon: (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
];

export default function Sidebar() {
    const { branding } = useBranding();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        clearTokens();
        clearBrandingCache();
        navigate('/');
    };

    const isActive = (path) =>
        location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));

    return (
        <div className="w-64 flex-shrink-0 bg-white border-r border-slate-100 hidden md:flex flex-col h-screen sticky top-0 overflow-y-auto"
             style={{ boxShadow: '2px 0 12px rgba(0,0,0,0.04)' }}>

            {/* Brand header */}
            <div className="sidebar-brand-bg px-5 py-4 flex items-center gap-3 shrink-0">
                <div className="bg-white/15 rounded-xl p-1.5 shrink-0">
                    <img
                        src={branding.logo_url || '/logo.webp'}
                        alt={`${branding.app_name || 'Governance'} Logo`}
                        className="h-7 w-7 object-contain rounded-lg"
                        onError={(e) => { e.target.src = '/logo.webp'; }}
                    />
                </div>
                <div className="min-w-0">
                    <span className="text-white font-bold text-base leading-tight block truncate">
                        {branding.app_name || 'Governance'}
                    </span>
                    <span className="text-blue-200 text-xs font-medium">Admin Panel</span>
                </div>
            </div>

            {/* Navigation label */}
            <div className="px-4 pt-5 pb-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Navigation</p>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
                {navItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={item.label}
                            to={item.path}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 group ${
                                active
                                    ? 'text-blue-700 bg-blue-50'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                            style={active ? { boxShadow: 'inset 3px 0 0 #1D4ED8' } : undefined}
                        >
                            <span className={`transition-colors duration-150 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                {item.icon}
                            </span>
                            {item.label}
                            {active && (
                                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Divider */}
            <div className="mx-4 border-t border-slate-100" />

            {/* Logout */}
            <div className="p-3 shrink-0">
                <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 font-medium text-sm rounded-xl transition-all duration-150 group"
                >
                    <svg className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                </button>
            </div>
        </div>
    );
}
