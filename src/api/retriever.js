/**
 * Tenant RAG retriever — SSE stream.
 *
 * Backend: app.register_blueprint(retriever_bp, url_prefix="/api")
 *          @retriever_bp.route("/retriever/stream", methods=["POST"])
 * Full URL: POST /api/retriever/stream
 *
 * Request modes:
 * - JSON: { "query"|"question", "top_k" } (no files)
 * - multipart/form-data: fields `query` or `question`, optional `top_k`, repeated `file` parts
 *
 * Events: status, plan, token, done, error
 */

import { API_BASE, getAccessToken } from './apiClient';

// Verify the correct module is loaded in the browser bundle.
// This logs once on app startup; check DevTools Console.
try {
    console.log('[retriever-debug] module-loaded', {
        ts: new Date().toISOString(),
        origin: typeof window !== 'undefined' ? window.location.origin : 'n/a',
    });
    if (typeof window !== 'undefined') {
        window.__retrieverDebugLoaded = true;
        // Emit an event so UI can confirm this module is actually running,
        // even if DevTools console is closed/filtered.
        window.dispatchEvent(
            new CustomEvent('retriever:debug', {
                detail: {
                    ts: new Date().toISOString(),
                    streamId: 'bootstrap',
                    phase: 'module-loaded',
                },
            })
        );
    }
} catch {
    /* ignore */
}

function emitRetrieverDebug(streamId, phase, payload = {}) {
    try {
        const entry = {
            ts: new Date().toISOString(),
            streamId,
            phase,
            ...payload,
        };
        // Always visible in browser console (unlike debug/info filters).
        console.log('[retriever-debug]', entry);
        // Keep a rolling in-memory log for manual inspection from DevTools:
        // window.__retrieverLogs
        if (typeof window !== 'undefined') {
            if (!Array.isArray(window.__retrieverLogs)) window.__retrieverLogs = [];
            window.__retrieverLogs.push(entry);
            if (window.__retrieverLogs.length > 500) {
                window.__retrieverLogs.splice(0, window.__retrieverLogs.length - 500);
            }
            window.dispatchEvent(new CustomEvent('retriever:debug', { detail: entry }));
        }
    } catch {
        /* ignore */
    }
}

/** @param {unknown} files */
function normalizeFiles(files) {
    if (!files) return [];
    if (Array.isArray(files)) return files.filter((f) => f instanceof File);
    if (typeof FileList !== 'undefined' && files instanceof FileList) {
        return Array.from(files).filter((f) => f instanceof File);
    }
    return [];
}

/**
 * @param {string} block Raw SSE event block (lines separated by \n)
 * @returns {{ event: string, data: object }}
 */
function parseSSEBlock(block) {
    // Normalize CRLF → LF so parsing works across platforms/proxies.
    const normalized = (block || '').replace(/\r\n/g, '\n');
    let eventName = 'message';
    const dataLines = [];
    for (const line of normalized.split('\n')) {
        if (!line || line.startsWith(':')) continue;
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const field = line.slice(0, idx).trim();
        let value = line.slice(idx + 1);
        if (value.startsWith(' ')) value = value.slice(1);
        if (field === 'event') eventName = value.trim();
        else if (field === 'data') dataLines.push(value);
    }
    const dataStr = dataLines.join('\n');
    let data = {};
    try {
        data = dataStr ? JSON.parse(dataStr) : {};
    } catch {
        data = { _raw: dataStr };
    }
    return { event: eventName, data };
}

async function readSseStream(res, handlers, debugCtx = {}) {
    const { onStatus, onPlan, onToken, onDone, onError } = handlers;
    const streamId = debugCtx.streamId || 'retriever-stream';
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let chunkCount = 0;
    let eventCount = 0;
    let sawFirstChunk = false;

    if (!res.body) {
        emitRetrieverDebug(streamId, 'no-response-body');
        onError?.('No response body');
        return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (done) {
                emitRetrieverDebug(streamId, 'reader-completed', {
                    elapsed_ms: Math.round(now - startedAt),
                    chunkCount,
                    eventCount,
                    trailingBufferLength: buffer.length,
                });
                break;
            }
            chunkCount += 1;
            const byteLength = value?.byteLength ?? value?.length ?? 0;
            if (!sawFirstChunk) {
                sawFirstChunk = true;
                emitRetrieverDebug(streamId, 'first-chunk', {
                    elapsed_ms: Math.round(now - startedAt),
                    chunkIndex: chunkCount,
                    byteLength,
                });
            } else {
                emitRetrieverDebug(streamId, 'chunk', {
                    elapsed_ms: Math.round(now - startedAt),
                    chunkIndex: chunkCount,
                    byteLength,
                });
            }
            buffer += decoder.decode(value, { stream: true });

            // SSE events are separated by a blank line, which may be LF or CRLF.
            const parts = buffer.split(/\r?\n\r?\n/);
            buffer = parts.pop() ?? '';

            for (const rawBlock of parts) {
                if (!rawBlock.trim()) continue;
                const { event, data } = parseSSEBlock(rawBlock);
                eventCount += 1;
                emitRetrieverDebug(streamId, 'sse-event', {
                    elapsed_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
                    eventIndex: eventCount,
                    event,
                    dataPreview:
                        event === 'token'
                            ? String(data?.text || '').slice(0, 80)
                            : JSON.stringify(data).slice(0, 160),
                });

                switch (event) {
                    case 'status':
                        onStatus?.(data);
                        break;
                    case 'plan':
                        onPlan?.(data);
                        break;
                    case 'token': {
                        const t = data?.text;
                        if (typeof t === 'string' && t) onToken?.(t);
                        break;
                    }
                    case 'done':
                        onDone?.();
                        break;
                    case 'error': {
                        const m = data?.message || 'Retriever error';
                        onError?.(m);
                        break;
                    }
                    default:
                        break;
                }
            }
        }

        if (buffer.trim()) {
            const { event, data } = parseSSEBlock(buffer);
            emitRetrieverDebug(streamId, 'trailing-buffered-event', {
                event,
                dataPreview:
                    event === 'token'
                        ? String(data?.text || '').slice(0, 80)
                        : JSON.stringify(data).slice(0, 160),
            });
            if (event === 'token' && data?.text) onToken?.(data.text);
        }
    } catch (e) {
        emitRetrieverDebug(streamId, 'stream-read-failed', { error: e?.message || String(e) });
        if (e?.name === 'AbortError') return;
        onError?.(e?.message || 'Stream read failed');
    } finally {
        reader.releaseLock?.();
    }
}

/**
 * Stream retrieval answer with SSE callbacks.
 *
 * @param {{
 *   query?: string,
 *   question?: string,
 *   top_k?: number,
 *   files?: File[] | FileList | null,
 *   signal?: AbortSignal
 * }} params
 * @param {{
 *   onStatus?: (data: object) => void,
 *   onPlan?: (data: object) => void,
 *   onToken?: (text: string) => void,
 *   onDone?: () => void,
 *   onError?: (message: string) => void,
 * }} handlers
 */
export async function streamRetrieverQuery(params, handlers = {}) {
    const { onStatus, onPlan, onToken, onDone, onError } = handlers;
    const streamId = `retriever-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const requestStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const text = (params.query || params.question || '').trim();
    if (!text) {
        onError?.('query is required');
        return;
    }

    const top_k = typeof params.top_k === 'number' ? params.top_k : 8;
    const files = normalizeFiles(params.files);
    const useMultipart = files.length > 0;

    // IMPORTANT:
    // During local dev, Vite's proxy chain can buffer SSE responses (so tokens/status
    // appear only after the stream ends). Postman/curl hit the backend directly and stream fine.
    // To preserve true streaming in-browser, bypass the dev proxy when a backend origin is configured.
    //
    // In production (same-origin), this remains a relative URL.
    const envOrigin =
        (typeof import.meta !== 'undefined' &&
            import.meta.env &&
            (import.meta.env.VITE_AUTH_BASE_URL || import.meta.env.AUTH_BASE_URL)) ||
        '';
    // Dev fallback: match vite.config.js default so local streaming works even
    // when env vars aren't set/picked up by the dev server.
    const devFallbackOrigin =
        typeof window !== 'undefined' &&
        window.location &&
        /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
            ? 'http://127.0.0.1:5001'
            : '';
    const backendOrigin = envOrigin || devFallbackOrigin;
    const url = `${backendOrigin || API_BASE}/api/retriever/stream`;

    /** @type {RequestInit} */
    const init = {
        method: 'POST',
        signal: params.signal,
        credentials: 'include',
        cache: 'no-store',
    };

    if (useMultipart) {
        const fd = new FormData();
        fd.set('query', text);
        fd.set('top_k', String(top_k));
        for (const f of files) {
            fd.append('file', f, f.name);
        }
        init.body = fd;
        init.headers = {
            Accept: 'text/event-stream',
        };
    } else {
        init.headers = {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
        };
        init.body = JSON.stringify({ query: text, top_k });
    }

    emitRetrieverDebug(streamId, 'request-start', {
        url,
        method: init.method,
        useMultipart,
        top_k,
        fileCount: files.length,
        backendOrigin,
        hasSignal: Boolean(params.signal),
    });
    onStatus?.({
        stage: 'connecting',
        message: 'Connecting to retriever stream…',
        url,
    });

    // Use a direct fetch for streaming so we match Postman/curl behavior closely:
    // - Authorization: Bearer <token>
    // - Accept: text/event-stream
    // and avoid any wrapper logic that might interfere with long-lived streams.
    const token = getAccessToken();
    const streamHeaders = {
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    // NOTE: Frontend logs are visible in the **browser DevTools console**,
    // not in the `npm run dev` terminal output.
    const res = await fetch(url, {
        ...init,
        headers: streamHeaders,
        credentials: 'omit',
    });

    if (!res.ok) {
        let msg = res.statusText || 'Retriever request failed';
        try {
            const errBody = await res.json();
            msg = errBody.error || errBody.message || msg;
        } catch {
            try {
                const t = await res.text();
                if (t) msg = t.slice(0, 200);
            } catch {
                /* ignore */
            }
        }
        onError?.(msg);
        return;
    }

    // Surface early connectivity in the UI even before the first SSE frame arrives.
    const ct = res.headers?.get?.('content-type') || '';
    const ce = res.headers?.get?.('content-encoding') || '';
    const te = res.headers?.get?.('transfer-encoding') || '';
    const elapsedToHeaders =
        Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - requestStartedAt);
    onStatus?.({
        stage: 'connected',
        message: 'Connected to retriever stream',
        content_type: ct,
        content_encoding: ce,
        transfer_encoding: te,
    });
    emitRetrieverDebug(streamId, 'response-headers', {
        elapsed_ms: elapsedToHeaders,
        status: res.status,
        ok: res.ok,
        content_type: ct,
        content_encoding: ce,
        transfer_encoding: te,
        bodyUsed: res.bodyUsed,
        url,
    });

    await readSseStream(res, { onStatus, onPlan, onToken, onDone, onError }, { streamId });
}
