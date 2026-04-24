import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../api/auth';

export default function Register() {
    const navigate = useNavigate();

    const [successMessage, setSuccessMessage] = useState(null);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        terms: false
    });

    const [errors, setErrors] = useState({});

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState(null);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Clear error when user types
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validate = () => {
        const newErrors = {};

        if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters long';
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setApiError(null);

        if (validate()) {
            try {
                setLoading(true);
                await register({ email: formData.email, password: formData.password });
                setSuccessMessage('Registration successful! Please visit your email and confirm your account.');
            } catch (err) {
                setApiError(err.message || 'Failed to sign up. Please try again.');
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-main p-4">
            <div className="w-full max-w-md bg-background-surface rounded-xl shadow-lg overflow-hidden border border-border-default">
                <div className="p-6">
                    <div className="text-center mb-6">
                        <div className="flex justify-center mb-3">
                            <img src="/logo.webp" alt="Governance Logo" className="h-12 max-w-[200px] object-contain" />
                        </div>
                        <h2 className="text-xl font-bold text-text-primary">Create an account</h2>
                        <p className="text-xs text-text-secondary mt-1">Join us to start managing your projects</p>
                    </div>

                    {successMessage && (
                        <div className="mb-3 rounded-lg bg-success-soft border border-success-500 px-3 py-2 text-xs text-success-500">
                            {successMessage}
                        </div>
                    )}

                    {apiError && (
                        <div className="mb-3 rounded-lg bg-error-soft border border-error-500 px-3 py-2 text-xs text-error-500">
                            {apiError}
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-xs font-medium text-text-primary">
                                Email address
                            </label>
                            <div className="mt-1 relative">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="appearance-none block w-full px-3 py-1.5 border border-border-default rounded-lg shadow-sm placeholder-text-muted focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="password" className="block text-xs font-medium text-text-primary">
                                    Password
                                </label>
                                <div className="mt-1 relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        required
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={`appearance-none block w-full px-3 py-1.5 border ${errors.password ? 'border-error-500' : 'border-border-default'} rounded-lg shadow-sm placeholder-text-muted focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm pr-10`}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        className="absolute top-0 bottom-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-secondary focus:outline-none"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="mt-1 text-xs text-error-500">{errors.password}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="confirm-password" className="block text-xs font-medium text-text-primary">
                                    Confirm Password
                                </label>
                                <div className="mt-1 relative">
                                    <input
                                        id="confirm-password"
                                        name="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        required
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className={`appearance-none block w-full px-3 py-1.5 border ${errors.confirmPassword ? 'border-error-500' : 'border-border-default'} rounded-lg shadow-sm placeholder-text-muted focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm pr-10`}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        className="absolute top-0 bottom-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-secondary focus:outline-none"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {errors.confirmPassword && (
                                    <p className="mt-1 text-xs text-error-500">{errors.confirmPassword}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center">
                            <input
                                id="terms"
                                name="terms"
                                type="checkbox"
                                required
                                checked={formData.terms}
                                onChange={handleChange}
                                className="h-3.5 w-3.5 text-primary-600 focus:ring-primary-500 border-border-default rounded"
                            />
                            <label htmlFor="terms" className="ml-2 block text-xs text-text-primary">
                                I agree to the <a href="#" className="font-medium text-primary-600 hover:text-primary-500">Terms</a>
                            </label>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-text-inverse bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
                            >
                                {loading ? 'Creating account...' : 'Sign up'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-4 text-center">
                        <span className="text-xs text-text-muted">
                            Already have an account?{' '}
                        </span>
                        <Link to="/" className="text-primary-600 hover:text-primary-500 font-medium text-xs">
                            Sign in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

