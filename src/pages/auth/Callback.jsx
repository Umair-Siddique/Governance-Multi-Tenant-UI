import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTenantProfile } from '../../api/tenantSettings';
import { storeTokens } from '../../api/apiClient';
import { handleGoogleCallback, handleAzureCallback } from '../../api/auth';

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
                // Clear immediately to avoid stale provider leaking into future attempts.
                localStorage.removeItem('sso_provider');

                const oauthError = params.get('error');
                if (oauthError) {
                    throw new Error(params.get('error_description') || oauthError);
                }

                // First, check if backend already processed the code and redirected with tokens
                const tokens = extractTokenFromUrl();
                if (tokens.access_token) {
                    // Backend already exchanged the code — just store tokens
                    storeTokens(tokens);
                } else if (code && provider === 'azure') {
                    // Azure browser flow relies on backend-held PKCE verifier.
                    // Hand code back to backend GET callback so server can exchange it.
                    window.location.replace(`/auth/azure-callback?code=${encodeURIComponent(code)}`);
                    return;
                } else if (code && provider === 'google') {
                    await handleGoogleCallback({ code, state });
                } else if (code) {
                    // No provider hint — try Google first, then Azure.
                    try {
                        await handleGoogleCallback({ code, state });
                    } catch {
                        await handleAzureCallback({ code, state });
                    }
                }


                await new Promise(resolve => setTimeout(resolve, 500));

                // Fetch tenant profile to ensure it's loaded/cached, but always redirect to dashboard per requirements
                try {
                    await getTenantProfile();
                } catch (e) {
                    // ignore errors during pre-fetch
                }
                
                // Read the role and redirect correctly instead of hardcoded '/dashboard'
                const { getUserRole, getDashboardRouteForRole } = await import('../../utils/authUtils');
                navigate(getDashboardRouteForRole(getUserRole()));
            } catch (err) {
                // Show a helpful error to the user and allow retrying the check
                setError(err.message || 'Failed to sign in. Please try again.');
                setRetrying(false);
            }
        };

        processCallback();
    }, [navigate, searchParams]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-subtle">
                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-error-soft mb-4">
                        <svg className="h-6 w-6 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-text-primary">Authentication Error</h3>
                    <p className="mt-2 text-sm text-text-muted">{error}</p>
                    <p className="mt-4 text-xs text-text-muted">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-subtle">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-text-primary">Signing you in...</h2>
                <p className="mt-2 text-sm text-text-muted">Please wait while we authenticate your session.</p>
            </div>
        </div>
    );
}

