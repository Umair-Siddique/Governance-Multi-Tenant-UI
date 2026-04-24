/**
 * Auth API client for governance backend.
 *
 * Uses the centralized apiClient for shared utilities and token management.
 * Auth endpoints (login, register, etc.) do NOT use authFetch because they
 * are pre-authentication — they produce tokens rather than consume them.
 */

import { API_BASE, storeTokens, handleJsonResponse } from './apiClient';

// ─── Google Auth ─────────────────────────────────────────────────────────────

/**
 * Redirects the browser to the backend Google OAuth initiation endpoint.
 * Endpoint: GET /auth/google-signin
 */
export function initiateGoogleSignIn() {
    window.location.href = `${API_BASE}/auth/google-signin`;
}

/**
 * Completes the Google OAuth flow by sending the code (+ optional state) to backend.
 * Endpoint: POST /auth/google-callback
 * @param {{ code: string, state?: string }} params
 */
export async function handleGoogleCallback({ code, state }) {
    const res = await fetch(`${API_BASE}/auth/google-callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, state }),
    });

    const data = await handleJsonResponse(res, 'Google sign-in failed');
    storeTokens(data);
    return data;
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Azure Auth ──────────────────────────────────────────────────────────────

/**
 * Redirects the browser to the backend Azure OAuth initiation endpoint.
 * Endpoint: GET /auth/azure-signin
 */
export function initiateAzureSignIn() {
    window.location.href = `${API_BASE}/auth/azure-signin`;
}

/**
 * Completes the Azure OAuth flow by sending the code + state to the backend.
 * Endpoint: POST /auth/azure-callback
 * @param {{ code: string, state: string }} params
 */
export async function handleAzureCallback({ code, state }) {
    const res = await fetch(`${API_BASE}/auth/azure-callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, state }),
    });

    const data = await handleJsonResponse(res, 'Azure sign-in failed');
    storeTokens(data);
    return data;
}
// ─────────────────────────────────────────────────────────────────────────────

export async function login({ email, password, rememberMe = false }) {
    const res = await fetch(`${API_BASE}/auth/signin`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
    });

    const data = await handleJsonResponse(res, 'Failed to sign in');
    storeTokens(data, rememberMe);
    return data;
}


export async function register({ email, password }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
    });

    const data = await handleJsonResponse(res, 'Failed to register');
    return data;
}

// Forgot Password API
export async function forgotPassword({ email }) {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
        credentials: 'include',
    });
    return handleJsonResponse(res, 'Failed to send forgot password email');
}

// Reset Password API
export async function resetPassword({ password, token }) {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password }),
        credentials: 'include',
    });
    return handleJsonResponse(res, 'Failed to reset password');
}

// Accept Invite API
export async function acceptInvite({ password, fullName, token }) {
    const res = await fetch(`${API_BASE}/auth/accept-invite/${token}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, full_name: fullName }),
        credentials: 'include',
    });
    return handleJsonResponse(res, 'Failed to accept invitation');
}
