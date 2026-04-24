import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/dashboard/Sidebar';
import ThemeToggle from '../../components/ui/ThemeToggle';
import { getAccessToken } from '../../api/apiClient';
import { getTenantProfile, normalizeTenantProfile } from '../../api/tenantSettings';
import { getDocuments } from '../../api/documents';
import { editorAndReviewerSummary } from '../admin/adminData';
import { decodeJwt, getUserRole } from '../../utils/authUtils';

export default function UserDashboard() {
    const navigate = useNavigate();
    const token = getAccessToken();
    const payload = decodeJwt(token);
    const currentUserEmail = payload?.email || payload?.user_metadata?.email || payload?.preferred_username || 'Unknown User';
    const currentUserRole = getUserRole();
    const displayRole = currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1);
    const [tenant, setTenant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(() => editorAndReviewerSummary());

    useEffect(() => {
        const loadTenant = async () => {
            try {
                const p = await getTenantProfile();
                if (p && !p.notFound) {
                    setTenant(normalizeTenantProfile(p) || p);
                }
            } catch (e) {
                // Tenant may not exist yet
            } finally {
                setLoading(false);
            }
        };
        loadTenant();
    }, []);

    useEffect(() => {
        const loadSummary = async () => {
            try {
                const data = await getDocuments();
                const docs = Array.isArray(data) ? data : (data?.documents || []);

                const nextSummary = docs.reduce((acc, doc) => {
                    const status = String(doc?.status || '').toUpperCase();
                    if (status === 'DRAFT') acc.draft += 1;
                    if (status === 'REVIEW') acc.review += 1;
                    if (status === 'APPROVED') acc.approved += 1;
                    return acc;
                }, { draft: 0, review: 0, approved: 0 });

                setSummary(nextSummary);
            } catch {
                // Keep fallback summary from local data if API is unavailable.
            }
        };

        loadSummary();
    }, []);

    return (
        <div className="min-h-screen bg-background-main flex">
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="bg-background-surface shadow border-b border-border-default">
                    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
                        <div className="flex items-center gap-3">
                            <ThemeToggle />
                            <span className="text-sm font-medium text-text-primary">{currentUserEmail} ({displayRole})</span>
                        </div>
                    </div>
                </header>

                {/* Dashboard Content */}
                <main className="flex-1 p-6">
                    {loading ? (
                        <div className="border-4 border-dashed border-border-default rounded-lg h-96 flex items-center justify-center">
                            <p className="text-text-muted text-lg">Loading...</p>
                        </div>
                    ) : tenant ? (
                        <div className="space-y-6">
                            {/* Tenant Information Card */}
                            <div className="bg-background-surface shadow rounded-lg overflow-hidden border border-border-default">
                                <div className="px-6 py-5 border-b border-border-default">
                                    <h2 className="text-lg font-medium leading-6 text-text-primary">Tenant Information</h2>
                                    <p className="mt-1 text-sm text-text-muted">Your tenant profile details</p>
                                </div>
                                <div className="px-6 py-5">
                                    <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                                        <div>
                                            <dt className="text-sm font-medium text-text-muted">Tenant Name</dt>
                                            <dd className="mt-1 text-sm text-text-primary">{tenant.tenant_name || '—'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-text-muted">Tenant Type</dt>
                                            <dd className="mt-1 text-sm text-text-primary">
                                                {tenant.tenant_type === 'self_managed' ? 'Self-managed' : tenant.tenant_type === 'managed' ? 'Managed' : tenant.tenant_type || '—'}
                                            </dd>
                                        </div>
                                        {tenant.tenant_details && (
                                            <>
                                                {tenant.tenant_details.department && (
                                                    <div>
                                                        <dt className="text-sm font-medium text-text-muted">Department</dt>
                                                        <dd className="mt-1 text-sm text-text-primary">{tenant.tenant_details.department}</dd>
                                                    </div>
                                                )}
                                                {tenant.tenant_details.country && (
                                                    <div>
                                                        <dt className="text-sm font-medium text-text-muted">Country</dt>
                                                        <dd className="mt-1 text-sm text-text-primary">{tenant.tenant_details.country}</dd>
                                                    </div>
                                                )}
                                                {tenant.tenant_details.contact_email && (
                                                    <div>
                                                        <dt className="text-sm font-medium text-text-muted">Contact Email</dt>
                                                        <dd className="mt-1 text-sm text-text-primary">{tenant.tenant_details.contact_email}</dd>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </dl>

                                </div>
                            </div>

                            {/* Combined Editor/Reviewer Summary */}
                            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <article className="bg-background-surface border border-border-default rounded-lg p-4">
                                    <p className="text-xs text-text-muted uppercase">Draft</p>
                                    <p className="mt-2 text-3xl font-bold text-text-primary">{summary.draft}</p>
                                </article>
                                <article className="bg-background-surface border border-border-default rounded-lg p-4">
                                    <p className="text-xs text-text-muted uppercase">Review Queue</p>
                                    <p className="mt-2 text-3xl font-bold text-text-primary">{summary.review}</p>
                                </article>
                                <article className="bg-background-surface border border-border-default rounded-lg p-4">
                                    <p className="text-xs text-text-muted uppercase">Approved</p>
                                    <p className="mt-2 text-3xl font-bold text-text-primary">{summary.approved}</p>
                                </article>
                            </section>
                        </div>
                    ) : (
                        <div className="border-4 border-dashed border-border-default rounded-lg h-96 flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-text-muted text-lg mb-4">No tenant profile found</p>
                                <button
                                    onClick={() => navigate('/create-tenant')}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-text-inverse bg-primary-500 hover:bg-primary-600"
                                >
                                    Create Tenant Profile
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
