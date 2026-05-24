import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../../api/auth';

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            await forgotPassword({ email });
            setSuccess('Recovery mail sent to your email.');
        } catch (err) {
            setError(err.message || 'Failed to send recovery code.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden auth-page-bg">
            {/* Decorative blobs */}
            <div
                className="absolute pointer-events-none"
                style={{
                    top: '-8%', right: '-6%',
                    width: '460px', height: '460px',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 65%)',
                }}
            />
            <div
                className="absolute pointer-events-none"
                style={{
                    bottom: '-10%', left: '-8%',
                    width: '400px', height: '400px',
                    background: 'radial-gradient(circle, rgba(29,78,216,0.16) 0%, transparent 65%)',
                }}
            />

            <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
                <div className="auth-card">
                    {/* Gradient accent bar */}
                    <div className="auth-card-accent" />

                    <div className="px-7 pt-7 pb-8">
                        {/* Icon + heading */}
                        <div className="text-center mb-7">
                            <div className="flex justify-center mb-5">
                                <div
                                    className="h-14 w-14 rounded-2xl flex items-center justify-center"
                                    style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '1px solid #BFDBFE' }}
                                >
                                    <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                                    </svg>
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Forgot password?</h2>
                            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                                No worries — we'll send you a recovery<br />link to reset your password.
                            </p>
                        </div>

                        {/* Alerts */}
                        {success && (
                            <div className="mb-5 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-start gap-2 animate-fade-in">
                                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                {success}
                            </div>
                        )}

                        {error && (
                            <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-start gap-2 animate-fade-in">
                                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </div>
                        )}

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
                                    onChange={e => setEmail(e.target.value)}
                                    disabled={loading}
                                    className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all duration-200 disabled:opacity-60"
                                    placeholder="you@example.com"
                                />
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
                                        Sending…
                                    </>
                                ) : 'Send recovery link'}
                            </button>
                        </form>

                        <div className="mt-6 flex justify-center">
                            <Link
                                to="/"
                                className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors duration-150"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                </svg>
                                Back to sign in
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
