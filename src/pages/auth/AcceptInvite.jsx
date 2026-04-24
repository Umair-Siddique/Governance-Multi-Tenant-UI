import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { acceptInvite } from '../../api/auth';

export default function AcceptInvite() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleAccept = async (e) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        try {
            setLoading(true);

            // Call the accept invite API with token and password
            await acceptInvite({
                token,
                password,
                fullName: '' // Assuming the backend doesn't strictly need this based on your previous screenshot, or it will use existing data
            });

            setSuccess(true);
            setTimeout(() => {
                navigate('/');
            }, 3000);

        } catch (err) {
            setError(err.message || 'Failed to accept invitation. The link might be expired or invalid.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-main p-4">
                <div className="w-full max-w-md bg-background-surface rounded-xl shadow-lg border border-border-default p-8 text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-success-soft mb-4">
                        <svg className="h-6 w-6 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-text-primary mb-2">Invitation Accepted!</h2>
                    <p className="text-sm text-text-secondary mb-6">
                        You have successfully accepted the invitation. You will be redirected shortly.
                    </p>
                    <Link
                        to="/"
                        className="inline-block px-4 py-2 bg-primary-500 text-text-inverse rounded-md text-sm font-medium hover:bg-primary-600 transition-colors"
                    >
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-main p-4">
            <div className="w-full max-w-md bg-background-surface rounded-xl shadow-lg border border-border-default p-6 text-center">
                <div className="flex justify-center mb-6">
                    <img src="/logo.webp" alt="Governance Logo" className="h-14 max-w-[200px] object-contain" />
                </div>

                <h2 className="text-2xl font-bold text-text-primary mb-2">You've Been Invited!</h2>
                <p className="text-sm text-text-secondary mb-8">
                    Set a password to accept your invitation and join the workspace.
                </p>

                {error && (
                    <div className="mb-6 rounded-lg bg-error-soft border border-error-500 px-3 py-3 text-sm text-error-500 text-left">
                        {error}
                    </div>
                )}

                <form className="space-y-4" onSubmit={handleAccept}>
                    <div>
                        <label htmlFor="password" className="block text-xs font-medium text-text-primary text-left">
                            New Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 appearance-none block w-full px-3 py-1.5 border border-border-default rounded-lg shadow-sm placeholder-text-muted focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                            placeholder="••••••••"
                        />
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-xs font-medium text-text-primary text-left">
                            Confirm Password
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="mt-1 appearance-none block w-full px-3 py-1.5 border border-border-default rounded-lg shadow-sm placeholder-text-muted focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-text-inverse bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : 'Accept Invitation'}
                    </button>
                </form>
            </div>
        </div>
    );
}
