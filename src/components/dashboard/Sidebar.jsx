import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { clearTokens } from '../../api/apiClient';

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        clearTokens();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));

    const navItems = [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'User Management', path: '/dashboard/user-management' },
        { label: 'Context Management', path: '/dashboard/context-management' },
        { label: 'Chat', path: '/dashboard/chat' },
        { label: 'Settings', path: '/dashboard/settings' },
    ];

    return (
        <div className="w-72 flex-shrink-0 bg-background-surface border-r border-border-default hidden md:flex flex-col h-screen sticky top-0 overflow-y-auto">
            <div className="h-16 flex items-center px-6 border-b border-border-default">
                <Link to="/dashboard" className="flex items-center gap-3">
                    <img src="/logo.webp" alt="Governance Logo" className="h-8 max-w-[200px] object-contain" />
                    <span className="text-xl font-bold text-primary-600">Governance</span>
                </Link>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-hidden">
                {navItems.map((item) => (
                    item.disabled ? (
                        <a key={item.label} href="#" className="flex items-center gap-3 px-4 py-2.5 text-text-muted cursor-not-allowed font-medium rounded-lg transition-colors">
                            {item.label}
                        </a>
                    ) : (
                        <Link
                            key={item.label}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-2.5 font-medium rounded-lg transition-colors ${isActive(item.path)
                                ? 'bg-primary-soft text-primary-500'
                                : 'text-text-secondary hover:bg-background-subtle hover:text-text-primary'
                                }`}
                        >
                            {item.label}
                        </Link>
                    )
                ))}
            </nav>

            <div className="p-4 border-t border-border-default">
                <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2.5 text-text-secondary hover:bg-error-soft hover:text-error-500 font-medium rounded-lg transition-colors">
                    Logout
                </button>
            </div>
        </div>
    );
}

