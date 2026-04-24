import { API_BASE, authFetch, handleJsonResponse } from './apiClient';

/**
 * GET /api/user/preferences/language
 * Returns:
 * - preferred_language
 * - supported_languages
 * - default_language
 */
export async function getPreferredLanguage() {
  const res = await authFetch(`${API_BASE}/api/user/preferences/language`);
  return handleJsonResponse(res, 'Failed to get preferred language');
}

/**
 * PUT /api/user/preferences/language
 * Body: { language }
 */
export async function setPreferredLanguage(language) {
  const res = await authFetch(`${API_BASE}/api/user/preferences/language`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language }),
  });
  return handleJsonResponse(res, 'Failed to set preferred language');
}

