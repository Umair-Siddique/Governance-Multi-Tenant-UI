import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearTokens } from '../../api/apiClient';

const navItems = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Tenant Settings', path: '/admin/tenant-settings' },
  { label: 'LLM Providers', path: '/admin/providers' },
  { label: 'User Management', path: '/admin/users' },
  { label: 'Context Management', path: '/admin/context-management' },
  { label: 'Editor Portal', path: '/editor/dashboard' },
  { label: 'Reviewer Portal', path: '/reviewer/dashboard' },
];

function isActive(currentPath, itemPath) {
  return currentPath === itemPath;
}

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  function handleLogout() {
    clearTokens();
    navigate('/');
  }

  return (
    <aside className="w-72 flex-shrink-0 bg-background-surface border-r border-border-default hidden md:flex flex-col h-screen sticky top-0 overflow-y-auto">
      <div className="h-16 flex items-center px-6 border-b border-border-default">
        <Link to="/dashboard" className="flex items-center gap-3">
          <img src="/logo.webp" alt="Governance Logo" className="h-8 max-w-[200px] object-contain" />
          <span className="text-lg font-semibold text-text-primary">Admin Control</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-2.5 font-medium rounded-lg transition-colors ${
              isActive(location.pathname, item.path)
                ? 'bg-primary-soft text-primary-500'
                : 'text-text-secondary hover:bg-background-subtle hover:text-text-primary'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border-default">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-text-secondary hover:bg-error-soft hover:text-error-500 font-medium rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
