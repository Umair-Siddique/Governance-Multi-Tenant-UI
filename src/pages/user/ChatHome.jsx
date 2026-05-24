import React from 'react';
import { useNavigate } from 'react-router-dom';
import UserChatLayout from './UserChatLayout';

export default function ChatHome() {
  const navigate = useNavigate();

  return (
    <UserChatLayout title="Chat">
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center animate-fade-in-up max-w-md">

          {/* Animated icon with pulsing rings */}
          <div className="relative flex items-center justify-center mb-8">
            <span
              className="absolute rounded-full animate-pulse-ring"
              style={{
                width: '110px', height: '110px',
                background: 'rgba(29, 78, 216, 0.12)',
              }}
            />
            <span
              className="absolute rounded-full animate-pulse-ring"
              style={{
                width: '90px', height: '90px',
                background: 'rgba(67, 56, 202, 0.16)',
                animationDelay: '0.6s',
              }}
            />
            <div
              className="relative z-10 h-20 w-20 rounded-2xl flex items-center justify-center animate-float"
              style={{
                background: 'linear-gradient(135deg, #1D4ED8 0%, #4338CA 60%, #7C3AED 100%)',
                boxShadow: '0 12px 40px rgba(29, 78, 216, 0.4)',
              }}
            >
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <h2
            className="text-3xl font-extrabold mb-3 leading-tight"
            style={{
              background: 'linear-gradient(135deg, #1E40AF 0%, #4338CA 50%, #7C3AED 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Welcome to AI Chat
          </h2>
          <p className="text-slate-500 text-base leading-relaxed mb-8">
            Ask questions, explore your knowledge base, and get intelligent answers — all in one place.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {['Smart Answers', 'Document Search', 'Multi-language'].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Animated CTA button */}
          <div className="relative inline-block">
            <div
              className="absolute inset-0 rounded-2xl blur-md opacity-60 animate-glow-pulse"
              style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}
            />
            <button
              type="button"
              onClick={() => navigate('/user/chat/new')}
              className="relative btn-primary-gradient flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-white"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Start new chat
            </button>
          </div>

          <p className="mt-6 text-sm text-slate-400">
            Or pick an existing conversation from the sidebar
          </p>
        </div>
      </div>
    </UserChatLayout>
  );
}
