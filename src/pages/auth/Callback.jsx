import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTenantProfile } from '../../api/tenantSettings';
import { storeTokens } from '../../api/apiClient';
import { handleGoogleCallback, handleAzureCallback } from '../../api/auth';
import { useBranding } from '../../utils/BrandingContext';
import { getTenantSlugFromHost, isSubdomainRoutingUnavailable, ROOT_DOMAIN } from '../../utils/tenantHost';

// Guards duplicate callback processing (e.g. StrictMode double invoke in dev).
let lastProcessedCallbackKey = null;

// Extract token from OAuth callback URL (backend may pass token or access_token)
function extractTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash?.slice(1) || '';
    const hashParams = new URLSearchParams(hash);

    return {
        access_token: params.get('token') || params.get('access_token') || params.get('accessToken')
            || hashParams.get('access_token') || hashParams.get('token') || null,
        refresh_token: params.get('refresh_token') || hashParams.get('refresh_token') || null,
    };
}

export default function Callback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState(null);
    const [retrying, setRetrying] = useState(false);
    const { refreshBranding } = useBranding();

    useEffect(() => {
        const processCallback = async () => {
            try {
                const callbackKey = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                if (lastProcessedCallbackKey === callbackKey) {
                    return;
                }
                lastProcessedCallbackKey = callbackKey;

                const params = new URLSearchParams(window.location.search);
                const code = params.get('code');
                const state = params.get('state');
                const provider = params.get('provider') || localStorage.getItem('sso_provider');
                localStorage.removeItem('sso_provider');

                const oauthError = params.get('error');
                if (oauthError) {
                    throw new Error(params.get('error_description') || oauthError);
                }

                const tokens = extractTokenFromUrl();
                if (tokens.access_token) {
                    storeTokens(tokens);
                } else if (code && provider === 'azure') {
                    window.location.replace(`/auth/azure-callback?code=${encodeURIComponent(code)}`);
                    return;
                } else if (code && provider === 'google') {
                    await handleGoogleCallback({ code, state });
                } else if (code) {
                    try {
                        await handleGoogleCallback({ code, state });
                    } catch {
                        await handleAzureCallback({ code, state });
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 500));

                await refreshBranding().catch(() => {});

                const { getUserRole, getDashboardRouteForRole } = await import('../../utils/authUtils');
                const destination = getDashboardRouteForRole(getUserRole());

                // OAuth/SSO callback URLs are usually registered on the apex domain
                // (one allowlist entry). If the user started on a tenant subdomain
                // we capture their slug in localStorage before redirecting, then
                // bounce them back to <slug>.elorag.com here.
                if (getTenantSlugFromHost()) {
                    navigate(destination);
                    return;
                }
                let storedSlug = null;
                try { storedSlug = localStorage.getItem('tenant_domain'); } catch {}
                if (storedSlug && !isSubdomainRoutingUnavailable()) {
                    window.location.href = `${window.location.protocol}//${storedSlug}.${ROOT_DOMAIN}${destination}`;
                    return;
                }
                if (storedSlug && isSubdomainRoutingUnavailable()
                    && !window.location.pathname.startsWith(`/t/${storedSlug}`)) {
                    window.location.href = `/t/${storedSlug}${destination}`;
                    return;
                }
                navigate(destination);
            } catch (err) {
                setError(err.message || 'Failed to sign in. Please try again.');
                setRetrying(false);
            }
        };

        processCallback();
    }, [navigate, searchParams]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 auth-page-bg">
                <div className="w-full max-w-sm animate-fade-in-up">
                    <div className="auth-card">
                        <div className="auth-card-accent" />
                        <div className="px-7 py-8 text-center">
                            <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
                                <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Authentication Error</h3>
                            <p className="mt-2 text-sm text-slate-500">{error}</p>
                            <p className="mt-4 text-xs text-slate-400">Redirecting to login…</p>
                            <button
                                onClick={() => navigate('/')}
                                className="btn-primary-gradient mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                            >
                                Go to Sign In
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
                <div className="relative mx-auto mb-6 h-16 w-16">
                    <div
                        className="h-16 w-16 rounded-full"
                        style={{
                            background: 'conic-gradient(from 0deg, #1D4ED8, #4338CA, #7C3AED, #1D4ED8)',
                            animation: 'spin 1s linear infinite',
                        }}
                    />
                    <div className="absolute inset-1.5 rounded-full bg-white" />
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{
                            background: 'conic-gradient(from 0deg, #1D4ED8 0deg, transparent 120deg)',
                            animation: 'spin 1s linear infinite',
                        }}
                    />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Signing you in…</h2>
                <p className="mt-2 text-sm text-slate-500">Please wait while we authenticate your session.</p>
            </div>
        </div>
    );
}
