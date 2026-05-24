/**
 * Centralized API client with auto-refresh token support.
 *
 * All authenticated API modules should use `authFetch()` instead of raw `fetch()`.
 * On a 401 response the client will:
 *   1. Attempt to refresh the access token using the stored refresh token.
 *   2. Retry the original request once with the new token.
 *   3. If refresh fails → clear tokens and redirect to login.
 */

// ── Base URL ────────────────────────────────────────────
// Both Vite dev proxy and Vercel rewrites handle /auth and /api routing
// to the backend, so we always use relative URLs.
export const API_BASE = '';

// ── JWT helpers ─────────────────────────────────────────

function decodeJwtExp(token) {
    try {
        const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(b64));
        return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
        return null;
    }
}

/**
 * Returns true only when the token definitely has an 'exp' claim that is in the past.
 * If the token cannot be decoded or has no exp, returns false (assume valid).
 */
function isTokenExpired(token) {
    if (!token) return true;
    const exp = decodeJwtExp(token);
    if (exp === null) return false;
    return exp * 1000 < Date.now();
}

// Prevent concurrent session-expired redirects
let _sessionExpiredRedirectPending = false;

// ── Token Storage Keys ──────────────────────────────────
const ACCESS_TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const STORAGE_MODE_KEY = 'authStorageMode'; // 'persistent' or 'session'

// ── Token Helpers ───────────────────────────────────────

function getStorage() {
    const mode = localStorage.getItem(STORAGE_MODE_KEY);
    return mode === 'session' ? sessionStorage : localStorage;
}

export function getAccessToken() {
    // Check both storages (sessionStorage first, then localStorage)
    return sessionStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Extract and store tokens from a backend/Supabase response.
 * @param {object} data - The response data containing tokens
 * @param {boolean} persistent - If true, store in localStorage (Remember Me). If false, use sessionStorage.
 */
export function storeTokens(data, persistent = true) {
    if (!data || typeof data !== 'object') return;

    const storage = persistent ? localStorage : sessionStorage;

    // Track which storage mode is being used
    localStorage.setItem(STORAGE_MODE_KEY, persistent ? 'persistent' : 'session');

    // Access token — try all known field name variants
    const access =
        data.token ||
        data.access_token ||
        data.accessToken ||
        data.jwt ||
        data.session?.access_token ||
        data.session?.accessToken ||
        data.data?.session?.access_token ||
        data.data?.session?.accessToken ||
        data.data?.access_token ||
        data.data?.token ||
        null;

    // Refresh token — try all known field name variants
    const refresh =
        data.refresh_token ||
        data.refreshToken ||
        data.session?.refresh_token ||
        data.session?.refreshToken ||
        data.data?.session?.refresh_token ||
        data.data?.session?.refreshToken ||
        data.data?.refresh_token ||
        data.data?.refreshToken ||
        null;

    if (access) storage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) storage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(STORAGE_MODE_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ── Shared Utilities ────────────────────────────────────

export function getAuthHeaders() {
    const token = getAccessToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Parse JSON from a response and throw on non-ok status.
 */
export async function handleJsonResponse(res, fallbackErrorMessage) {
    let data = null;
    try {
        data = await res.json();
    } catch {
        // ignore parse errors; data stays null
    }

    if (!res.ok) {
        const message = (data && (data.message || data.error)) || res.statusText || fallbackErrorMessage;
        throw new Error(message || fallbackErrorMessage);
    }

    return data || {};
}

// ── Token Refresh ───────────────────────────────────────

let refreshPromise = null; // prevent concurrent refresh calls

async function refreshAccessToken() {
    // If a refresh is already in flight, wait for it
    if (refreshPromise) return refreshPromise;

    const refresh = getRefreshToken();
    if (!refresh) return false;

    refreshPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refresh }),
                credentials: 'include',
            });

            if (!res.ok) return false;

            const data = await res.json().catch(() => null);
            if (data) {
                storeTokens(data);
                return true;
            }
            return false;
        } catch {
            return false;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

// ── authFetch ───────────────────────────────────────────

/**
 * Authenticated fetch wrapper.
 *
 * Usage:  const res = await authFetch('/api/llm-providers');
 *         const data = await handleJsonResponse(res, 'Failed to fetch');
 *
 * - Automatically injects Authorization header.
 * - On 401: attempts token refresh, then retries once.
 * - On refresh failure: clears tokens and redirects to login.
 */
export async function authFetch(url, options = {}) {
    // Merge auth headers
    const authHeaders = getAuthHeaders();
    
    // If the body is FormData, browser needs to set Content-Type with boundary automatically.
    if (options.body instanceof FormData) {
        delete authHeaders['Content-Type'];
    }

    const headers = {
        ...authHeaders,
        ...options.headers,
    };

    let res = await fetch(url, {
        ...options,
        headers,
        credentials: options.credentials || 'include',
    });

    // If 401 → only attempt refresh when the token is actually expired.
    // A 401 on a still-valid token is a permission/role issue — do NOT kill the session.
    if (res.status === 401) {
        const currentToken = getAccessToken();

        // If the stored token is NOT expired, this is a backend permission/role rejection,
        // not a session expiry. Return the 401 so the calling component can handle it
        // without blowing up the user's session.
        if (currentToken && !isTokenExpired(currentToken)) {
            return res;
        }

        const refreshed = await refreshAccessToken();

        if (refreshed) {
            // Retry original request with the new access token
            const retryAuthHeaders = getAuthHeaders();
            if (options.body instanceof FormData) {
                delete retryAuthHeaders['Content-Type'];
            }
            const retryHeaders = {
                ...retryAuthHeaders,
                ...options.headers,
            };
            res = await fetch(url, {
                ...options,
                headers: retryHeaders,
                credentials: options.credentials || 'include',
            });
        } else {
            // Refresh failed (or no refresh token) — session is genuinely dead.
            // Only redirect once, even if multiple requests fail simultaneously.
            if (!_sessionExpiredRedirectPending && typeof window !== 'undefined') {
                _sessionExpiredRedirectPending = true;
                clearTokens();
                const slug = localStorage.getItem('tenant_domain');
                const loginPath = slug ? `/t/${slug}/` : '/';
                const currentPath = window.location.pathname;
                const alreadyOnAuth = currentPath === loginPath
                    || currentPath === '/'
                    || currentPath.startsWith('/auth/')
                    || currentPath.startsWith('/register')
                    || currentPath.startsWith('/forgot-password')
                    || currentPath.startsWith('/reset-password')
                    || currentPath.startsWith('/accept-invite');
                if (!alreadyOnAuth) {
                    // Show "session expired" only when there was a token that failed to refresh.
                    // If no token existed at all, just go to login without the expired param.
                    window.location.href = currentToken
                        ? `${loginPath}?session=expired`
                        : loginPath;
                } else {
                    _sessionExpiredRedirectPending = false;
                }
            }
        }
    }

    return res;
}
