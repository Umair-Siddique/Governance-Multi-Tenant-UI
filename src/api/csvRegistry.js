/**
 * CSV Registry API client.
 *
 * Read and status management for CSV files in the registry.
 */

import { API_BASE, authFetch, handleJsonResponse } from './apiClient';

/**
 * Fetch CSV registry files, optionally by status.
 * Endpoint: GET /api/csv-registry?status=<status>
 * @param {{ status?: string }} [params]
 */
export async function getCsvRegistry(params = {}) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  const queryString = query.toString();
  const url = queryString ? `${API_BASE}/api/csv-registry?${queryString}` : `${API_BASE}/api/csv-registry`;

  const res = await authFetch(url);
  return handleJsonResponse(res, 'Failed to fetch CSV registry');
}

/**
 * Fetch a single CSV registry item.
 * Endpoint: GET /api/csv-registry/{file_id}
 * @param {string} fileId
 */
export async function getCsvRegistryItem(fileId) {
  const res = await authFetch(`${API_BASE}/api/csv-registry/${fileId}`);
  return handleJsonResponse(res, 'Failed to fetch CSV details');
}

/**
 * Update status of a single CSV registry item.
 * Endpoint: PATCH /api/csv-registry/{file_id}/status
 * @param {string} fileId
 * @param {'draft'|'review'|'approved'} status
 */
export async function updateCsvRegistryStatus(fileId, status) {
  const res = await authFetch(`${API_BASE}/api/csv-registry/${fileId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  return handleJsonResponse(res, 'Failed to update CSV status');
}

/**
 * Update metadata of a single CSV registry item.
 * Endpoint: PATCH /api/csv-registry/{file_id}
 * @param {string} fileId
 * @param {{ filename?: string, summary?: string }} payload
 */
export async function updateCsvRegistryMetadata(fileId, payload = {}) {
  const body = {};
  if (typeof payload.filename === 'string') body.filename = payload.filename;
  if (typeof payload.summary === 'string') body.summary = payload.summary;

  const res = await authFetch(`${API_BASE}/api/csv-registry/${fileId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return handleJsonResponse(res, 'Failed to update CSV metadata');
}

/**
 * Bulk reject CSV registry items.
 * Endpoint: POST /api/csv-registry/bulk-reject
 * @param {Array<string>} fileIds
 * @param {string} reason
 */
export async function bulkRejectCsvRegistry(fileIds, reason) {
  const payload = { file_ids: fileIds };
  if (typeof reason === 'string' && reason.trim()) {
    payload.reason = reason.trim();
    payload.rejection_reason = reason.trim();
  }

  const res = await authFetch(`${API_BASE}/api/csv-registry/bulk-reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res, 'Failed to bulk reject CSV files');
}
