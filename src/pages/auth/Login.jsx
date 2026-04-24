import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { login, initiateGoogleSignIn, initiateAzureSignIn } from '../../api/auth';
import { getAccessToken, storeTokens } from '../../api/apiClient';
import { getUserRole, getDashboardRouteForRole } from '../../utils/authUtils';

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Handle SSO redirects that land on "/" instead of "/auth/callback"
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        // Azure/Google SSO: backend redirects to /?code=... instead of /auth/callback?code=...
        // Forward to /auth/callback so the Callback component can exchange the code for tokens
        const code = params.get('code');
        if (code) {
            // Preserve all query params (code, state, provider, etc.)
            navigate(`/auth/callback${window.location.search}`, { replace: true });
            return;
        }

        // Check for token in URL params (backend may redirect here with token)
        const urlToken = params.get('token') || params.get('access_token');
        if (urlToken) {
            storeTokens({ access_token: urlToken, refresh_token: params.get('refresh_token') });
            navigate(getDashboardRouteForRole(getUserRole()), { replace: true });
            return;
        }

        // If token already exists in localStorage, redirect to dashboard
        if (getAccessToken()) {
            navigate(getDashboardRouteForRole(getUserRole()), { replace: true });
        }
    }, [navigate]);

    const registrationMessage = location.state?.fromRegister ? 'Account created successfully. Please sign in.' : null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login({ email, password, rememberMe });
            navigate(getDashboardRouteForRole(getUserRole()), { replace: true });
        } catch (err) {
            setError(err.message || 'Failed to sign in. Please check your credentials and try again.');
        } finally {
            setLoading(false);
        }
    };


    const handleGoogleSignIn = () => {
        // Store provider hint for Callback to use
        localStorage.setItem('sso_provider', 'google');
        initiateGoogleSignIn();
    };

    const handleMicrosoftSignIn = () => {
        // Store provider hint for Callback to use
        localStorage.setItem('sso_provider', 'azure');
        initiateAzureSignIn();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-main p-4">
            <div className="w-full max-w-sm bg-background-surface rounded-xl shadow-lg overflow-hidden border border-border-default">
                <div className="p-5">
                    <div className="text-center mb-5">
                        <div className="flex justify-center mb-3">
                            <img src="/logo.webp" alt="Governance Logo" className="h-12 max-w-[200px] object-contain" />
                        </div>
                        <h2 className="text-xl font-bold text-text-primary">Welcome back</h2>
                        <p className="text-xs text-text-secondary mt-1">Sign in to your account to continue</p>
                    </div>

                    {registrationMessage && (
                        <div className="mb-3 rounded-lg bg-success-soft border border-success-500 px-3 py-2 text-xs text-success-500">
                            {registrationMessage}
                        </div>
                    )}

                    {error && (
                        <div className="mb-3 rounded-lg bg-error-soft border border-error-500 px-3 py-2 text-xs text-error-500">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-2 mb-4">
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-background-surface border border-border-default rounded-md shadow-sm text-xs font-medium text-text-primary hover:bg-background-subtle focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-background-surface border border-border-default rounded-md shadow-sm text-xs font-medium text-text-primary hover:bg-background-subtle focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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

                    <p className="text-center text-text-muted text-xs font-medium mb-4">Or</p>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-text-primary">
                                Email address
                            </label>
                            <div className="mt-1 relative">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-border-default rounded-md shadow-sm placeholder-text-muted focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-text-primary">
                                Password
                            </label>
                            <div className="mt-1 relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-border-default rounded-md shadow-sm placeholder-text-muted focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm pr-10"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-secondary focus:outline-none"
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
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-border-default rounded"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-text-primary">
                                    Remember me
                                </label>
                            </div>

                            <div className="text-sm">
                                <Link to="/forgot-password" className="font-medium text-primary-500 hover:text-primary-600">
                                    Forgot your password?
                                </Link>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-text-inverse bg-primary-500 hover:bg-primary-600 active:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Signing in...' : 'Sign in with Email'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-4 text-center">
                        <span className="text-text-muted text-xs">Don't have an account? </span>
                        <Link to="/register" className="text-primary-500 hover:text-primary-600 font-medium text-sm">
                            Create account
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
