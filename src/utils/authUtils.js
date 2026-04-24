import { getAccessToken } from '../api/apiClient';

/**
 * Helper to decode a JWT token payload
 * @param {string} token 
 * @returns {object|null}
 */
export function decodeJwt(token) {
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Failed to decode JWT:', e);
        return null;
    }
}

/**
 * Extracts the user role from the access token. 
 * Defaults to 'user' if not found.
 * @returns {string} e.g. 'admin', 'editor', 'reviewer', 'user'
 */
export function getUserRole() {
    const token = getAccessToken();
    if (!token) return 'user';

    const payload = decodeJwt(token);
    if (!payload) return 'user';

    // Typically Supabase stores roles in user_metadata or app_metadata
    // Check both locations and convert to lowercase for easy comparison
    let role = payload.user_metadata?.role || payload.app_metadata?.role;
    
    // Sometimes role might just be at the top level in custom JWTs
    if (!role && payload.role && typeof payload.role === 'string' && payload.role !== 'authenticated') {
        role = payload.role;
    }

    if (!role) return 'user';

    return role.toLowerCase();
}

/**
 * Determines the correct default dashboard route for a given role.
 * @param {string} role 
 * @returns {string} Route path
 */
export function getDashboardRouteForRole(role) {
    switch (role?.toLowerCase()) {
        case 'admin':
            return '/dashboard';
        case 'editor':
            return '/editor/dashboard';
        case 'reviewer':
            return '/reviewer/dashboard';
        case 'user':
        default:
            return '/user/chat';
    }
}
