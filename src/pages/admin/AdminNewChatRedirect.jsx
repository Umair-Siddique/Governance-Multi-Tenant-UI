import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminChatLayout from './AdminChatLayout';
import { createConversationForNewChatRedirect, getConversationIdFromResponse } from '../../api/chats';

export default function AdminNewChatRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await createConversationForNewChatRedirect();
        const id = getConversationIdFromResponse(res);
        if (cancelled) return;
        if (id) {
          window.dispatchEvent(new Event('conversations:refresh'));
          navigate(`/dashboard/chat/session/${id}`, { replace: true });
          return;
        }
      } catch {
        // ignore
      }
      if (!cancelled) navigate('/dashboard/chat', { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <AdminChatLayout title="New Chat">
      <p className="text-sm text-text-muted">Opening your chat…</p>
    </AdminChatLayout>
  );
}

