import { authFetch, handleJsonResponse } from './apiClient';

/**
 * @param {object} filters
 * @param {string} [filters.event_category]
 * @param {string} [filters.event_type]
 * @param {string} [filters.actor_id]
 * @param {string} [filters.target_id]
 * @param {string} [filters.from_date]
 * @param {string} [filters.to_date]
 * @param {number} [filters.page]
 * @param {number} [filters.limit]
 */
export async function getAuditLogs(filters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined && value !== '') {
            params.set(key, value);
        }
    }
    const query = params.toString();
    const res = await authFetch(`/api/audit-logs${query ? `?${query}` : ''}`);
    return handleJsonResponse(res, 'Failed to fetch audit logs');
}

/**
 * @param {object} filters
 * @param {string} [filters.event_category]
 * @param {string} [filters.from_date]
 * @param {string} [filters.to_date]
 */
export async function getAuditLogStats(filters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined && value !== '') {
            params.set(key, value);
        }
    }
    const query = params.toString();
    const res = await authFetch(`/api/audit-logs/stats${query ? `?${query}` : ''}`);
    return handleJsonResponse(res, 'Failed to fetch audit log stats');
}
