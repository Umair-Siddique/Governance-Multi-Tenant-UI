import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserChatLayout from './UserChatLayout';
import { createConversationForNewChatRedirect, getConversationIdFromResponse } from '../../api/chats';

export default function NewChatRedirect() {
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
          navigate(`/user/chat/session/${id}`, { replace: true });
          return;
        }
      } catch {
        // ignore
      }
      if (!cancelled) navigate('/user/chat', { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <UserChatLayout title="New Chat">
      <p className="text-sm text-text-muted">Opening your chat…</p>
    </UserChatLayout>
  );
}
