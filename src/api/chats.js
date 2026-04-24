/**
 * Tenant-scoped chat history API.
 *
 * Backend:
 * - GET/POST   /api/chats/conversations
 * - PATCH/DEL  /api/chats/conversations/:id
 * - GET/POST   /api/chats/conversations/:id/messages
 */

import { API_BASE, authFetch, handleJsonResponse } from './apiClient';

export async function listConversations(limit = 50) {
  const q = new URLSearchParams();
  if (limit != null) q.set('limit', String(limit));
  const res = await authFetch(`${API_BASE}/api/chats/conversations?${q.toString()}`);
  return handleJsonResponse(res, 'Failed to list conversations');
}

/**
 * Paginated titles list.
 * Backend: GET /api/chats/conversations/titles?limit=10&page=1
 */
export async function listConversationTitles({ limit = 10, page = 1 } = {}) {
  const q = new URLSearchParams();
  if (limit != null) q.set('limit', String(limit));
  if (page != null) q.set('page', String(page));
  const res = await authFetch(`${API_BASE}/api/chats/conversations/titles?${q.toString()}`);
  return handleJsonResponse(res, 'Failed to list conversation titles');
}

/**
 * Normalizes create/list response shapes from the backend.
 * @param {unknown} data
 * @returns {string | null}
 */
export function getConversationIdFromResponse(data) {
  if (!data || typeof data !== 'object') return null;
  const id =
    data.conversation?.id ??
    data.data?.conversation?.id ??
    data.data?.id ??
    data.id;
  return id != null && id !== '' ? String(id) : null;
}

export async function createConversation(title) {
  const res = await authFetch(`${API_BASE}/api/chats/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(title ? { title } : {}),
  });
  return handleJsonResponse(res, 'Failed to create conversation');
}

// Dedupes concurrent callers (e.g. React 18 Strict Mode double-mount of /chat/new).
let _createConversationInflight = null;

/**
 * Single in-flight create for "new chat redirect" routes — avoids duplicate rows when
 * Strict Mode runs the effect twice in development.
 */
export function createConversationForNewChatRedirect() {
  if (_createConversationInflight) return _createConversationInflight;
  _createConversationInflight = createConversation('New conversation').finally(() => {
    queueMicrotask(() => {
      _createConversationInflight = null;
    });
  });
  return _createConversationInflight;
}

export async function updateConversationTitle(conversationId, title) {
  const res = await authFetch(`${API_BASE}/api/chats/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return handleJsonResponse(res, 'Failed to update conversation');
}

export async function deleteConversation(conversationId) {
  const res = await authFetch(`${API_BASE}/api/chats/conversations/${conversationId}`, {
    method: 'DELETE',
  });
  return handleJsonResponse(res, 'Failed to delete conversation');
}

export async function listMessages(conversationId, { limit = 100, beforeId } = {}) {
  const q = new URLSearchParams();
  if (limit != null) q.set('limit', String(limit));
  if (beforeId) q.set('before_id', beforeId);
  const res = await authFetch(
    `${API_BASE}/api/chats/conversations/${conversationId}/messages?${q.toString()}`
  );
  return handleJsonResponse(res, 'Failed to list messages');
}

export async function appendMessage(conversationId, { role, content, metadata }) {
  const res = await authFetch(`${API_BASE}/api/chats/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, content, metadata }),
  });
  return handleJsonResponse(res, 'Failed to save message');
}

