import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTenant } from '../../api/tenantSettings';

export default function TenantCreate() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        tenant_name: '',
        tenant_type: 'self_managed',
        country: '',
        contact_email: '',
        department: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await createTenant(form);
            navigate('/dashboard/settings/profile');
        } catch (err) {
            setError(err.message || 'Failed to create tenant. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-subtle p-4">
            <div className="w-full max-w-2xl bg-background-surface rounded-lg shadow p-6">
                <div className="flex items-center mb-6 border-b border-border-default pb-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="mr-3 p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-background-subtle focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                        aria-label="Go back to dashboard"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h2 className="text-lg font-semibold text-text-primary m-0">Create your tenant profile</h2>
                </div>

                {error && (
                    <div className="mb-4 rounded-md bg-error-soft border border-error-500 p-3 text-sm text-error-500">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium text-text-primary">Tenant name</label>
                            <input name="tenant_name" required value={form.tenant_name} onChange={handleChange} className="mt-1 block w-full border-border-default rounded-md shadow-sm sm:text-sm border p-2" />
                        </div>

                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium text-text-primary">Tenant type</label>
                            <select name="tenant_type" value={form.tenant_type} onChange={handleChange} className="mt-1 block w-full border-border-default rounded-md shadow-sm sm:text-sm border p-2">
                                <option value="self_managed">Self-managed</option>
                                <option value="white_label">White label</option>
                            </select>
                        </div>

                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium text-text-primary">Department</label>
                            <input name="department" value={form.department} onChange={handleChange} className="mt-1 block w-full border-border-default rounded-md shadow-sm sm:text-sm border p-2" />
                        </div>

                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium text-text-primary">Country</label>
                            <input name="country" value={form.country} onChange={handleChange} className="mt-1 block w-full border-border-default rounded-md shadow-sm sm:text-sm border p-2" />
                        </div>

                        <div className="sm:col-span-3">
                            <label className="block text-sm font-medium text-text-primary">Contact email</label>
                            <input name="contact_email" type="email" value={form.contact_email} onChange={handleChange} className="mt-1 block w-full border-border-default rounded-md shadow-sm sm:text-sm border p-2" />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-text-inverse bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating…' : 'Create tenant'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

