import React, { useState, useEffect } from 'react';
import SettingsLayout from '../../components/dashboard/SettingsLayout';
import { getTenantProfile, normalizeTenantProfile, saveBrandingProfile } from '../../api/tenantSettings';
import { useBranding } from '../../utils/BrandingContext';
import { buildPortalUrl, ROOT_DOMAIN } from '../../utils/tenantHost';

function slugify(str) {
    return (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function PortalLinkPanel({ tenantName, tenantType }) {
    const [copied, setCopied] = useState(false);
    const slug = slugify(tenantName);
    if (tenantType !== 'white_label' || !slug) return null;

    const portalUrl = buildPortalUrl(slug);

    const handleCopy = () => {
        navigator.clipboard.writeText(portalUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="bg-background-surface rounded-lg shadow border border-primary-500 overflow-hidden">
            <div className="px-6 py-4 border-b border-border-default bg-primary-soft">
                <h2 className="text-lg font-semibold text-primary-500">White-Label Portal Link</h2>
                <p className="text-sm text-text-muted mt-0.5">
                    Share this URL with your end users. Served via the platform wildcard <span className="font-mono">*.{ROOT_DOMAIN}</span>.
                </p>
            </div>
            <div className="p-6 space-y-3">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        readOnly
                        value={portalUrl}
                        className="flex-1 px-3 py-2 border border-border-default rounded-lg text-sm bg-background-subtle font-mono text-text-primary select-all"
                        onFocus={(e) => e.target.select()}
                    />
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-text-inverse text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                    >
                        {copied ? 'Copied!' : 'Copy link'}
                    </button>
                    <a
                        href={portalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 border border-border-default hover:bg-background-subtle text-text-primary text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                    >
                        Test
                    </a>
                </div>
                <div className="flex items-start gap-2 text-xs text-text-muted">
                    <span>Subdomain:</span>
                    <span className="font-mono bg-background-subtle px-1.5 py-0.5 rounded text-text-primary">{slug}.{ROOT_DOMAIN}</span>
                    <span className="text-text-muted">— auto-derived from tenant name. Backend resolves via <span className="font-mono">GET /api/branding?domain={slug}.{ROOT_DOMAIN}</span>.</span>
                </div>
            </div>
        </div>
    );
}

const FIELD_GROUPS = [
    {
        title: 'App Identity',
        fields: [
            { name: 'app_name', label: 'App name', type: 'text', placeholder: 'My Gov Portal', help: 'Displayed in the sidebar and browser tab.' },
            { name: 'logo_url', label: 'Logo URL', type: 'url', placeholder: 'https://cdn.example.com/logo.png', help: 'Shown in the sidebar header. Recommended: transparent PNG, max 200×60 px.' },
            { name: 'favicon_url', label: 'Favicon URL', type: 'url', placeholder: 'https://cdn.example.com/favicon.ico', help: 'Browser tab icon (.ico or .png).' },
        ],
    },
    {
        title: 'Colors',
        fields: [
            { name: 'primary_color', label: 'Primary color', type: 'color', placeholder: '#1A3C6E', help: 'Used for buttons, links, and active states.' },
            { name: 'secondary_color', label: 'Secondary color', type: 'color', placeholder: '#F5A623', help: 'Accent highlights.' },
            { name: 'accent_color', label: 'Accent / text-on-primary color', type: 'color', placeholder: '#FFFFFF', help: 'Text shown on primary-colored backgrounds.' },
        ],
    },
    {
        title: 'Login Page',
        fields: [
            { name: 'login_background_url', label: 'Login background image URL', type: 'url', placeholder: 'https://cdn.example.com/bg.jpg', help: 'Full-page background on the login screen.' },
        ],
    },
    {
        title: 'Contact & Footer',
        fields: [
            { name: 'support_email', label: 'Support email', type: 'email', placeholder: 'support@yourorg.nl', help: 'Shown to users when they need help.' },
            { name: 'footer_text', label: 'Footer text', type: 'text', placeholder: 'Municipality of Amsterdam', help: 'Short line shown in the app footer.' },
        ],
    },
];

const emptyForm = {
    tenant_name: '',
    tenant_type: 'self_managed',
    custom_domain: '',
    app_name: '',
    logo_url: '',
    favicon_url: '',
    primary_color: '',
    secondary_color: '',
    accent_color: '',
    login_background_url: '',
    support_email: '',
    footer_text: '',
};

export default function BrandingSettings() {
    const { setBranding, resetBranding } = useBranding();
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState(null);

    useEffect(() => {
        getTenantProfile()
            .then((raw) => {
                const profile = normalizeTenantProfile(raw);
                if (profile) {
                    setForm({
                        tenant_name: profile.tenant_name || '',
                        tenant_type: profile.tenant_type || 'self_managed',
                        custom_domain: profile.custom_domain || '',
                        app_name: profile.tenant_details?.app_name || '',
                        logo_url: profile.tenant_details?.logo_url || '',
                        favicon_url: profile.tenant_details?.favicon_url || '',
                        primary_color: profile.tenant_details?.primary_color || '',
                        secondary_color: profile.tenant_details?.secondary_color || '',
                        accent_color: profile.tenant_details?.accent_color || '',
                        login_background_url: profile.tenant_details?.login_background_url || '',
                        support_email: profile.tenant_details?.support_email || '',
                        footer_text: profile.tenant_details?.footer_text || '',
                    });
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSaveMessage(null);
        try {
            const payload = {
                tenant_name: form.tenant_name,
                tenant_type: form.tenant_type,
                custom_domain: form.custom_domain || undefined,
                tenant_details: {
                    app_name: form.app_name || undefined,
                    logo_url: form.logo_url || undefined,
                    favicon_url: form.favicon_url || undefined,
                    primary_color: form.primary_color || undefined,
                    secondary_color: form.secondary_color || undefined,
                    accent_color: form.accent_color || undefined,
                    login_background_url: form.login_background_url || undefined,
                    support_email: form.support_email || undefined,
                    footer_text: form.footer_text || undefined,
                },
            };
            await saveBrandingProfile(payload);
            // Reset to platform defaults for self-managed; apply custom branding for white-label
            if (form.tenant_type === 'white_label') {
                setBranding({
                    app_name: form.app_name,
                    logo_url: form.logo_url,
                    favicon_url: form.favicon_url,
                    primary_color: form.primary_color,
                    secondary_color: form.secondary_color,
                    accent_color: form.accent_color,
                    login_background_url: form.login_background_url,
                    support_email: form.support_email,
                    footer_text: form.footer_text,
                });
            } else {
                resetBranding();
            }
            setSaveMessage({ type: 'success', text: 'Branding saved. Changes are now live.' });
        } catch (err) {
            setSaveMessage({ type: 'error', text: err.message || 'Failed to save branding.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsLayout title="Branding Settings">
            <div className="max-w-3xl">
                {loading ? (
                    <div className="text-sm text-text-muted py-8">Loading branding config…</div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-8">
                        {/* Tenant Identity */}
                        <div className="bg-background-surface rounded-lg shadow border border-border-default overflow-hidden">
                            <div className="px-6 py-4 border-b border-border-default">
                                <h2 className="text-lg font-semibold text-text-primary">Tenant Identity</h2>
                                <p className="text-sm text-text-muted mt-0.5">Basic tenant info. Tenant type controls feature access.</p>
                            </div>
                            <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="tenant_name">Tenant name</label>
                                    <input
                                        id="tenant_name"
                                        name="tenant_name"
                                        type="text"
                                        value={form.tenant_name}
                                        onChange={handleChange}
                                        placeholder="Municipality of Amsterdam"
                                        className="w-full px-3 py-2 border border-border-default rounded-lg shadow-sm text-sm bg-background-surface focus:ring-primary-500 focus:border-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="tenant_type">Tenant type</label>
                                    <select
                                        id="tenant_type"
                                        name="tenant_type"
                                        value={form.tenant_type}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-border-default rounded-lg shadow-sm text-sm bg-background-surface focus:ring-primary-500 focus:border-primary-500"
                                    >
                                        <option value="self_managed">Self-managed (BYO-LLM)</option>
                                        <option value="white_label">White-label</option>
                                        <option value="managed" disabled>Managed (future tier)</option>
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-text-primary mb-1" htmlFor="custom_domain">Custom vanity domain (optional)</label>
                                    <input
                                        id="custom_domain"
                                        name="custom_domain"
                                        type="text"
                                        value={form.custom_domain}
                                        onChange={handleChange}
                                        placeholder="portal.yourorg.nl"
                                        className="w-full px-3 py-2 border border-border-default rounded-lg shadow-sm text-sm bg-background-surface focus:ring-primary-500 focus:border-primary-500"
                                    />
                                    <p className="mt-1 text-xs text-text-muted">
                                        Optional. White-label tenants are served on <span className="font-mono">{`<slug>.${ROOT_DOMAIN}`}</span> by default — set this only if you want an additional vanity domain (e.g. <span className="font-mono">portal.yourorg.nl</span>). Point your DNS CNAME to the platform frontend, and the backend will resolve it via <code className="bg-background-subtle px-1 rounded">GET /api/branding?domain=</code>.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Dynamic branding sections */}
                        {FIELD_GROUPS.map((group) => (
                            <div key={group.title} className="bg-background-surface rounded-lg shadow border border-border-default overflow-hidden">
                                <div className="px-6 py-4 border-b border-border-default">
                                    <h2 className="text-lg font-semibold text-text-primary">{group.title}</h2>
                                </div>
                                <div className="p-6 space-y-4">
                                    {group.fields.map((field) => (
                                        <div key={field.name}>
                                            <label
                                                htmlFor={field.name}
                                                className="block text-sm font-medium text-text-primary mb-1"
                                            >
                                                {field.label}
                                            </label>
                                            {field.type === 'color' ? (
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        id={field.name}
                                                        name={field.name}
                                                        type="color"
                                                        value={form[field.name] || '#1D4ED8'}
                                                        onChange={handleChange}
                                                        className="h-9 w-16 cursor-pointer rounded border border-border-default bg-background-surface p-0.5"
                                                    />
                                                    <input
                                                        name={field.name}
                                                        type="text"
                                                        value={form[field.name]}
                                                        onChange={handleChange}
                                                        placeholder={field.placeholder}
                                                        className="flex-1 px-3 py-2 border border-border-default rounded-lg shadow-sm text-sm bg-background-surface focus:ring-primary-500 focus:border-primary-500 font-mono"
                                                    />
                                                </div>
                                            ) : (
                                                <input
                                                    id={field.name}
                                                    name={field.name}
                                                    type={field.type}
                                                    value={form[field.name]}
                                                    onChange={handleChange}
                                                    placeholder={field.placeholder}
                                                    className="w-full px-3 py-2 border border-border-default rounded-lg shadow-sm text-sm bg-background-surface focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            )}
                                            {field.help && (
                                                <p className="mt-1 text-xs text-text-muted">{field.help}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Live preview strip */}
                        {(form.logo_url || form.app_name || form.primary_color) && (
                            <div className="bg-background-surface rounded-lg shadow border border-border-default overflow-hidden">
                                <div className="px-6 py-4 border-b border-border-default">
                                    <h2 className="text-lg font-semibold text-text-primary">Preview</h2>
                                </div>
                                <div className="p-6">
                                    <div
                                        className="flex items-center gap-3 px-4 py-3 rounded-lg"
                                        style={{ backgroundColor: form.primary_color || '#1D4ED8' }}
                                    >
                                        {form.logo_url && (
                                            <img
                                                src={form.logo_url}
                                                alt="Logo preview"
                                                className="h-8 max-w-[140px] object-contain"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        )}
                                        <span
                                            className="text-lg font-bold"
                                            style={{ color: form.accent_color || '#FFFFFF' }}
                                        >
                                            {form.app_name || 'Governance'}
                                        </span>
                                    </div>
                                    {form.footer_text && (
                                        <p className="mt-3 text-xs text-text-muted">{form.footer_text}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* White-label portal link — shown whenever tenant_type is white_label */}
                        <PortalLinkPanel tenantName={form.tenant_name} tenantType={form.tenant_type} />

                        {saveMessage && (
                            <div className={`p-4 rounded-lg text-sm ${saveMessage.type === 'success' ? 'bg-success-soft text-success-500 border border-success-500' : 'bg-error-soft text-error-500 border border-error-500'}`}>
                                {saveMessage.text}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-text-inverse text-sm font-medium rounded-lg shadow-sm transition-colors"
                            >
                                {saving ? 'Saving…' : 'Save branding'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </SettingsLayout>
    );
}
