import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AdminChatLayout from './AdminChatLayout';
import { appendMessage, listMessages } from '../../api/chats';

const MAX_ATTACHMENTS = 12;

const FILE_INPUT_ACCEPT =
  '.pdf,.docx,.txt,.md,.csv,.json,.log,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tif,.tiff,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export default function AdminChatSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [conversationTitle, setConversationTitle] = useState('Chat');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [question, setQuestion] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const conversationId = useMemo(() => {
    const id = (sessionId || '').trim();
    const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    return ok ? id : null;
  }, [sessionId]);

  function addAttachmentsFromInput(event) {
    const picked = Array.from(event.target.files || []);
    if (picked.length === 0) return;
    setAttachmentFiles((prev) => {
      const next = [...prev, ...picked];
      return next.slice(0, MAX_ATTACHMENTS);
    });
    event.target.value = '';
  }

  function removeAttachment(index) {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function sendQuestion() {
    const text = question.trim();
    if (!text || !conversationId) return;

    const filesToSend = [...attachmentFiles];
    setAttachmentFiles([]);

    const attachmentNames = filesToSend.map((f) => f.name);
    const savedUser = await appendMessage(conversationId, {
      role: 'user',
      content: text,
      metadata: attachmentNames.length ? { attachments: attachmentNames } : {},
    }).catch(() => null);

    const userMessage = savedUser?.message
      ? {
          id: savedUser.message.id,
          role: savedUser.message.role,
          text: savedUser.message.content,
          attachmentNames: savedUser.message.metadata?.attachments || attachmentNames,
          created_at: savedUser.message.created_at,
        }
      : {
          id: `u-${Date.now()}`,
          role: 'user',
          text,
          attachmentNames,
        };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
  }

  useEffect(() => {
    (async () => {
      if (!conversationId) {
        setLoadingHistory(false);
        return;
      }
      try {
        setLoadingHistory(true);
        const pageSize = 100;
        const data = await listMessages(conversationId, { limit: pageSize });
        setConversationTitle(data?.conversation?.title || 'Chat');
        const loaded = (data?.messages || []).map((m) => ({
          id: m.id,
          role: m.role,
          text: m.content,
          attachmentNames: m.metadata?.attachments || [],
          created_at: m.created_at,
        }));
        setMessages(loaded);
        setHasMoreHistory((data?.messages || []).length === pageSize);
      } catch {
        navigate('/dashboard/chat', { replace: true });
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [conversationId, navigate]);

  async function loadOlderMessages() {
    if (!conversationId || loadingHistory || messages.length === 0) return;
    const beforeId = messages[0]?.id;
    if (!beforeId) return;
    try {
      setLoadingHistory(true);
      const pageSize = 100;
      const data = await listMessages(conversationId, { limit: pageSize, beforeId });
      const older = (data?.messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        text: m.content,
        attachmentNames: m.metadata?.attachments || [],
        created_at: m.created_at,
      }));
      if (older.length === 0) {
        setHasMoreHistory(false);
        return;
      }
      setMessages((prev) => [...older, ...prev]);
      setHasMoreHistory(older.length === pageSize);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [messages]);

  function bubbleClass(msg) {
    if (msg.role === 'user') return 'border border-border-default bg-background-subtle';
    if (msg.type === 'refusal') return 'bg-error-soft border border-error-500/30';
    return 'bg-background-surface border border-border-default';
  }

  function MessageBody({ msg }) {
    if (msg.role !== 'assistant') {
      return <p className="text-sm text-text-primary whitespace-pre-wrap">{msg.text}</p>;
    }

    return (
      <div className="text-sm text-text-primary leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node, ...props }) => (
              <a {...props} className="text-primary-600 hover:underline break-words" target="_blank" rel="noreferrer" />
            ),
            p: ({ node, ...props }) => <p {...props} className="whitespace-pre-wrap break-words" />,
            ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-5 my-2 space-y-1" />,
            ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-5 my-2 space-y-1" />,
            li: ({ node, ...props }) => <li {...props} className="whitespace-pre-wrap" />,
            code: ({ node, inline, className, children, ...props }) => {
              if (inline) {
                return (
                  <code {...props} className="px-1 py-0.5 rounded bg-background-subtle border border-border-default text-[0.9em]">
                    {children}
                  </code>
                );
              }
              return (
                <pre className="my-2 p-3 rounded bg-background-subtle border border-border-default overflow-x-auto">
                  <code {...props} className={className}>
                    {children}
                  </code>
                </pre>
              );
            },
            h1: ({ node, ...props }) => <h1 {...props} className="text-lg font-semibold mt-3 mb-2" />,
            h2: ({ node, ...props }) => <h2 {...props} className="text-base font-semibold mt-3 mb-2" />,
            h3: ({ node, ...props }) => <h3 {...props} className="text-sm font-semibold mt-3 mb-2" />,
            blockquote: ({ node, ...props }) => (
              <blockquote {...props} className="border-l-4 border-border-default pl-3 my-2 text-text-secondary" />
            ),
            hr: ({ node, ...props }) => <hr {...props} className="my-3 border-border-default" />,
          }}
        >
          {msg.text || ''}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <AdminChatLayout title={conversationTitle} noPageScroll>
      <div className="h-full min-h-0 flex flex-col gap-4">
        <section className="bg-background-surface border border-border-default rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto bg-background-main">
            {hasMoreHistory && (
              <button
                type="button"
                onClick={loadOlderMessages}
                disabled={loadingHistory}
                className="w-full px-3 py-2 rounded-md text-xs border border-border-default text-text-secondary hover:bg-background-subtle disabled:opacity-60"
              >
                {loadingHistory ? 'Loading…' : 'Load older messages'}
              </button>
            )}
            {loadingHistory ? (
              <p className="text-sm text-text-muted">Loading conversation…</p>
            ) : messages.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-text-muted">Ask your first question.</p>
                <p className="mt-2 text-xs text-text-muted">You can attach files for this message.</p>
              </div>
            ) : null}

            {messages.map((msg) => {
              return (
                <div key={msg.id} className={`rounded-lg p-3 ${bubbleClass(msg)}`}>
                  <p className="text-xs text-text-secondary mb-1">{msg.role === 'user' ? 'You' : 'Assistant'}</p>
                  <MessageBody msg={msg} />
                  {msg.role === 'user' && msg.attachmentNames?.length > 0 && (
                    <ul className="mt-2 text-xs text-text-muted list-disc list-inside">
                      {msg.attachmentNames.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {attachmentFiles.length > 0 && (
            <div className="px-4 py-2 border-t border-border-default flex flex-wrap gap-2 items-center bg-background-main">
              <span className="text-xs text-text-secondary">Attached:</span>
              {attachmentFiles.map((file, i) => (
                <span
                  key={`${file.name}-${i}`}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-background-subtle border border-border-default text-xs text-text-primary"
                >
                  {file.name}
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="p-0.5 rounded hover:bg-background-surface text-text-muted hover:text-text-primary"
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <span className="text-xs text-text-muted">
                {attachmentFiles.length}/{MAX_ATTACHMENTS}
              </span>
            </div>
          )}

          <div className="p-4 border-t border-border-default flex gap-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={FILE_INPUT_ACCEPT}
              className="hidden"
              onChange={addAttachmentsFromInput}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={attachmentFiles.length >= MAX_ATTACHMENTS}
              className="inline-flex items-center justify-center h-10 w-10 shrink-0 rounded-md border border-border-default text-text-primary hover:bg-background-subtle disabled:opacity-50"
              title="Attach files"
              aria-label="Attach files"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a3 3 0 01-4.243-4.243l9.13-9.13a2.25 2.25 0 113.182 3.182L9.62 19.37a1.5 1.5 0 11-2.121-2.121l7.424-7.425" />
              </svg>
            </button>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendQuestion();
                }
              }}
              placeholder="Ask a question…"
              className="flex-1 min-w-0 px-3 py-2 border border-border-default rounded-md bg-background-surface text-text-primary placeholder:text-text-muted text-sm disabled:opacity-60"
            />
            <button
              type="button"
              onClick={sendQuestion}
              className="px-4 py-2 rounded-md bg-primary-500 text-text-inverse text-sm font-medium hover:bg-primary-600 disabled:opacity-60 shrink-0"
            >
              Send
            </button>
          </div>
        </section>
      </div>
    </AdminChatLayout>
  );
}

