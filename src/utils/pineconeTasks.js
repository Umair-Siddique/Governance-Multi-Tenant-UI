// utils/pineconeTasks.js
const STORAGE_KEY = 'pinecone-document-tracking';

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toStringOrEmpty(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    return '';
}

export function loadPineconeTrackingMap() {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return isObject(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

export function savePineconeTrackingEntry(documentId, patch) {
    if (typeof window === 'undefined' || !documentId) return;
    const map = loadPineconeTrackingMap();
    const existing = isObject(map[documentId]) ? map[documentId] : {};
    map[documentId] = {
        ...existing,
        ...patch,
        documentId,
        updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getPineconeTrackingEntry(documentId) {
    const map = loadPineconeTrackingMap();
    return isObject(map[documentId]) ? map[documentId] : null;
}

export function normalizeTaskStatus(taskPayload) {
    if (!isObject(taskPayload)) return 'unknown';
    const raw =
        taskPayload.status ||
        taskPayload.task_status ||
        taskPayload.state ||
        taskPayload?.data?.status ||
        taskPayload?.task?.status ||
        'unknown';
    return toStringOrEmpty(raw).toLowerCase() || 'unknown';
}

export function isTerminalTaskStatus(status) {
    const s = toStringOrEmpty(status).toLowerCase();
    return [
        'completed',
        'succeeded',
        'success',
        'failed',
        'error',
        'cancelled',
        'unknown',
        // NOTE: 'pending' is NOT terminal — polling must continue
    ].includes(s);
}

export function extractPineconeId(taskPayload) {
    if (!isObject(taskPayload)) return '';

    const direct =
        taskPayload.pinecone_id ||
        taskPayload.pineconeId ||
        taskPayload.vector_id ||
        taskPayload.vectorId ||
        taskPayload?.result?.pinecone_id ||
        taskPayload?.result?.pineconeId ||
        taskPayload?.data?.pinecone_id ||
        taskPayload?.data?.pineconeId ||
        taskPayload?.metadata?.pinecone_id ||
        taskPayload?.metadata?.pineconeId ||
        '';

    if (direct) return toStringOrEmpty(direct);

    const upsertedIds =
        taskPayload.upserted_ids ||
        taskPayload?.result?.upserted_ids ||
        taskPayload?.data?.upserted_ids ||
        [];

    if (Array.isArray(upsertedIds) && upsertedIds.length > 0) {
        return toStringOrEmpty(upsertedIds[0]);
    }

    return '';
}

// NOTE: intentionally does NOT fall back to entry.id —
// that field is a document ID, not a task ID.
function toTaskPair(entry, fallbackDocumentIds) {
    if (!isObject(entry)) return null;

    const taskId =
        toStringOrEmpty(entry.task_id) ||
        toStringOrEmpty(entry.taskId);

    if (!taskId) return null;

    const documentId =
        toStringOrEmpty(entry.document_id) ||
        toStringOrEmpty(entry.documentId) ||
        (Array.isArray(fallbackDocumentIds) && fallbackDocumentIds.length === 1
            ? toStringOrEmpty(fallbackDocumentIds[0])
            : '');

    return { documentId, taskId };
}

export function extractTaskPairsFromPublishResponse(response, fallbackDocumentIds = []) {
    if (!response) return [];

    const results = [];

    // Shape 1: { tasks: [...] }
    if (Array.isArray(response.tasks)) {
        response.tasks.forEach((taskEntry) => {
            const pair = toTaskPair(taskEntry, fallbackDocumentIds);
            if (pair) results.push(pair);
        });
    }

    // Shape 2: { data: { tasks: [...] } }
    if (Array.isArray(response.data?.tasks)) {
        response.data.tasks.forEach((taskEntry) => {
            const pair = toTaskPair(taskEntry, fallbackDocumentIds);
            if (pair) results.push(pair);
        });
    }

    // Shape 3: root object is the task itself — only when no tasks array found
    if (results.length === 0) {
        const directPair = toTaskPair(response, fallbackDocumentIds);
        if (directPair) results.push(directPair);
    }

    // Shape 4: top-level task_id — one batch task for all documents
    if (results.length === 0) {
        const taskId =
            toStringOrEmpty(response.task_id) ||
            toStringOrEmpty(response.taskId) ||
            toStringOrEmpty(response?.data?.task_id) ||
            toStringOrEmpty(response?.data?.taskId);

        if (taskId) {
            // Return ONE pair — the caller (handlePublishSelected) will
            // fan this out to all selected documents using batchTaskId fallback
            results.push({
                documentId: toStringOrEmpty(fallbackDocumentIds[0]),
                taskId,
            });
        }
    }

    // Deduplicate by documentId+taskId
    const dedupe = new Map();
    results.forEach((pair) => {
        const key = `${pair.documentId || crypto.randomUUID()}::${pair.taskId}`;
        if (!dedupe.has(key)) dedupe.set(key, pair);
    });

    return Array.from(dedupe.values());
}
