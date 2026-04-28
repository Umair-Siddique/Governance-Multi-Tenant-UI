/**
 * Retriever SSE stream: POST /api/retriever/stream
 * Accept: text/event-stream; JSON body or multipart when files are attached.
 */

import { API_BASE, authFetch } from './apiClient';

/**
 * @typedef {object} RetrieverStreamHandlers
 * @property {(data: object) => void} [onStatus] — stage / heartbeat updates
 * @property {(data: object) => void} [onPlan] — planner output
 * @property {(chunk: string, raw: object) => void} [onContent] — streamed answer tokens
 * @property {(data: object) => void} [onDone] — stream finished
 */

/**
 * @param {object} opts
 * @param {string} opts.query
 * @param {number} [opts.top_k]
 * @param {File[]} [opts.files] — each sent as form field `file` (same as curl -F "file=@...")
 * @param {AbortSignal} [opts.signal]
 * @param {RetrieverStreamHandlers} opts.handlers
 */
export async function streamRetriever({ query, top_k = 8, files = [], signal, handlers = {} }) {
  const url = `${API_BASE}/api/retriever/stream`;
  const list = Array.isArray(files) ? files : [];
  const hasFiles = list.length > 0;

  /** @type {Record<string, string>} */
  const headers = { Accept: 'text/event-stream' };

  /** @type {RequestInit} */
  const init = {
    method: 'POST',
    headers,
    signal,
    credentials: 'include',
  };

  if (hasFiles) {
    const fd = new FormData();
    fd.append('query', query);
    fd.append('top_k', String(top_k));
    list.forEach((f) => fd.append('file', f));
    init.body = fd;
  } else {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify({ query, top_k });
  }

  const res = await authFetch(url, init);

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const errBody = await res.clone().json();
      message = errBody.message || errBody.error || message;
    } catch {
      try {
        const t = await res.clone().text();
        if (t) message = t.slice(0, 200);
      } catch {
        /* ignore */
      }
    }
    throw new Error(message);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  /** @param {string} block */
  function processBlock(block) {
    const lines = block.split(/\r?\n/);
    let eventName = '';
    const dataParts = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataParts.push(line.slice(5).replace(/^\s/, ''));
      }
    }

    if (dataParts.length === 0) return;

    const rawData = dataParts.join('\n');
    let data;
    try {
      data = JSON.parse(rawData);
    } catch {
      return;
    }

    dispatchEvent(eventName, data, handlers);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (part.trim()) processBlock(part);
      }
    }

    if (buffer.trim()) {
      processBlock(buffer);
    }
  } finally {
    reader.releaseLock?.();
  }
}

/**
 * @param {string} eventName
 * @param {object} data
 * @param {RetrieverStreamHandlers} handlers
 */
function dispatchEvent(eventName, data, handlers = {}) {
  const type = data.type;

  if (type === 'content') {
    const chunk = typeof data.message === 'string' ? data.message : '';
    handlers.onContent?.(chunk, data);
    return;
  }

  if (type === 'done') {
    handlers.onDone?.(data);
    return;
  }

  if (type === 'status') {
    handlers.onStatus?.(data);
    return;
  }

  if (eventName === 'plan' || (data.search_query !== undefined && data.retrieval_mode !== undefined)) {
    handlers.onPlan?.(data);
    return;
  }

  if (eventName === 'status' || data.stage !== undefined) {
    handlers.onStatus?.(data);
    return;
  }
}
