import React, { useState, useEffect } from 'react';
import SettingsLayout from '../../components/dashboard/SettingsLayout';
import { getTenantProfile, normalizeTenantProfile } from '../../api/tenantSettings';

// Utility to decode JWT token
function decodeToken(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

export default function ProfileSettings() {
    const [profile, setProfile] = useState({
        firstName: '',
        lastName: '',
        email: '',
    });
    const [tenant, setTenant] = useState({
        tenant_name: '',
        tenant_type: 'self_managed',
        tenant_details: {
            country: '',
            contact_email: '',
            department: '',
        }
    });
    const [tenantExists, setTenantExists] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState(null);
    const [error, setError] = useState(null);

    // Load user data from token
    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) {
            const decoded = decodeToken(token);
            if (decoded && decoded.email) {
                setProfile(prev => ({
                    ...prev,
                    email: decoded.email,
                }));
            }
        }
        // load tenant profile - saved data will show in input fields for viewing/editing
        (async () => {
            try {
                const p = await getTenantProfile();
                const tenantData = normalizeTenantProfile(p);
                if (tenantData) {
                    setTenantExists(true);
                    setTenant(tenantData);
                } else if (p?.notFound) {
                    setTenantExists(false);
                }
            } catch (e) {
                console.error('Error loading tenant profile:', e);
                setTenantExists(false);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const token = localStorage.getItem('authToken');
            const payload = {
                firstName: profile.firstName.trim(),
                lastName: profile.lastName.trim(),
            };

            const res = await fetch(`${import.meta.env.AUTH_BASE_URL || '/api'}/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
                credentials: 'include',
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || 'Failed to update profile');
            }

            setSuccessMsg('Profile updated successfully!');
            setTimeout(() => setSuccessMsg(null), 4000);
        } catch (err) {
            setError(err.message || 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    // Tenant save handler
    const [tenantSaving, setTenantSaving] = useState(false);
    const [tenantSuccess, setTenantSuccess] = useState(null);
    const [tenantError, setTenantError] = useState(null);

    const handleTenantChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('tenant_details.')) {
            const key = name.split('.')[1];
            setTenant(prev => ({
                ...prev,
                tenant_details: { ...(prev.tenant_details || {}), [key]: value }
            }));
        } else {
            setTenant(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSaveTenant = async () => {
        if (!localStorage.getItem('authToken')) {
            setTenantError('Session expired. Please log in again.');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
            return;
        }
        // API removed — tenant create/update is not available
        setTenantError('Tenant create/update API is not available.');
    };

    return (
        <SettingsLayout title="Profile Settings">
            <div className="max-w-4xl mx-auto">
                {/* Success message */}
                {successMsg && (
                    <div className="mb-4 p-4 rounded-lg text-sm bg-success-soft text-success-500 border border-success-500">
                        {successMsg}
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div className="mb-4 p-4 rounded-lg text-sm bg-error-soft text-error-500 border border-error-500">
                        {error}
                    </div>
                )}

                <div className="bg-background-surface shadow rounded-lg overflow-hidden border border-border-default">
                    <div className="px-6 py-5 border-b border-border-default">
                        <h3 className="text-lg font-medium leading-6 text-text-primary">Personal Information</h3>
                        <p className="mt-1 text-sm text-text-muted">Update your personal details.</p>
                    </div>
                    <div className="p-6 space-y-6">
                        {loading ? (
                            <div className="text-center text-text-muted py-8">Loading...</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                                <div className="sm:col-span-6">
                                    <label htmlFor="email" className="block text-sm font-medium text-text-primary">Email address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        id="email"
                                        autoComplete="email"
                                        value={profile.email}
                                        disabled={true}
                                        className="mt-1 block w-full border-border-default rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm border p-2 bg-background-main cursor-not-allowed"
                                    />
                                    <p className="mt-1 text-xs text-text-muted">Email cannot be changed. Contact support to update your email.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tenant Details Card */}
                <div className="bg-background-surface shadow rounded-lg overflow-hidden border border-border-default mt-6">
                    <div className="px-6 py-5 border-b border-border-default">
                        <h3 className="text-lg font-medium leading-6 text-text-primary">Tenant Details</h3>
                        <p className="mt-1 text-sm text-text-muted">Your tenant profile information.</p>
                    </div>
                    <div className="p-6">
                        {loading ? (
                            <div className="text-center text-text-muted py-8">Loading tenant details...</div>
                        ) : !tenantExists ? (
                            <div className="text-center text-text-muted py-8">
                                No tenant profile found.{' '}
                                <a href="/create-tenant" className="text-primary-500 underline font-medium">Create one</a>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                                {/* Tenant Name */}
                                <div className="sm:col-span-3">
                                    <label className="block text-sm font-medium text-text-muted">Tenant name</label>
                                    <p className="mt-1 block w-full border border-border-default rounded-md bg-background-subtle px-3 py-2 text-sm text-text-primary">
                                        {tenant.tenant_name || '—'}
                                    </p>
                                </div>

                                {/* Tenant Type */}
                                <div className="sm:col-span-3">
                                    <label className="block text-sm font-medium text-text-muted">Tenant type</label>
                                    <p className="mt-1 block w-full border border-border-default rounded-md bg-background-subtle px-3 py-2 text-sm text-text-primary capitalize">
                                        {tenant.tenant_type === 'self_managed'
                                            ? 'Self-managed'
                                            : tenant.tenant_type === 'white_label'
                                                ? 'White label'
                                                : tenant.tenant_type || '—'}
                                    </p>
                                </div>

                                {/* Department */}
                                <div className="sm:col-span-3">
                                    <label className="block text-sm font-medium text-text-muted">Department</label>
                                    <p className="mt-1 block w-full border border-border-default rounded-md bg-background-subtle px-3 py-2 text-sm text-text-primary">
                                        {tenant.tenant_details?.department || '—'}
                                    </p>
                                </div>

                                {/* Country */}
                                <div className="sm:col-span-3">
                                    <label className="block text-sm font-medium text-text-muted">Country</label>
                                    <p className="mt-1 block w-full border border-border-default rounded-md bg-background-subtle px-3 py-2 text-sm text-text-primary">
                                        {tenant.tenant_details?.country || '—'}
                                    </p>
                                </div>

                                {/* Contact Email */}
                                <div className="sm:col-span-3">
                                    <label className="block text-sm font-medium text-text-muted">Contact email</label>
                                    <p className="mt-1 block w-full border border-border-default rounded-md bg-background-subtle px-3 py-2 text-sm text-text-primary">
                                        {tenant.tenant_details?.contact_email || '—'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </SettingsLayout>
    );
}

