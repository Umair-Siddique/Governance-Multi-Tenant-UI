import React from 'react';
import { useNavigate } from 'react-router-dom';
import AdminChatLayout from './AdminChatLayout';

export default function AdminChatHome() {
  const navigate = useNavigate();

  return (
    <AdminChatLayout title="Chat">
      <div className="bg-background-surface border border-border-default rounded-lg p-6">
        <h3 className="text-base font-semibold text-text-primary">Welcome</h3>
        <p className="mt-2 text-sm text-text-secondary">
          Pick a conversation from the left, or start a new one.
        </p>
        <div className="mt-5">
          <button
            type="button"
            onClick={() => navigate('/dashboard/chat/new')}
            className="px-4 py-2 rounded-md bg-primary-500 text-text-inverse text-sm font-medium hover:bg-primary-600"
          >
            Start new chat
          </button>
        </div>
      </div>
    </AdminChatLayout>
  );
}

