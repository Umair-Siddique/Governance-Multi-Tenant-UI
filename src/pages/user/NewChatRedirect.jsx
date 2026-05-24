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
      <div className="h-full flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="flex justify-center mb-4">
            <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-500">Opening your chat…</p>
        </div>
      </div>
    </UserChatLayout>
  );
}
