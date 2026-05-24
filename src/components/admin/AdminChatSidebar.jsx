import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearTokens } from '../../api/apiClient';
import { useBranding, clearBrandingCache } from '../../utils/BrandingContext';
import {
  createConversation,
  deleteConversation,
  getConversationIdFromResponse,
  listConversationTitles,
  updateConversationTitle,
} from '../../api/chats';

function isUuidLike(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    (s || '').trim()
  );
}

export default function AdminChatSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const newChatLockRef = useRef(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const activeConversationId = useMemo(() => {
    const path = location.pathname || '';
    const m = path.match(/^\/dashboard\/chat\/session\/([^/]+)$/);
    const id = m?.[1] || '';
    return isUuidLike(id) ? id : null;
  }, [location.pathname]);

  async function refreshConversations() {
    try {
      setLoading(true);
      const data = await listConversationTitles({ limit: 10, page: 1 });
      setConversations(data.titles || []);
      setPage(1);
      setHasMore(Boolean(data.has_more));
    } catch {
      setConversations([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loading || !hasMore) return;
    try {
      setLoading(true);
      const nextPage = page + 1;
      const data = await listConversationTitles({ limit: 10, page: nextPage });
      const rows = data.titles || [];
      setConversations((prev) => [...prev, ...rows]);
      setPage(nextPage);
      setHasMore(Boolean(data.has_more));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleRenameConversation(c) {
    const id = c?.id;
    if (!id) return;
    const current = (c?.title || '').trim();
    const next = window.prompt('Rename conversation', current);
    if (next == null) return;
    const title = String(next).trim();
    if (!title) return;
    try {
      setBusyId(id);
      await updateConversationTitle(id, title);
      setConversations((prev) => prev.map((x) => (x.id === id ? { ...x, title } : x)));
      window.dispatchEvent(new Event('conversations:refresh'));
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    refreshConversations();
    const onRefresh = () => refreshConversations();
    window.addEventListener('conversations:refresh', onRefresh);
    return () => window.removeEventListener('conversations:refresh', onRefresh);
  }, []);

  function handleLogout() {
    clearTokens();
    clearBrandingCache();
    navigate('/');
  }

  async function handleNewChat() {
    if (newChatLockRef.current) return;
    newChatLockRef.current = true;
    try {
      setBusyId('__new__');
      const res = await createConversation('New conversation');
      const id = getConversationIdFromResponse(res);
      if (id) {
        window.dispatchEvent(new Event('conversations:refresh'));
        navigate(`/dashboard/chat/session/${id}`);
      } else {
        navigate('/dashboard/chat/new');
      }
    } finally {
      newChatLockRef.current = false;
      setBusyId(null);
    }
  }

  async function handleDeleteConversation(id) {
    if (!id) return;
    try {
      setBusyId(id);
      await deleteConversation(id);
      if (activeConversationId === id) {
        navigate('/dashboard/chat');
      }
      window.dispatchEvent(new Event('conversations:refresh'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <aside
      className="w-64 flex-shrink-0 bg-white hidden md:flex flex-col h-screen sticky top-0 overflow-hidden border-r border-slate-100"
      style={{ boxShadow: '2px 0 12px rgba(0,0,0,0.04)' }}
    >
      {/* Brand header — gradient matching dashboard sidebar */}
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
          <span className="text-blue-200 text-xs font-medium">AI Chat</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 text-sm font-medium transition-all duration-150"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Dashboard
        </button>

        <button
          type="button"
          onClick={handleNewChat}
          disabled={busyId === '__new__'}
          className="btn-primary-gradient w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 disabled:transform-none disabled:shadow-none"
        >
          {busyId === '__new__' ? (
            <>
              <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating…
            </>
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </>
          )}
        </button>
      </div>

      {/* Nav label */}
      <div className="px-4 pt-2 pb-1 shrink-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Conversations</p>
      </div>

      {/* Home link */}
      <div className="px-3 shrink-0">
        <Link
          to="/dashboard/chat"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
            location.pathname === '/dashboard/chat'
              ? 'text-blue-700 bg-blue-50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          style={location.pathname === '/dashboard/chat' ? { boxShadow: 'inset 3px 0 0 #1D4ED8' } : undefined}
        >
          <svg className={`w-4 h-4 shrink-0 ${location.pathname === '/dashboard/chat' ? 'text-blue-500' : 'text-slate-400'}`}
               fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Home
          {location.pathname === '/dashboard/chat' && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
          )}
        </Link>
      </div>

      {/* Conversations list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1.5">
        {loading && conversations.length === 0 ? (
          <div className="px-3 py-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-slate-400">No conversations yet.</p>
            <p className="text-xs text-slate-300 mt-0.5">Start a new chat above.</p>
          </div>
        ) : (
          <>
            {conversations.map((c) => {
              const id = c.id;
              const active = activeConversationId === id;
              const disabled = busyId === id;
              return (
                <div
                  key={id}
                  className={`group flex items-center gap-1.5 rounded-xl px-3 py-2 mb-0.5 transition-all duration-150 ${
                    active ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                  }`}
                  style={active ? { boxShadow: 'inset 3px 0 0 #1D4ED8' } : undefined}
                >
                  <svg className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-blue-500' : 'text-slate-300'}`}
                       fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <Link
                    to={`/dashboard/chat/session/${id}`}
                    className="min-w-0 flex-1 text-xs font-medium"
                    title={c.title || 'Conversation'}
                  >
                    <span className="block truncate">{c.title || 'Conversation'}</span>
                  </Link>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRenameConversation(c)}
                      disabled={disabled}
                      className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                      title="Rename"
                      aria-label="Rename conversation"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182l-9.82 9.82a4.5 4.5 0 0 1-1.897 1.135l-3.04.912a.75.75 0 0 1-.93-.93l.912-3.04a4.5 4.5 0 0 1 1.135-1.897l9.82-9.82Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteConversation(id)}
                      disabled={disabled}
                      className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                      title="Delete"
                      aria-label="Delete conversation"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M9 3.75A.75.75 0 0 1 9.75 3h4.5a.75.75 0 0 1 .75.75V5.25h3a.75.75 0 0 1 0 1.5h-.64l-1.2 13.2A2.25 2.25 0 0 1 13.92 22H10.08a2.25 2.25 0 0 1-2.24-2.05l-1.2-13.2H6a.75.75 0 0 1 0-1.5h3V3.75Zm1.5 1.5v0h3V5.25h-3Zm-.81 3.75a.75.75 0 0 1 .81.69l.6 9a.75.75 0 0 1-1.5.1l-.6-9a.75.75 0 0 1 .69-.79Zm4.62.69a.75.75 0 1 0-1.5-.1l-.6 9a.75.75 0 1 0 1.5.1l.6-9Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="mt-1 w-full px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>

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
