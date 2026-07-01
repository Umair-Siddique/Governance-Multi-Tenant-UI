import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getBranding, getTenantProfile, normalizeTenantProfile } from '../api/tenantSettings';
import { getAccessToken } from '../api/apiClient';
import { getTenantSlugFromHost, isSubdomainRoutingUnavailable } from './tenantHost';

const BrandingContext = createContext(null);

const CACHE_KEY   = 'tenant_branding_v1'; // cached branding object
const DOMAIN_KEY  = 'tenant_domain';      // dev-only fallback for white-label slug (when subdomain routing unavailable)

const DEFAULT_FAVICON = '/Favicon.svg';

export const DEFAULT_BRANDING = {
    app_name: 'Governance',
    logo_url: '/logo.webp',
    favicon_url: null,
    primary_color: null,
    secondary_color: null,
    accent_color: null,
    login_background_url: null,
    support_email: null,
    footer_text: null,
};

// ── Active tenant slug (white-label portal) ───────────────────────────
// Resolution order:
//   1. Subdomain in hostname (<slug>.elorag.com) — production
//   2. localStorage 'tenant_domain' — dev-only fallback via /t/:slug path
export function getActiveDomain() {
    const fromHost = getTenantSlugFromHost();
    if (fromHost) return fromHost;
    try { return localStorage.getItem(DOMAIN_KEY) || null; } catch { return null; }
}
// Only used by the dev path-based /t/:slug portal. In production the
// slug is encoded in the hostname so this is a no-op storage write
// that helps OAuth callbacks (which land back on apex) reattach to
// the original tenant context.
export function setActiveDomain(domain) {
    try { localStorage.setItem(DOMAIN_KEY, domain); } catch {}
}
export function clearActiveDomain() {
    try { localStorage.removeItem(DOMAIN_KEY); } catch {}
}

// Convert tenant name → URL-safe slug ("Umair org" → "umair-org")
export function slugify(str) {
    return (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── CSS inline-var reset ───────────────────────────────────────────────
function resetInlineVars() {
    const root = document.documentElement;
    ['--color-primary-500','--color-primary-600','--color-primary-700',
     '--color-primary-soft','--tenant-primary-500','--color-text-inverse',
     '--color-primary-50','--color-primary-100','--color-primary-200',
     '--color-primary-300','--color-primary-400',
     '--tenant-secondary-500','--tenant-secondary-600'].forEach(v => root.style.removeProperty(v));
}

function resetFavicon() {
    const link = document.querySelector("link[rel~='icon']");
    if (link) link.href = DEFAULT_FAVICON;
}

// ── Branding cache ─────────────────────────────────────────────────────
function readCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}
function writeCache(branding) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(branding)); } catch {}
}
// Clears cached branding but intentionally keeps tenant_domain
// so white-label portal users don't lose their entry point on logout
export function clearBrandingCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    // Remove injected style tag so default Tailwind colors are restored
    try { document.getElementById('tenant-theme')?.remove(); } catch {}
    try { document.documentElement.removeAttribute('data-tenant-id'); } catch {}
}

// ── Color derivation helpers ───────────────────────────────────────────
function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16),
    ];
}
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
}
function darken(hex, pct) {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r * (1 - pct), g * (1 - pct), b * (1 - pct));
}
function lighten(hex, pct) {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r + (255 - r) * pct, g + (255 - g) * pct, b + (255 - b) * pct);
}

// ── DOM application ────────────────────────────────────────────────────

// Injects an explicit <style> tag so Tailwind v4's @layer cascade cannot override it.
// Unlayered stylesheet rules always beat @layer utilities regardless of specificity.
// The html[data-tenant-id="custom"] selector also raises specificity above plain utilities.
function injectTenantStyleTag(branding) {
    let el = document.getElementById('tenant-theme');
    if (!el) {
        el = document.createElement('style');
        el.id = 'tenant-theme';
        document.head.appendChild(el);
    }

    if (!branding.primary_color || !/^#[0-9A-Fa-f]{6}$/i.test(branding.primary_color.trim())) {
        el.textContent = '';
        return;
    }

    const p    = branding.primary_color.trim();
    const p600 = darken(p, 0.12);
    const p700 = darken(p, 0.25);
    const soft = lighten(p, 0.92);
    const accent = branding.accent_color && /^#[0-9A-Fa-f]{6}$/i.test(branding.accent_color.trim())
        ? branding.accent_color.trim() : null;
    // Secondary defaults to a darker shade of primary when the tenant hasn't
    // set one explicitly, so gradients still look coherent with a single color.
    const s    = branding.secondary_color && /^#[0-9A-Fa-f]{6}$/i.test(branding.secondary_color.trim())
        ? branding.secondary_color.trim() : p700;
    const s600 = darken(s, 0.12);

    // CSS custom-property overrides (used by any var() references in CSS)
    const vars = `
        :root {
            --color-primary-50:   ${lighten(p, 0.95)};
            --color-primary-100:  ${lighten(p, 0.88)};
            --color-primary-200:  ${lighten(p, 0.75)};
            --color-primary-300:  ${lighten(p, 0.55)};
            --color-primary-400:  ${lighten(p, 0.30)};
            --color-primary-500:  ${p};
            --color-primary-600:  ${p600};
            --color-primary-700:  ${p700};
            --color-primary-soft: ${soft};
            --tenant-primary-500: ${p};
            --tenant-secondary-500: ${s};
            --tenant-secondary-600: ${s600};
            ${accent ? `--color-text-inverse: ${accent};` : ''}
        }
    `;

    // Explicit utility overrides — guaranteed to beat Tailwind @layer utilities
    const S = 'html[data-tenant-id="custom"]';
    const utilities = `
        ${S} .text-primary-500                          { color: ${p}; }
        ${S} .text-primary-600                          { color: ${p600}; }
        ${S} .text-primary-700                          { color: ${p700}; }
        ${S} .bg-primary-500                            { background-color: ${p}; }
        ${S} .bg-primary-600                            { background-color: ${p600}; }
        ${S} .bg-primary-700                            { background-color: ${p700}; }
        ${S} .bg-primary-soft                           { background-color: ${soft}; }
        ${S} .border-primary-500                        { border-color: ${p}; }
        ${S} .border-primary-600                        { border-color: ${p600}; }
        ${S} .hover\\:bg-primary-500:hover              { background-color: ${p}; }
        ${S} .hover\\:bg-primary-600:hover              { background-color: ${p600}; }
        ${S} .hover\\:text-primary-500:hover            { color: ${p}; }
        ${S} .hover\\:text-primary-600:hover            { color: ${p600}; }
        ${S} .active\\:bg-primary-700:active            { background-color: ${p700}; }
        ${S} .focus\\:border-primary-500:focus          { border-color: ${p}; }
        ${S} .focus\\:ring-primary-500:focus            { --tw-ring-color: ${p}; }
        ${S} .ring-primary-500                          { --tw-ring-color: ${p}; }
        ${accent ? `${S} .text-text-inverse             { color: ${accent}; }` : ''}
        ${accent ? `${S} .bg-primary-500                { color: ${accent}; }` : ''}
    `;

    el.textContent = vars + utilities;
}

function applyBrandingCssVars(branding) {
    document.documentElement.setAttribute('data-tenant-id', 'custom');
    // Also set via style.setProperty as belt-and-suspenders for any direct var() usages
    const root = document.documentElement;
    if (branding.primary_color && /^#[0-9A-Fa-f]{6}$/i.test(branding.primary_color.trim())) {
        const p = branding.primary_color.trim();
        const p700 = darken(p, 0.25);
        root.style.setProperty('--color-primary-500',  p);
        root.style.setProperty('--color-primary-600',  darken(p, 0.12));
        root.style.setProperty('--color-primary-700',  p700);
        root.style.setProperty('--color-primary-soft', lighten(p, 0.92));
        root.style.setProperty('--tenant-primary-500', p);
        const s = branding.secondary_color && /^#[0-9A-Fa-f]{6}$/i.test(branding.secondary_color.trim())
            ? branding.secondary_color.trim() : p700;
        root.style.setProperty('--tenant-secondary-500', s);
        root.style.setProperty('--tenant-secondary-600', darken(s, 0.12));
    }
    if (branding.accent_color) root.style.setProperty('--color-text-inverse', branding.accent_color);
    // The style tag is the real override — inject it last
    injectTenantStyleTag(branding);
}

function applyFaviconAndTitle(branding) {
    if (branding.favicon_url) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = branding.favicon_url;
    }
    if (branding.app_name && branding.app_name !== DEFAULT_BRANDING.app_name) {
        document.title = branding.app_name;
    }
}

function applyAll(branding) {
    applyBrandingCssVars(branding);
    applyFaviconAndTitle(branding);
}

// ── Extract branding from authenticated tenant profile ─────────────────
function extractBrandingFromProfile(profile) {
    if (!profile?.tenant_details) return null;
    const d = profile.tenant_details;
    if (!d.app_name && !d.logo_url && !d.primary_color) return null;
    return {
        app_name:             d.app_name             || DEFAULT_BRANDING.app_name,
        logo_url:             d.logo_url             || DEFAULT_BRANDING.logo_url,
        favicon_url:          d.favicon_url          || null,
        primary_color:        d.primary_color        || null,
        secondary_color:      d.secondary_color      || null,
        accent_color:         d.accent_color         || null,
        login_background_url: d.login_background_url || null,
        support_email:        d.support_email        || null,
        footer_text:          d.footer_text          || null,
    };
}

// ── Provider ───────────────────────────────────────────────────────────
export function BrandingProvider({ children }) {
    // Apply cached branding synchronously on first render — no flash
    const [branding, setBrandingState] = useState(() => {
        const cached = readCache();
        return cached ? { ...DEFAULT_BRANDING, ...cached } : DEFAULT_BRANDING;
    });
    const [loaded, setLoaded] = useState(false);

    // Apply CSS vars from cache immediately before server round-trip
    useEffect(() => {
        const cached = readCache();
        if (cached) applyAll({ ...DEFAULT_BRANDING, ...cached });
    }, []);

    const applyAndStore = useCallback((incoming) => {
        const merged = { ...DEFAULT_BRANDING, ...incoming };
        setBrandingState(merged);
        applyAll(merged);
        writeCache(merged);
    }, []);

    const resetBranding = useCallback(() => {
        clearBrandingCache();
        clearActiveDomain();
        resetInlineVars();
        resetFavicon();
        document.title = DEFAULT_BRANDING.app_name;
        setBrandingState(DEFAULT_BRANDING);
    }, []);

    const fetchFromServer = useCallback(async () => {
        try {
            // Priority 1: tenant subdomain (<slug>.elorag.com) — production white-label
            // Priority 2: stored slug from dev /t/:slug portal — localhost fallback
            // Priority 3: bare hostname — real custom-domain deployments
            const slugFromHost = getTenantSlugFromHost();
            const activeDomain = slugFromHost || getActiveDomain() || window.location.hostname;
            const domainData = await getBranding(activeDomain);

            if (domainData && Object.keys(domainData).length > 0) {
                applyAndStore(domainData);
                return;
            }

            // Priority 4: authenticated tenant profile (apex / Vercel preview fallback)
            const token = getAccessToken();
            if (!token) return;

            const raw = await getTenantProfile().catch(() => null);
            if (!raw || raw.notFound) return;

            const profile = normalizeTenantProfile(raw);

            if (profile?.tenant_type === 'white_label' && profile.tenant_name) {
                const slug = slugify(profile.tenant_name);
                // Persist for dev path-based portal; harmless in production
                if (slug && isSubdomainRoutingUnavailable()) setActiveDomain(slug);
                const tenantBranding = extractBrandingFromProfile(profile);
                if (tenantBranding) applyAndStore(tenantBranding);
            } else if (profile) {
                // Non-white-label: restore platform defaults
                clearActiveDomain();
                clearBrandingCache();
                resetInlineVars();
                resetFavicon();
                document.title = DEFAULT_BRANDING.app_name;
                setBrandingState(DEFAULT_BRANDING);
            }
        } catch {
            // Fall through — cached / default branding already shown
        } finally {
            setLoaded(true);
        }
    }, [applyAndStore]);

    useEffect(() => { fetchFromServer(); }, [fetchFromServer]);

    const setBranding    = useCallback((incoming) => applyAndStore(incoming), [applyAndStore]);
    const refreshBranding = useCallback(() => fetchFromServer(), [fetchFromServer]);

    return (
        <BrandingContext.Provider value={{ branding, setBranding, refreshBranding, resetBranding, loaded }}>
            {children}
        </BrandingContext.Provider>
    );
}

export function useBranding() {
    const ctx = useContext(BrandingContext);
    if (!ctx) return { branding: DEFAULT_BRANDING, setBranding: () => {}, refreshBranding: () => Promise.resolve(), resetBranding: () => {}, loaded: true };
    return ctx;
}
