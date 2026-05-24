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

    const EyeIcon = ({ open }) => open ? (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );

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

            <div className="relative z-10 w-full max-w-md animate-fade-in-up">
                <div className="auth-card">
                    {/* Gradient accent bar */}
                    <div className="auth-card-accent" />

                    <div className="px-7 pt-7 pb-8">
                        {/* Logo + heading */}
                        <div className="text-center mb-6">
                            <div className="flex justify-center mb-4">
                                <img src="/logo.webp" alt="Governance Logo" className="h-11 max-w-[190px] object-contain" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create an account</h2>
                            <p className="text-sm text-slate-500 mt-1">Join us to start managing your projects</p>
                        </div>

                        {/* Alerts */}
                        {successMessage && (
                            <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-start gap-2 animate-fade-in">
                                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                {successMessage}
                            </div>
                        )}

                        {apiError && (
                            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-start gap-2 animate-fade-in">
                                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                {apiError}
                            </div>
                        )}

                        <form className="space-y-4" onSubmit={handleSubmit}>
                            {/* Email */}
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
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all duration-200"
                                    placeholder="you@example.com"
                                />
                            </div>

                            {/* Password row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="password"
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            required
                                            value={formData.password}
                                            onChange={handleChange}
                                            className={`block w-full px-3 py-2.5 border rounded-xl text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all duration-200 pr-9 ${errors.password ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            <EyeIcon open={showPassword} />
                                        </button>
                                    </div>
                                    {errors.password && (
                                        <p className="mt-1 text-xs text-red-500">{errors.password}</p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Confirm Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="confirm-password"
                                            name="confirmPassword"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            required
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            className={`block w-full px-3 py-2.5 border rounded-xl text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all duration-200 pr-9 ${errors.confirmPassword ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            <EyeIcon open={showConfirmPassword} />
                                        </button>
                                    </div>
                                    {errors.confirmPassword && (
                                        <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>
                                    )}
                                </div>
                            </div>

                            {/* Terms */}
                            <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                <input
                                    id="terms"
                                    name="terms"
                                    type="checkbox"
                                    required
                                    checked={formData.terms}
                                    onChange={handleChange}
                                    className="h-4 w-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 transition-colors shrink-0"
                                />
                                <span className="text-sm text-slate-600">
                                    I agree to the{' '}
                                    <a href="#" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">Terms of Service</a>
                                </span>
                            </label>

                            {/* Submit */}
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
                                        Creating account…
                                    </>
                                ) : 'Create account'}
                            </button>
                        </form>

                        <div className="mt-5 text-center">
                            <span className="text-sm text-slate-500">Already have an account? </span>
                            <Link to="/" className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors duration-150">
                                Sign in
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
