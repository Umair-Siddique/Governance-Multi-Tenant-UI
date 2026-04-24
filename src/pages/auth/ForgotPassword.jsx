
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
            // Optionally redirect to verification page
            // navigate('/verify-email/dummy-token', { state: { from: 'forgot-password' } });
        } catch (err) {
            setError(err.message || 'Failed to send recovery code.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-main p-4">
            <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <img src="/logo.webp" alt="Governance Logo" className="h-12 max-w-[200px] object-contain" />
                        </div>
                        <h2 className="text-2xl font-bold text-text-primary">Forgot password?</h2>
                        <p className="text-sm text-text-secondary mt-2">No worries, we'll send you a recovery code.</p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
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
                                    className="appearance-none block w-full px-3 py-2 border border-border-default rounded-lg shadow-sm placeholder-text-muted focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-text-inverse bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
                                disabled={loading}
                            >
                                {loading ? 'Sending...' : 'Send code'}
                            </button>
                            {error && <div className="text-error-500 text-sm mt-2">{error}</div>}
                            {success && <div className="text-success-500 text-sm mt-2">{success}</div>}
                        </div>
                    </form>

                    <div className="mt-6 flex justify-center">
                        <Link to="/login" className="flex items-center text-sm font-medium text-text-secondary hover:text-text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                            Back to log in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

