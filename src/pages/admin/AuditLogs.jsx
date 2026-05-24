import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/dashboard/Sidebar';
import { getAuditLogs, getAuditLogStats } from '../../api/auditLogs';

const EVENT_CATEGORIES = ['', 'content', 'ai', 'admin'];
const CATEGORY_LABELS = { '': 'All Categories', content: 'Content', ai: 'AI', admin: 'Admin' };

const EVENT_TYPES = [
    '',
    'document.uploaded',
    'document.batch_approved',
    'document.batch_rejected',
    'document.batch_submitted_for_review',
    'document.deleted',
    'document.published_to_pinecone',
    'ai.query_asked',
    'ai.temp_file_uploaded',
    'admin.user_invited',
    'admin.role_changed',
];

const CATEGORY_BADGE = {
    content: 'badge-draft',
    ai: 'badge-approved',
    admin: 'badge-review',
};

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function StatCard({ label, value }) {
    return (
        <article className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-800">{value ?? '—'}</p>
        </article>
    );
}

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const LIMIT = 50;

    const [filters, setFilters] = useState({
        event_category: '',
        event_type: '',
        actor_id: '',
        target_id: '',
        from_date: '',
        to_date: '',
    });

    const fetchLogs = useCallback(async (currentPage, currentFilters) => {
        try {
            setLoading(true);
            setError(null);
            const data = await getAuditLogs({
                ...currentFilters,
                page: currentPage,
                limit: LIMIT,
            });
            setLogs(data.audit_logs || []);
            setHasMore(data.has_more || false);
        } catch (err) {
            setError(err.message || 'Failed to load audit logs.');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchStats = useCallback(async (currentFilters) => {
        try {
            setStatsLoading(true);
            const data = await getAuditLogStats({
                event_category: currentFilters.event_category,
                from_date: currentFilters.from_date,
                to_date: currentFilters.to_date,
            });
            setStats(data);
        } catch {
            setStats(null);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs(page, filters);
    }, [page, filters, fetchLogs]);

    useEffect(() => {
        fetchStats(filters);
    }, [filters, fetchStats]);

    function handleFilterChange(key, value) {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    }

    function handleReset() {
        setFilters({ event_category: '', event_type: '', actor_id: '', target_id: '', from_date: '', to_date: '' });
        setPage(1);
    }

    return (
        <div className="min-h-screen bg-slate-50 flex">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0">
                <header className="admin-header">
                    <div className="px-6 py-4 flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 leading-tight">Audit Logs</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Admin Panel</p>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-4 sm:p-6 space-y-6">

                    {/* Stats */}
                    <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard label="Total Events" value={statsLoading ? '…' : stats?.total} />
                        <StatCard label="Content" value={statsLoading ? '…' : stats?.by_category?.content} />
                        <StatCard label="AI" value={statsLoading ? '…' : stats?.by_category?.ai} />
                        <StatCard label="Admin" value={statsLoading ? '…' : stats?.by_category?.admin} />
                    </section>

                    {/* Filters */}
                    <section className="admin-card p-4">
                        <div className="flex flex-wrap gap-3 items-end">
                            {/* Category */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-slate-500 font-medium">Category</label>
                                <select
                                    value={filters.event_category}
                                    onChange={(e) => handleFilterChange('event_category', e.target.value)}
                                    className="admin-select"
                                >
                                    {EVENT_CATEGORIES.map((c) => (
                                        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Event Type */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-slate-500 font-medium">Event Type</label>
                                <select
                                    value={filters.event_type}
                                    onChange={(e) => handleFilterChange('event_type', e.target.value)}
                                    className="admin-select"
                                >
                                    {EVENT_TYPES.map((t) => (
                                        <option key={t} value={t}>{t || 'All Types'}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Actor ID */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-slate-500 font-medium">Actor ID</label>
                                <input
                                    type="text"
                                    placeholder="uuid"
                                    value={filters.actor_id}
                                    onChange={(e) => handleFilterChange('actor_id', e.target.value)}
                                    className="admin-input w-48"
                                />
                            </div>

                            {/* Target ID */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-slate-500 font-medium">Target ID</label>
                                <input
                                    type="text"
                                    placeholder="uuid"
                                    value={filters.target_id}
                                    onChange={(e) => handleFilterChange('target_id', e.target.value)}
                                    className="admin-input w-48"
                                />
                            </div>

                            {/* From Date */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-slate-500 font-medium">From</label>
                                <input
                                    type="datetime-local"
                                    value={filters.from_date ? filters.from_date.slice(0, 16) : ''}
                                    onChange={(e) => handleFilterChange('from_date', e.target.value ? `${e.target.value}:00Z` : '')}
                                    className="admin-input"
                                />
                            </div>

                            {/* To Date */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-slate-500 font-medium">To</label>
                                <input
                                    type="datetime-local"
                                    value={filters.to_date ? filters.to_date.slice(0, 16) : ''}
                                    onChange={(e) => handleFilterChange('to_date', e.target.value ? `${e.target.value}:00Z` : '')}
                                    className="admin-input"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleReset}
                                className="btn-outline px-4 py-2 rounded-lg text-sm font-medium"
                            >
                                Reset
                            </button>
                        </div>
                    </section>

                    {/* Table */}
                    <section className="admin-card overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-slate-800">Events</h2>
                            <span className="text-xs text-slate-400">Page {page}</span>
                        </div>

                        {error && (
                            <div className="mx-6 mt-4 mb-2 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="admin-table-head">
                                        <th>Event</th>
                                        <th>Category</th>
                                        <th>Actor</th>
                                        <th>Target</th>
                                        <th>Metadata</th>
                                        <th>IP</th>
                                        <th>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-8 text-center text-sm text-slate-400">
                                                Loading…
                                            </td>
                                        </tr>
                                    ) : logs.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-8 text-center text-sm text-slate-400">
                                                No audit logs found for the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log) => (
                                            <tr key={log.id} className="admin-table-row">
                                                <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">
                                                    {log.event_type}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${CATEGORY_BADGE[log.event_category] || 'badge-default'}`}>
                                                        {log.event_category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 max-w-[180px] truncate" title={log.actor_id}>
                                                    {log.actor_email || log.actor_id || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 max-w-[140px] truncate" title={log.target_id}>
                                                    {log.target_type
                                                        ? `${log.target_type}${log.target_id ? ` (${log.target_id.slice(0, 8)}…)` : ''}`
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px]">
                                                    {log.metadata && Object.keys(log.metadata).length > 0 ? (
                                                        <details className="cursor-pointer">
                                                            <summary className="select-none text-blue-600 hover:underline">View</summary>
                                                            <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-slate-600 bg-slate-50 rounded p-2">
                                                                {JSON.stringify(log.metadata, null, 2)}
                                                            </pre>
                                                        </details>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                                                    {log.ip_address || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                                                    {formatDate(log.created_at)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                            <button
                                type="button"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage((p) => p - 1)}
                                className="btn-outline px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-400">Page {page}</span>
                            <button
                                type="button"
                                disabled={!hasMore || loading}
                                onClick={() => setPage((p) => p + 1)}
                                className="btn-outline px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </section>

                </main>
            </div>
        </div>
    );
}
