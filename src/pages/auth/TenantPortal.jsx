import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBranding } from '../../api/tenantSettings';
import { setActiveDomain, clearBrandingCache, useBranding } from '../../utils/BrandingContext';
import { isSubdomainRoutingUnavailable, ROOT_DOMAIN } from '../../utils/tenantHost';

/**
 * White-label portal entry point.
 *
 * Production: white-label tenants are served via wildcard subdomain
 *   https://<tenant-slug>.elorag.com
 * If someone lands on the apex with /t/<slug> in production, redirect them
 * to the canonical subdomain URL.
 *
 * Dev/preview (localhost, *.vercel.app): subdomain routing is impractical,
 * so this component keeps the legacy /t/:slug path-based portal working.
 */
export default function TenantPortal() {
    const { tenantSlug } = useParams();
    const navigate = useNavigate();
    const { setBranding } = useBranding();
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        if (!tenantSlug) { navigate('/', { replace: true }); return; }

        // Production: redirect /t/<slug> → <slug>.elorag.com (canonical URL)
        if (!isSubdomainRoutingUnavailable()) {
            window.location.replace(`${window.location.protocol}//${tenantSlug}.${ROOT_DOMAIN}/`);
            return;
        }

        (async () => {
            try {
                clearBrandingCache();
                setActiveDomain(tenantSlug);

                const data = await getBranding(tenantSlug);

                if (data && Object.keys(data).length > 0) {
                    setBranding(data);
                    navigate('/', { replace: true });
                } else {
                    setStatus('notfound');
                }
            } catch {
                setStatus('error');
            }
        })();
    }, [tenantSlug, navigate, setBranding]);

    if (status === 'notfound') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 auth-page-bg">
                <div className="w-full max-w-md animate-fade-in-up">
                    <div className="auth-card">
                        <div className="auth-card-accent" />
                        <div className="px-8 py-8 text-center">
                            <div className="mx-auto mb-5 h-14 w-14 rounded-2xl flex items-center justify-center"
                                 style={{ background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', border: '1px solid #FDE68A' }}>
                                <svg className="h-7 w-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Tenant not found</h2>
                            <p className="text-sm text-slate-500 mb-2">
                                No branding found for{' '}
                                <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{tenantSlug}</span>.
                            </p>
                            <p className="text-xs text-slate-400 mb-7">
                                Make sure the tenant name matches what is saved in Branding Settings, and that the backend supports{' '}
                                <span className="font-mono">GET /api/branding?name=</span>.
                            </p>
                            <button
                                onClick={() => navigate('/', { replace: true })}
                                className="btn-primary-gradient inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                            >
                                Continue to sign in
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 auth-page-bg">
                <div className="w-full max-w-md animate-fade-in-up">
                    <div className="auth-card">
                        <div className="auth-card-accent" />
                        <div className="px-8 py-8 text-center">
                            <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
                                <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M4.93 4.93l14.14 14.14" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
                            <p className="text-sm text-slate-500 mb-7">Could not load this portal. Please try again.</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="btn-primary-gradient inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 auth-page-bg">
            <div className="text-center animate-fade-in">
                <div className="relative mx-auto mb-6 h-14 w-14">
                    <div
                        className="h-14 w-14 rounded-full border-4 border-blue-100"
                        style={{ borderTopColor: '#1D4ED8', animation: 'spin 0.8s linear infinite' }}
                    />
                </div>
                <p className="text-base font-semibold text-slate-800">
                    Loading portal
                </p>
                <p className="text-sm text-slate-500 mt-1">
                    <span className="font-medium text-blue-600">{tenantSlug}</span>
                </p>
            </div>
        </div>
    );
}
