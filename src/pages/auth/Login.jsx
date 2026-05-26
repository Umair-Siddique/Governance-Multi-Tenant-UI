import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { login, initiateGoogleSignIn, initiateAzureSignIn } from '../../api/auth';
import { getAccessToken, storeTokens } from '../../api/apiClient';
import { getUserRole, getDashboardRouteForRole } from '../../utils/authUtils';
import { useBranding } from '../../utils/BrandingContext';
import { getTenantSlugFromHost, isSubdomainRoutingUnavailable } from '../../utils/tenantHost';

function redirectAfterAuth(destination) {
    // On a tenant subdomain (<slug>.elorag.com), routes work at root — no prefix needed.
    if (getTenantSlugFromHost()) {
        window.location.href = destination;
        return;
    }
    // Dev fallback: /t/:slug path-based portal
    if (isSubdomainRoutingUnavailable()) {
        let slug = null;
        try { slug = localStorage.getItem('tenant_domain'); } catch {}
        if (slug && !window.location.pathname.startsWith(`/t/${slug}`)) {
            window.location.href = `/t/${slug}${destination}`;
            return;
        }
    }
    window.location.href = destination;
}

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { branding, refreshBranding } = useBranding();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const code = params.get('code');
        if (code) {
            navigate(`/auth/callback${window.location.search}`, { replace: true });
            return;
        }

        const urlToken = params.get('token') || params.get('access_token');
        if (urlToken) {
            storeTokens({ access_token: urlToken, refresh_token: params.get('refresh_token') });
            navigate(getDashboardRouteForRole(getUserRole()), { replace: true });
            return;
        }

        if (getAccessToken()) {
            navigate(getDashboardRouteForRole(getUserRole()), { replace: true });
        }
    }, [navigate]);

    const registrationMessage = location.state?.fromRegister ? 'Account created successfully. Please sign in.' : null;
    const sessionExpired = new URLSearchParams(location.search).get('session') === 'expired';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login({ email, password, rememberMe });
            await refreshBranding().catch(() => {});
            redirectAfterAuth(getDashboardRouteForRole(getUserRole()));
        } catch (err) {
            setError(err.message || 'Failed to sign in. Please check your credentials and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = () => {
        localStorage.setItem('sso_provider', 'google');
        initiateGoogleSignIn();
    };

    const handleMicrosoftSignIn = () => {
        localStorage.setItem('sso_provider', 'azure');
        initiateAzureSignIn();
    };

    const pageStyle = branding.login_background_url
        ? { backgroundImage: `url(${branding.login_background_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : null;

    return (
        <div
            className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden${!branding.login_background_url ? ' auth-page-bg' : ''}`}
            style={pageStyle || undefined}
        >
            {/* Decorative background blobs — only visible on default gradient bg */}
            {!branding.login_background_url && (
                <>
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            top: '-10%', right: '-8%',
                            width: '480px', height: '480px',
                            background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 65%)',
                        }}
                    />
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            bottom: '-12%', left: '-10%',
                            width: '420px', height: '420px',
                            background: 'radial-gradient(circle, rgba(29,78,216,0.18) 0%, transparent 65%)',
                        }}
                    />
                </>
            )}

            <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
                <div className="auth-card">
                    {/* Gradient accent bar */}
                    <div className="auth-card-accent" />

                    <div className="px-7 pt-7 pb-8">
                        {/* Logo + heading */}
                        <div className="text-center mb-6">
                            <div className="flex justify-center mb-4">
                                <img
                                    src={branding.logo_url || '/logo.webp'}
                                    alt={`${branding.app_name || 'Governance'} Logo`}
                                    className="h-11 max-w-[190px] object-contain"
                                    onError={(e) => { e.target.src = '/logo.webp'; }}
                                />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
                            <p className="text-sm text-slate-500 mt-1">Sign in to your account to continue</p>
                        </div>

                        {/* Alerts */}
                        {sessionExpired && !error && (
                            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-start gap-2 animate-fade-in">
                                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                Your session has expired. Please sign in again.
                            </div>
                        )}

                        {registrationMessage && (
                            <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-start gap-2 animate-fade-in">
                                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                {registrationMessage}
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-start gap-2 animate-fade-in">
                                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {/* SSO buttons */}
                        <div className="flex gap-2.5 mb-5">
                            <button
                                type="button"
                                onClick={handleGoogleSignIn}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                            >
                                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Google
                            </button>
                            <button
                                type="button"
                                onClick={handleMicrosoftSignIn}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                            >
                                <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23">
                                    <path fill="#f35325" d="M1 1h10v10H1z" />
                                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                                </svg>
                                Microsoft
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="relative flex items-center mb-5">
                            <div className="flex-1 border-t border-slate-200" />
                            <span className="px-3 text-xs text-slate-400 font-medium bg-white whitespace-nowrap">or continue with email</span>
                            <div className="flex-1 border-t border-slate-200" />
                        </div>

                        {/* Form */}
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all duration-200"
                                    placeholder="you@example.com"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all duration-200 pr-11"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors duration-150 focus:outline-none"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        id="remember-me"
                                        name="remember-me"
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 transition-colors"
                                    />
                                    <span className="text-sm text-slate-600">Remember me</span>
                                </label>
                                <Link to="/forgot-password" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-150">
                                    Forgot password?
                                </Link>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary-gradient w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Signing in…
                                    </>
                                ) : 'Sign in with Email'}
                            </button>
                        </form>

                        <div className="mt-5 text-center">
                            <span className="text-sm text-slate-500">Don't have an account? </span>
                            <Link to="/register" className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors duration-150">
                                Create account
                            </Link>
                        </div>
                    </div>
                </div>

                <p className="text-center text-xs text-slate-400 mt-4">
                    Protected by Governance Platform
                </p>
            </div>
        </div>
    );
}
