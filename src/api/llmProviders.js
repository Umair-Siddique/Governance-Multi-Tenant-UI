/**
 * LLM Providers API client.
 *
 * CRUD operations for managing LLM provider configurations.
 * Uses centralized authFetch for automatic token refresh.
 */

import { API_BASE, authFetch, handleJsonResponse } from './apiClient';

// ── Models ────────────────────────────────────────────────

/**
 * Get the list of all supported LLM providers.
 * Endpoint: GET /api/llm-providers/supported
 * @returns {Promise<Array>} e.g. ['openai', 'mistral', 'anthropic']
 */
export async function getSupportedProviders() {
    const res = await authFetch(`${API_BASE}/api/llm-providers/supported`);
    return handleJsonResponse(res, 'Failed to fetch supported providers');
}

/**
 * Get available models for a specific LLM provider.
 * Endpoint: GET /api/llm-providers/{providerType}/models
 * @param {'openai' | 'mistral' | 'anthropic' | string} providerType
 * @returns {Promise<Array>} list of model objects/strings
 */
export async function getProviderModels(providerType) {
    const res = await authFetch(`${API_BASE}/api/llm-providers/${providerType}/models`);
    return handleJsonResponse(res, `Failed to fetch models for ${providerType}`);
}

// ── CRUD ────────────────────────────────────────────────

/**
 * Create a new LLM provider.
 * @param {{ provider_type: string, api_key: string, default_model: string, name: string, is_active: boolean }} payload
 */
export async function createLLMProvider(payload) {
    const res = await authFetch(`${API_BASE}/api/llm-providers`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return handleJsonResponse(res, 'Failed to create LLM provider');
}

/**
 * List all LLM providers for the current tenant.
 * @returns {Promise<Array>}
 */
export async function getLLMProviders() {
    const res = await authFetch(`${API_BASE}/api/llm-providers`);
    return handleJsonResponse(res, 'Failed to fetch LLM providers');
}

/**
 * Get a single LLM provider by ID.
 * @param {string} id
 */
export async function getLLMProvider(id) {
    const res = await authFetch(`${API_BASE}/api/llm-providers/${id}`);
    return handleJsonResponse(res, 'Failed to fetch LLM provider');
}

/**
 * Update an existing LLM provider.
 * @param {string} id
 * @param {{ name?: string, default_model?: string, is_active?: boolean, api_key?: string }} payload
 */
export async function updateLLMProvider(id, payload) {
    const res = await authFetch(`${API_BASE}/api/llm-providers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    return handleJsonResponse(res, 'Failed to update LLM provider');
}

/**
 * Delete an LLM provider.
 * @param {string} id
 */
export async function deleteLLMProvider(id) {
    const res = await authFetch(`${API_BASE}/api/llm-providers/${id}`, {
        method: 'DELETE',
    });
    return handleJsonResponse(res, 'Failed to delete LLM provider');
}
