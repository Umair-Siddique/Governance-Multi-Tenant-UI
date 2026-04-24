/**
 * Documents API client.
 *
 * CRUD operations and bulk actions for managing documents.
 * Uses centralized authFetch for automatic token refresh.
 */

import { API_BASE, authFetch, handleJsonResponse } from './apiClient';

/**
 * Fetch all documents for the current tenant.
 * Endpoint: GET /api/documents
 * @param {{ status?: string }} [params] Optional query params
 * @returns {Promise<Array>} List of documents
 */
export async function getDocuments(params = {}) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    const queryString = query.toString();
    const url = queryString ? `${API_BASE}/api/documents?${queryString}` : `${API_BASE}/api/documents`;
    const res = await authFetch(url);
    return handleJsonResponse(res, 'Failed to fetch documents');
}

/**
 * Fetch a single document by ID.
 * Endpoint: GET /api/documents/{id}
 * @param {string} id The document ID
 * @returns {Promise<Object>} Document details
 */
export async function getDocument(id) {
    const res = await authFetch(`${API_BASE}/api/documents/${id}`);
    return handleJsonResponse(res, 'Failed to fetch document');
}

/**
 * Upload a new document.
 * Endpoint: POST /api/documents/upload
 * @param {FormData} formData The form data containing the file
 * @returns {Promise<Object>} Response including task ID for tracking
 */
export async function uploadDocument(formData) {
    const res = await authFetch(`${API_BASE}/api/documents/upload`, {
        method: 'POST',
        body: formData, // the browser will automatically set the correct multipart/form-data Content-Type headers
    });
    return handleJsonResponse(res, 'Failed to upload document');
}

/**
 * Delete a document by ID.
 * Endpoint: DELETE /api/documents/{id}
 * @param {string} id The document ID
 */
export async function deleteDocument(id) {
    const res = await authFetch(`${API_BASE}/api/documents/${id}`, {
        method: 'DELETE',
    });
    return handleJsonResponse(res, 'Failed to delete document');
}

/**
 * Bulk approve multiple documents.
 * Endpoint: POST /api/documents/bulk-approve
 * @param {Array<string>} documentIds List of document IDs to approve
 */
export async function bulkApproveDocuments(documentIds) {
    const payload = {};
    if (Array.isArray(documentIds) && documentIds.length > 0) {
        payload.document_ids = documentIds;
    }

    const res = await authFetch(`${API_BASE}/api/documents/bulk-approve`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    return handleJsonResponse(res, 'Failed to bulk approve documents');
}

/**
 * Bulk reject multiple documents.
 * Endpoint: POST /api/documents/bulk-reject
 * @param {Array<string>} documentIds List of document IDs to reject
 * @param {string} reason Optional rejection reason
 */
export async function bulkRejectDocuments(documentIds, reason) {
    const payload = { document_ids: documentIds };
    if (typeof reason === 'string' && reason.trim()) {
        payload.reason = reason.trim();
        payload.rejection_reason = reason.trim();
    }

    const res = await authFetch(`${API_BASE}/api/documents/bulk-reject`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    return handleJsonResponse(res, 'Failed to bulk reject documents');
}

/**
 * Update status of a single document.
 * Endpoint: PATCH /api/documents/{id}/status
 * @param {string} id Document ID
 * @param {'draft'|'review'|'approved'} status Next status
 */
export async function updateDocumentStatus(id, status) {
    const res = await authFetch(`${API_BASE}/api/documents/${id}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
    });
    return handleJsonResponse(res, 'Failed to update document status');
}

/**
 * Submit one or more documents from draft to review.
 * Endpoint: POST /api/documents/bulk-submit-review
 * @param {Array<string>} documentIds List of document IDs
 */
export async function bulkSubmitReview(documentIds) {
    const res = await authFetch(`${API_BASE}/api/documents/bulk-submit-review`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_ids: documentIds || [] }),
    });
    return handleJsonResponse(res, 'Failed to submit documents to review');
}

/**
 * Publish documents to Pinecone (vector database).
 * Endpoint: POST /api/documents/publish-to-pinecone
 * @param {Array<string>} documentIds List of document IDs to publish
 */
export async function publishToPinecone(documentIds) {
    const res = await authFetch(`${API_BASE}/api/documents/publish-to-pinecone`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_ids: documentIds }),
    });
    return handleJsonResponse(res, 'Failed to publish documents to Pinecone');
}
