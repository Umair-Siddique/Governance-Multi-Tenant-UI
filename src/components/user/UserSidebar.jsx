import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearTokens } from '../../api/apiClient';
import { USER_BRANDING } from '../../pages/user/userChatData';
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

export default function UserSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const activeConversationId = useMemo(() => {
    const path = location.pathname || '';
    const m = path.match(/^\/user\/chat\/session\/([^/]+)$/);
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
    } catch (e) {
      // Non-fatal; keep sidebar usable for logout.
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
      // Update local list immediately
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
    navigate('/');
  }

  async function handleNewChat() {
    try {
      setBusyId('__new__');
      const res = await createConversation('New conversation');
      const id = getConversationIdFromResponse(res);
      if (id) {
        window.dispatchEvent(new Event('conversations:refresh'));
        navigate(`/user/chat/session/${id}`);
      } else {
        navigate('/user/chat/new');
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteConversation(id) {
    if (!id) return;
    try {
      setBusyId(id);
      await deleteConversation(id);
      if (activeConversationId === id) {
        navigate('/user/chat');
      }
      window.dispatchEvent(new Event('conversations:refresh'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <aside className="w-72 flex-shrink-0 bg-background-surface border-r border-border-default hidden md:flex flex-col h-screen sticky top-0 overflow-hidden">
      <div className="h-16 flex items-center px-6 border-b border-border-default">
        <Link to="/user/chat" className="flex items-center gap-3">
          <img src="/logo.webp" alt="Tenant logo" className="h-8 max-w-[180px] object-contain" />
          <div>
            <p className="text-[11px] text-text-muted">{USER_BRANDING.tenantName}</p>
            <p className="text-sm font-semibold text-text-primary">{USER_BRANDING.appName}</p>
          </div>
        </Link>
      </div>

      <div className="p-4 border-b border-border-default">
        <button
          type="button"
          onClick={handleNewChat}
          disabled={busyId === '__new__'}
          className="w-full px-4 py-2.5 rounded-lg bg-primary-500 text-text-inverse text-sm font-medium hover:bg-primary-600 disabled:opacity-60 transition-colors"
        >
          New chat
        </button>
      </div>

      <nav className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden">
        <Link
          to="/user/chat"
          className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            location.pathname === '/user/chat'
              ? 'bg-background-subtle text-text-primary'
              : 'text-text-secondary hover:bg-background-subtle hover:text-text-primary'
          }`}
        >
          Home
        </Link>

        <div className="pt-3 flex-1 min-h-0 flex flex-col overflow-hidden">
          <p className="px-3 pb-2 text-[11px] uppercase tracking-wide text-text-muted">Conversations</p>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {loading ? (
              <div className="px-3 py-2 text-xs text-text-muted">Loading…</div>
            ) : conversations.length === 0 ? (
              <div className="px-3 py-2 text-xs text-text-muted">No conversations yet.</div>
            ) : (
              conversations.map((c) => {
                const id = c.id;
                const active = activeConversationId === id;
                const disabled = busyId === id;
                return (
                  <div
                    key={id}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                      active ? 'bg-background-subtle' : 'hover:bg-background-subtle'
                    }`}
                  >
                    <Link
                      to={`/user/chat/session/${id}`}
                      className={`min-w-0 flex-1 text-sm ${
                        active ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'
                      }`}
                      title={c.title || 'Conversation'}
                    >
                      <span className="block truncate">{c.title || 'Conversation'}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleRenameConversation(c)}
                      disabled={disabled}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md border border-border-default text-text-muted hover:text-text-primary hover:bg-background-surface disabled:opacity-50 transition"
                      title="Rename"
                      aria-label="Rename conversation"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182l-9.82 9.82a4.5 4.5 0 0 1-1.897 1.135l-3.04.912a.75.75 0 0 1-.93-.93l.912-3.04a4.5 4.5 0 0 1 1.135-1.897l9.82-9.82Z" />
                        <path d="M19.5 8.25 15.75 4.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteConversation(id)}
                      disabled={disabled}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md border border-border-default text-text-muted hover:text-error-500 hover:border-error-500/40 hover:bg-error-soft disabled:opacity-50 transition"
                      title="Delete"
                      aria-label="Delete conversation"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M9 3.75A.75.75 0 0 1 9.75 3h4.5a.75.75 0 0 1 .75.75V5.25h3a.75.75 0 0 1 0 1.5h-.64l-1.2 13.2A2.25 2.25 0 0 1 13.92 22H10.08a2.25 2.25 0 0 1-2.24-2.05l-1.2-13.2H6a.75.75 0 0 1 0-1.5h3V3.75Zm1.5 1.5v0h3V5.25h-3Zm-.81 3.75a.75.75 0 0 1 .81.69l.6 9a.75.75 0 0 1-1.5.1l-.6-9a.75.75 0 0 1 .69-.79Zm4.62.69a.75.75 0 1 0-1.5-.1l-.6 9a.75.75 0 1 0 1.5.1l.6-9Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}

            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="mt-2 mx-3 w-[calc(100%-1.5rem)] px-3 py-2 rounded-lg text-xs border border-border-default text-text-secondary hover:bg-background-subtle disabled:opacity-60"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        </div>
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
