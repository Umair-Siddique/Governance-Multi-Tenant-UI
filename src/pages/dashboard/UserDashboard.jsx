import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/dashboard/Sidebar';
import { getAccessToken } from '../../api/apiClient';
import { getTenantProfile, normalizeTenantProfile } from '../../api/tenantSettings';
import { getDocuments } from '../../api/documents';
import { editorAndReviewerSummary } from '../admin/adminData';
import { decodeJwt, getUserRole } from '../../utils/authUtils';

function StatCard({ label, value, gradient, icon }) {
    return (
        <article className="bg-white rounded-2xl p-5 border border-slate-100 relative overflow-hidden"
                 style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div className="absolute top-0 right-0 w-24 h-24 opacity-8 pointer-events-none"
                 style={{ background: gradient, borderRadius: '0 1rem 0 100%', opacity: 0.08 }} />
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
                    <p className="mt-2 text-4xl font-bold text-slate-900">{value}</p>
                </div>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                     style={{ background: gradient, opacity: 0.15 }}>
                </div>
            </div>
            <div className="mt-3 h-1 rounded-full overflow-hidden bg-slate-100">
                <div className="h-full w-2/3 rounded-full" style={{ background: gradient }} />
            </div>
        </article>
    );
}

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
        <div className="min-h-screen bg-slate-50 flex">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="bg-white border-b border-slate-100 sticky top-0 z-10"
                        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 leading-tight">Dashboard</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Admin Panel</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-sm font-semibold text-slate-700">{currentUserEmail}</p>
                                <p className="text-xs text-slate-400">{displayRole}</p>
                            </div>
                            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                 style={{ background: 'linear-gradient(135deg, #1D4ED8, #4338CA)' }}>
                                {currentUserEmail.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <div className="mx-auto h-10 w-10 rounded-full border-4 border-blue-100 mb-4"
                                     style={{ borderTopColor: '#1D4ED8', animation: 'spin 0.8s linear infinite' }} />
                                <p className="text-sm text-slate-400">Loading dashboard…</p>
                            </div>
                        </div>
                    ) : tenant ? (
                        <div className="space-y-6 max-w-7xl mx-auto">
                            {/* Welcome banner */}
                            <div className="rounded-2xl p-6 text-white relative overflow-hidden"
                                 style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #4338CA 60%, #7C3AED 100%)' }}>
                                <div className="absolute inset-0 pointer-events-none"
                                     style={{ background: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.08) 0%, transparent 60%)' }} />
                                <p className="text-blue-100 text-sm font-medium mb-1">Welcome back</p>
                                <h2 className="text-2xl font-bold">{tenant.tenant_name || 'Your Organisation'}</h2>
                                <p className="text-blue-200 text-sm mt-1">
                                    {tenant.tenant_type === 'self_managed' ? 'Self-managed tenant' : tenant.tenant_type === 'managed' ? 'Managed tenant' : tenant.tenant_type || ''}
                                </p>
                            </div>

                            {/* Stat cards */}
                            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <StatCard
                                    label="Draft"
                                    value={summary.draft}
                                    gradient="linear-gradient(135deg, #60A5FA, #3B82F6)"
                                />
                                <StatCard
                                    label="Review Queue"
                                    value={summary.review}
                                    gradient="linear-gradient(135deg, #FBBF24, #F59E0B)"
                                />
                                <StatCard
                                    label="Approved"
                                    value={summary.approved}
                                    gradient="linear-gradient(135deg, #34D399, #10B981)"
                                />
                            </section>

                            {/* Tenant details card */}
                            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
                                 style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center"
                                         style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' }}>
                                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900">Tenant Information</h3>
                                        <p className="text-xs text-slate-400">Your tenant profile details</p>
                                    </div>
                                </div>
                                <div className="px-6 py-5">
                                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                                        <div>
                                            <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tenant Name</dt>
                                            <dd className="mt-1 text-sm font-medium text-slate-900">{tenant.tenant_name || '—'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tenant Type</dt>
                                            <dd className="mt-1 text-sm font-medium text-slate-900">
                                                {tenant.tenant_type === 'self_managed' ? 'Self-managed' : tenant.tenant_type === 'managed' ? 'Managed' : tenant.tenant_type || '—'}
                                            </dd>
                                        </div>
                                        {tenant.tenant_details && (
                                            <>
                                                {tenant.tenant_details.department && (
                                                    <div>
                                                        <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Department</dt>
                                                        <dd className="mt-1 text-sm font-medium text-slate-900">{tenant.tenant_details.department}</dd>
                                                    </div>
                                                )}
                                                {tenant.tenant_details.country && (
                                                    <div>
                                                        <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Country</dt>
                                                        <dd className="mt-1 text-sm font-medium text-slate-900">{tenant.tenant_details.country}</dd>
                                                    </div>
                                                )}
                                                {tenant.tenant_details.contact_email && (
                                                    <div>
                                                        <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Contact Email</dt>
                                                        <dd className="mt-1 text-sm font-medium text-slate-900">{tenant.tenant_details.contact_email}</dd>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </dl>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <div className="mx-auto mb-4 h-16 w-16 rounded-2xl flex items-center justify-center"
                                     style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' }}>
                                    <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                    </svg>
                                </div>
                                <p className="text-slate-500 text-base font-medium mb-1">No tenant profile found</p>
                                <p className="text-slate-400 text-sm mb-5">Set up your organisation to get started</p>
                                <button
                                    onClick={() => navigate('/create-tenant')}
                                    className="btn-primary-gradient inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
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
