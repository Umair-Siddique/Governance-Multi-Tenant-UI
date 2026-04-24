import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminChatLayout from './AdminChatLayout';
import { streamRetrieverQuery } from '../../api/retriever';
import { appendMessage, listMessages } from '../../api/chats';

// Map backend stage keys → human label + icon character
const STAGE_META = {
  received:              { label: 'Received question',        icon: '📥' },
  attachments:           { label: 'Processing attachments',   icon: '📎' },
  analyzing_query:       { label: 'Analysing your question',  icon: '🔍' },
  planning_retrieval:    { label: 'Planning retrieval',       icon: '🗺️' },
  running_tools:         { label: 'Running retrieval tools',  icon: '⚙️' },
  running_tools_complete:{ label: 'Tools finished',           icon: '✅' },
  embedding:             { label: 'Embedding query',          icon: '🧮' },
  searching_data_source: { label: 'Searching knowledge base', icon: '🗂️' },
  pinecone_query:        { label: 'Querying vector index',    icon: '🧠' },
  retrieved:             { label: 'Context retrieved',        icon: '✅' },
  generating_response:   { label: 'Generating answer',        icon: '✍️' },
  anthropic_uploads:     { label: 'Uploading PDFs to model',  icon: '⬆️' },
  provider_stream_start: { label: 'Starting response stream', icon: '▶' },
  complete:              { label: 'Done',                     icon: '✓' },
};

function StatusBar({ stage, message, isStreaming }) {
  const meta = STAGE_META[stage] || null;
  const icon = meta?.icon ?? '⏳';
  const label = meta?.label ?? message ?? stage ?? '…';
  const isDone = stage === 'complete';

  return (
    <div className="px-4 py-2 border-t border-border-default bg-background-subtle flex items-center gap-2 text-xs">
      <span
        className={`text-base leading-none ${isDone ? 'text-success-500' : isStreaming ? 'animate-pulse' : ''}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className={`font-medium ${isDone ? 'text-success-600' : 'text-text-secondary'}`}>{label}</span>
      {!isDone && isStreaming && (
        <span className="ml-auto flex gap-0.5">
          <span className="w-1 h-1 rounded-full bg-primary-400 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1 h-1 rounded-full bg-primary-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1 h-1 rounded-full bg-primary-400 animate-bounce" />
        </span>
      )}
    </div>
  );
}

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
  const [retrieverStatus, setRetrieverStatus] = useState({ stage: '', message: '' });
  const [planInfo, setPlanInfo] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  const streamAbortRef = useRef(null);
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
    if (!text || isStreaming || !conversationId) return;

    const filesToSend = [...attachmentFiles];
    setAttachmentFiles([]);

    streamAbortRef.current?.abort();
    streamAbortRef.current = new AbortController();
    const { signal } = streamAbortRef.current;

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

    const assistantLocalId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantLocalId, role: 'assistant', type: 'retriever', text: '' },
    ]);
    setQuestion('');
    setIsStreaming(true);
    setRetrieverStatus({ stage: '', message: '' });
    setPlanInfo(null);

    let assistantText = '';
    try {
      await streamRetrieverQuery(
        { query: text, top_k: 8, signal, files: filesToSend.length ? filesToSend : undefined },
        {
          onStatus: (data) => {
            setRetrieverStatus({ stage: data.stage || '', message: data.message || '' });
          },
          onPlan: (data) => setPlanInfo(data),
          onToken: (t) => {
            assistantText += t;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantLocalId ? { ...m, text: (m.text || '') + t } : m))
            );
          },
          onError: (msg) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantLocalId
                  ? {
                      ...m,
                      type: 'refusal',
                      text: m.text?.trim() ? `${m.text}\n\n— ${msg}` : msg,
                    }
                  : m
              )
            );
          },
          onDone: () => {},
        }
      );

      const finalText = (assistantText || '').trim();
      if (finalText) {
        const savedAssistant = await appendMessage(conversationId, {
          role: 'assistant',
          content: finalText,
          metadata: {
            provider: planInfo?.answer_provider || undefined,
            search_query: planInfo?.search_query || undefined,
          },
        }).catch(() => null);

        if (savedAssistant?.message?.id) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantLocalId ? { ...m, id: savedAssistant.message.id } : m))
          );
        }
      }

      // Avoid refreshing the conversation list on every streamed answer.
      // Conversation ordering can be refreshed on explicit actions (new chat / rename / delete).
    } catch (e) {
      if (e?.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantLocalId
              ? {
                  ...m,
                  type: 'refusal',
                  text: m.text?.trim() ? `${m.text}\n\n— ${e.message}` : e.message,
                }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      setRetrieverStatus({ stage: '', message: '' });
    }
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // If the user navigates away (e.g. clicks back), abort any in-flight stream
  // so auth-refresh logic cannot misfire and redirect to "session expired".
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  function bubbleClass(msg) {
    if (msg.role === 'user') return 'border border-border-default bg-background-subtle';
    if (msg.type === 'refusal') return 'bg-error-soft border border-error-500/30';
    return 'bg-background-surface border border-border-default';
  }

  return (
    <AdminChatLayout title={conversationTitle} noPageScroll>
      <div className="h-full min-h-0 flex flex-col gap-4">
        <section className="bg-background-surface border border-border-default rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto bg-background-main">
            {hasMoreHistory && !isStreaming && (
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
              const isStreamingThis = isStreaming && msg.role === 'assistant' && msg === messages[messages.length - 1];
              return (
                <div key={msg.id} className={`rounded-lg p-3 ${bubbleClass(msg)}`}>
                  <p className="text-xs text-text-secondary mb-1">{msg.role === 'user' ? 'You' : 'Assistant'}</p>
                  {isStreamingThis && !msg.text ? (
                    <span className="text-sm text-text-muted italic">{retrieverStatus.message || 'Thinking…'}</span>
                  ) : (
                    <p className="text-sm text-text-primary whitespace-pre-wrap">
                      {msg.text}
                      {isStreamingThis && (
                        <span
                          className="inline-block w-0.5 h-3.5 ml-0.5 bg-primary-500 align-text-bottom animate-pulse"
                          aria-hidden="true"
                        />
                      )}
                    </p>
                  )}
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

          {isStreaming && (
            <>
              <StatusBar stage={retrieverStatus.stage} message={retrieverStatus.message} isStreaming={isStreaming} />
              {planInfo?.search_query != null && planInfo.search_query !== '' && (
                <div className="px-4 py-2 text-xs text-text-muted border-t border-border-default bg-background-main">
                  <span className="font-medium text-text-secondary">Planned search: </span>
                  {planInfo.search_query}
                </div>
              )}
            </>
          )}

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
              disabled={isStreaming || attachmentFiles.length >= MAX_ATTACHMENTS}
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
                if (e.key === 'Enter' && !isStreaming) {
                  e.preventDefault();
                  sendQuestion();
                }
              }}
              placeholder="Ask a question…"
              disabled={isStreaming}
              className="flex-1 min-w-0 px-3 py-2 border border-border-default rounded-md bg-background-surface text-text-primary placeholder:text-text-muted text-sm disabled:opacity-60"
            />
            <button
              type="button"
              onClick={sendQuestion}
              disabled={isStreaming}
              className="px-4 py-2 rounded-md bg-primary-500 text-text-inverse text-sm font-medium hover:bg-primary-600 disabled:opacity-60 shrink-0"
            >
              {isStreaming ? '…' : 'Send'}
            </button>
          </div>
        </section>
      </div>
    </AdminChatLayout>
  );
}

