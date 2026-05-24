import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearTokens } from '../../api/apiClient';
import { useBranding, clearBrandingCache } from '../../utils/BrandingContext';

const navItems = [
  { label: 'Dashboard',   path: '/editor/dashboard' },
  { label: 'CMS Library', path: '/editor/library' },
  { label: 'Upload',      path: '/editor/upload' },
  { label: 'Settings',    path: '/editor/settings' },
];

function isActivePath(currentPath, itemPath) {
  if (currentPath === itemPath) return true;
  if (itemPath === '/editor/library' && currentPath.startsWith('/editor/documents/')) return true;
  return false;
}

export default function EditorSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { branding } = useBranding();

  function handleLogout() {
    clearTokens();
    clearBrandingCache();
    navigate('/');
  }

  return (
    <aside
      className="w-64 flex-shrink-0 bg-white hidden md:flex flex-col h-screen sticky top-0 overflow-hidden border-r border-slate-100"
      style={{ boxShadow: '2px 0 12px rgba(0,0,0,0.04)' }}
    >
      {/* Brand header */}
      <div className="sidebar-brand-bg px-4 py-3.5 flex items-center gap-3 shrink-0">
        <div className="bg-white/15 rounded-xl p-1.5 shrink-0">
          <img
            src={branding.logo_url || '/logo.webp'}
            alt={`${branding.app_name || 'Governance'} Logo`}
            className="h-7 w-7 object-contain rounded-lg"
            onError={(e) => { e.target.src = '/logo.webp'; }}
          />
        </div>
        <div className="min-w-0">
          <span className="text-white font-bold text-sm leading-tight block truncate">
            {branding.app_name || 'Governance'}
          </span>
          <span className="text-blue-200 text-xs font-medium">Editor Portal</span>
        </div>
      </div>

      {/* Nav label */}
      <div className="px-4 pt-4 pb-1 shrink-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Navigation</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-1.5 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActivePath(location.pathname, item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              style={active ? { boxShadow: 'inset 3px 0 0 #1D4ED8' } : undefined}
            >
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${active ? 'bg-blue-600' : 'bg-slate-300'}`} />
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-slate-100 shrink-0" />

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
    </aside>
  );
}
