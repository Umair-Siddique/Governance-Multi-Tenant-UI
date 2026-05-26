/**
 * Tenant subdomain resolution.
 *
 * Production routing for white-label tenants is subdomain-based:
 *   <tenant-slug>.elorag.com
 *
 * Apex (elorag.com / www.elorag.com) serves the main platform login.
 * Dev (localhost / 127.0.0.1 / *.vercel.app preview) falls back to the
 * legacy /t/:slug path-based portal because wildcard subdomains are
 * impractical to test without /etc/hosts edits.
 *
 * Root domain is configurable via VITE_ROOT_DOMAIN (defaults to elorag.com).
 */

export const ROOT_DOMAIN = (import.meta?.env?.VITE_ROOT_DOMAIN || 'elorag.com').toLowerCase();

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'auth', 'mail']);

function isLocalHost(hostname) {
    return hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname.endsWith('.local')
        || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
}

function isVercelPreview(hostname) {
    return hostname.endsWith('.vercel.app');
}

/**
 * Returns the tenant slug encoded in the current hostname, or null.
 *
 * Examples (ROOT_DOMAIN = elorag.com):
 *   umair-org.elorag.com   → "umair-org"
 *   elorag.com             → null   (apex)
 *   www.elorag.com         → null   (reserved)
 *   localhost              → null   (use path-based /t/:slug in dev)
 */
export function getTenantSlugFromHost(hostname = window.location.hostname) {
    const host = (hostname || '').toLowerCase();
    if (!host || isLocalHost(host) || isVercelPreview(host)) return null;

    // Must be a subdomain of ROOT_DOMAIN
    const suffix = `.${ROOT_DOMAIN}`;
    if (!host.endsWith(suffix)) return null;

    const sub = host.slice(0, -suffix.length);
    if (!sub) return null; // apex

    // Multi-level subdomains (e.g. foo.bar.elorag.com) are not tenant portals
    if (sub.includes('.')) return null;

    if (RESERVED_SUBDOMAINS.has(sub)) return null;

    return sub;
}

/**
 * Returns the public portal URL for a given tenant slug.
 * Used by Branding Settings to show the share link.
 */
export function buildPortalUrl(slug) {
    if (!slug) return '';
    const proto = window.location.protocol === 'http:' ? 'http' : 'https';
    return `${proto}://${slug}.${ROOT_DOMAIN}`;
}

/**
 * True if the current hostname is the apex (elorag.com or www.elorag.com).
 * Apex is the main platform login surface — no tenant branding applied.
 */
export function isApexHost(hostname = window.location.hostname) {
    const host = (hostname || '').toLowerCase();
    if (!host) return false;
    return host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`;
}

/**
 * True when the app is running in an environment where subdomain routing
 * is not available — localhost dev, Vercel preview builds, IP-based hosts.
 * In these environments the legacy /t/:slug path-based portal is the
 * only way to test white-label branding.
 */
export function isSubdomainRoutingUnavailable(hostname = window.location.hostname) {
    const host = (hostname || '').toLowerCase();
    return isLocalHost(host) || isVercelPreview(host) || !host.endsWith(`.${ROOT_DOMAIN}`) && host !== ROOT_DOMAIN;
}
