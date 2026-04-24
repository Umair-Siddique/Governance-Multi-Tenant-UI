/**
 * Invitations API client.
 *
 * CRUD operations for managing team invitations.
 * Uses centralized authFetch for automatic token refresh.
 */

import { API_BASE, authFetch, handleJsonResponse } from './apiClient';

// ── API Methods ────────────────────────────────────────

/**
 * Fetch all pending invitations for the current workspace/tenant.
 * @returns {Promise<Array>} List of invitations
 */
export async function getInvitations() {
    const res = await authFetch(`${API_BASE}/api/invitations`);
    return handleJsonResponse(res, 'Failed to fetch invitations');
}

/**
 * Send a new invitation.
 * @param {{ email: string, role: string }} payload 
 */
export async function sendInvitation(payload) {
    const res = await authFetch(`${API_BASE}/api/invitations`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return handleJsonResponse(res, 'Failed to send invitation');
}

/**
 * Resend an existing invitation.
 * @param {string} id The invitation ID
 */
export async function resendInvitation(id) {
    const res = await authFetch(`${API_BASE}/api/invitations/${id}/resend`, {
        method: 'POST',
    });
    return handleJsonResponse(res, 'Failed to resend invitation');
}

/**
 * Revoke or cancel a pending invitation.
 * @param {string} id The invitation ID
 */
export async function revokeInvitation(id) {
    const res = await authFetch(`${API_BASE}/api/invitations/${id}`, {
        method: 'DELETE',
    });
    return handleJsonResponse(res, 'Failed to revoke invitation');
}
