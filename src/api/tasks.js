/**
 * Tasks API client.
 *
 * Operations for checking background task statuses.
 * Uses centralized authFetch for automatic token refresh.
 */

import { API_BASE, authFetch, handleJsonResponse } from './apiClient';

/**
 * Get the status of a specific background task.
 * Endpoint: GET /api/tasks/{id}
 * @param {string} id The task ID
 * @returns {Promise<Object>} Task details including status
 */
export async function getTask(id) {
    const res = await authFetch(`${API_BASE}/api/tasks/${id}`);
    return handleJsonResponse(res, 'Failed to fetch task status');
}
