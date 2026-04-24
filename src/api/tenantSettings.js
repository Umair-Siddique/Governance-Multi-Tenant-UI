/**
 * Tenant Settings API — backend contract
 *
 * Rules for backend implementation:
 * - Keys MUST be encrypted at rest (e.g. envelope encryption with KMS).
 * - Keys MUST be used server-side only; never return raw keys to the client.
 * - Keys MUST be isolated per tenant (tenant_id in all queries).
 * - Platform does not pay tenant usage costs (BYO-Key); usage is billed to tenant's provider account.
 *
 * Endpoints to implement:
 * - GET  /api/tenant/settings     → { tenantType, llmProvider, llmKeySet, ocrProvider, ocrKeySet } (no key values)
 * - PUT  /api/tenant/settings     → body: { tenantType?, llmProvider?, llmApiKey?, ocrProvider?, ocrApiKey? }; keys encrypted and stored
 * - POST /api/tenant/test-key     → body: { type: 'llm' | 'ocr' }; server uses stored key to run a minimal test; returns { success, message }
 */

import { API_BASE, authFetch, handleJsonResponse, getAuthHeaders } from './apiClient';

export async function getTenantSettings() {
    // TODO: replace with real fetch when backend exists
    const res = await authFetch(`${API_BASE}/api/tenant/settings`).catch(() => null);
    if (!res?.ok) {
        return {
            tenantType: 'self_managed',
            llmProvider: '',
            llmKeySet: false,
            ocrProvider: 'none',
            ocrKeySet: false,
        };
    }
    return res.json();
}

export async function updateTenantSettings(payload) {
    // payload: { tenantType?, llmProvider?, llmApiKey?, ocrProvider?, ocrApiKey? }
    // Backend must: encrypt keys, store by tenant_id, never return keys
    const res = await authFetch(`${API_BASE}/api/tenant/settings`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    }).catch(() => null);
    if (!res?.ok) {
        const err = res ? await res.json().catch(() => ({})) : {};
        throw new Error(err.message || res?.statusText || 'Failed to save settings');
    }
    return res.json();
}

export async function testTenantKey(type) {
    // type: 'llm' | 'ocr' — server uses stored key for tenant to run minimal test
    const res = await authFetch(`${API_BASE}/api/tenant/test-key`, {
        method: 'POST',
        body: JSON.stringify({ type }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) throw new Error(data.message || res?.statusText || 'Test failed');
    return data; // { success, message }
}

// Normalize tenant profile from API (handles different response structures)
export function normalizeTenantProfile(p) {
    if (!p || p.notFound) return null;
    // API returns { message, tenant: { ... } } — unwrap if needed
    const data = p.tenant || p;
    if (!data || (!data.tenant_name && !data.tenantName)) return null;
    const details = data.tenant_details || data.tenantDetails || {};
    return {
        tenant_name: data.tenant_name ?? data.tenantName ?? '',
        tenant_type: data.tenant_type ?? data.tenantType ?? 'self_managed',
        tenant_details: {
            country: details.country ?? '',
            contact_email: details.contact_email ?? details.contactEmail ?? '',
            department: details.department ?? '',
        }
    };
}


// Create a new tenant (called after email confirmation)
// Endpoint: POST /api/tenants/profile (confirmed from Postman collection)
export async function createTenant({ tenant_name, tenant_type, country, contact_email, department, organization_type }) {
    // Explicitly add Authorization header just in case authFetch is missing it for some reason
    // or if the token is formatted incorrectly.
    const res = await authFetch(`${API_BASE}/api/tenants/profile`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            tenant_name,
            tenant_type,
            tenant_details: { country, contact_email, department, organization_type },
        }),
    }).catch(() => null);

    if (!res?.ok) {
        const err = res ? await res.json().catch(() => ({})) : {};
        throw new Error(err.message || res?.statusText || 'Failed to create tenant');
    }

    // Parse JSON if available, but don't throw if body is empty/non-JSON
    return res.json().catch(() => ({}));
}

// Get tenant profile (used after auth to determine if tenant setup is required)
export async function getTenantProfile() {
    let res;
    try {
        res = await authFetch(`${API_BASE}/api/tenants/profile`);
    } catch (e) {
        // Network-level error (DNS, offline, CORS preflight failure, etc.)
        throw new Error('Network error while fetching tenant profile');
    }

    if (res.status === 404) {
        return { notFound: true };
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || res.statusText || 'Failed to fetch tenant profile');
    }

    return res.json();
}
