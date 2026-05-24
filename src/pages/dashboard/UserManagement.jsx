import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/dashboard/Sidebar';
import { getInvitations, sendInvitation, revokeInvitation } from '../../api/invitations';

const ROLES = ['Admin', 'Editor', 'Reviewer', 'User'];
const STATUSES = ['All', 'Pending', 'Accepted', 'Revoked', 'Expired'];

export default function UserManagement() {
    const navigate = useNavigate();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filterStatus, setFilterStatus] = useState('All');

    const [showInviteForm, setShowInviteForm] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('User');
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Run both fetches in parallel
            // Note: Use `.catch` closely if the API doesn't exist yet so it fails gracefully.
            const [usersRes, invitesRes] = await Promise.all([
                Promise.resolve({ data: [] }),
                getInvitations().catch(e => ({ data: [] }))
            ]);

            // Safe access functions for arrays
            const getArray = (src) => {
                if (Array.isArray(src)) return src;
                if (src && Array.isArray(src.data)) return src.data;
                if (src && Array.isArray(src.users)) return src.users;
                if (src && Array.isArray(src.invitations)) return src.invitations;
                return [];
            };

            const rawUsers = getArray(usersRes);
            const rawInvites = getArray(invitesRes);

            console.log('rawUsers:', rawUsers);
            console.log('rawInvites:', rawInvites);

            // Format active/inactive users
            const formattedUsers = rawUsers.map(u => ({
                id: u.id || u._id || Date.now() + Math.random(),
                email: u.email || 'Missing Email (Check Console)', // Users might still use .email, leaving as is for now
                role: u.role || 'User',
                status: u.is_active === false ? 'Inactive' : 'Active',
                type: 'user'
            }));

            // Normalize invitation statuses for filtering and display.
            const formattedInvites = rawInvites
                .filter(inv => {
                    const s = (inv.status || '').toLowerCase();
                    return s !== 'active';
                })
                .map(inv => {
                    const s = (inv.status || 'pending').toLowerCase();
                    let displayStatus = 'Pending';
                    if (s === 'pending') displayStatus = 'Pending';
                    else if (s === 'accepted') displayStatus = 'Accepted';
                    else if (s === 'revoked' || s === 'cancelled' || s === 'canceled' || s === 'inactive') displayStatus = 'Revoked';
                    else if (s === 'expired') displayStatus = 'Expired';

                    return {
                        id: inv.id || inv._id || Date.now() + Math.random(),
                        email: inv.invited_email || inv.invite_email || inv.email || 'Missing Email (Check Console)',
                        role: inv.role || 'User',
                        status: displayStatus,
                        type: 'invite'
                    };
                });

            // Merge both lists
            setUsers([...formattedUsers, ...formattedInvites]);
        } catch (err) {
            setError(err.message || 'Failed to fetch users and invitations.');
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail) return;

        try {
            setInviting(true);
            setError(null);

            await sendInvitation({ email: inviteEmail, role: inviteRole });
            await fetchData();

            setInviteEmail('');
            setShowInviteForm(false);
        } catch (err) {
            setError(err.message || 'Failed to send invitation.');
        } finally {
            setInviting(false);
        }
    };

    const handleChangeRole = async (userObj, newRole) => {
        // Optimistic UI update
        setUsers(users.map(u => u.id === userObj.id ? { ...u, role: newRole } : u));
        try {
            if (userObj.type === 'user') {
                // Users API removed
            } else {
                // If backend supports updating an invitation role, you'd call it here
            }
        } catch (err) {
            // Revert on error
            setError('Failed to update role.');
            await fetchData();
        }
    };

    const handleDeactivate = async (userObj) => {
        try {
            if (userObj.type === 'invite') {
                await revokeInvitation(userObj.id);
                setUsers(users.filter(u => u.id !== userObj.id));
            } else {
                // Users API removed — deactivateUser
                setUsers(users.map(u => u.id === userObj.id ? { ...u, status: 'Inactive' } : u));
            }
        } catch (err) {
            setError(err.message || 'Failed to perform action.');
        }
    };

    const handleActivate = async (userObj) => {
        try {
            // Users API removed — activateUser
            setUsers(users.map(u => u.id === userObj.id ? { ...u, status: 'Active' } : u));
        } catch (err) {
            setError(err.message || 'Failed to form action.');
        }
    };

    // Derived view for filtered data
    const filteredUsers = users.filter(user => filterStatus === 'All' ? true : user.status === filterStatus);

    return (
        <div className="min-h-screen bg-slate-50 flex">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0">
                <header className="admin-header">
                    <div className="px-6 py-4 flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 leading-tight">User Management</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Admin Panel</p>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6">
                    <div className="admin-card overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-4 flex-wrap">
                                <h3 className="text-base font-semibold text-slate-800">All users</h3>

                                {/* Status Filter */}
                                <div className="flex items-center gap-2">
                                    <label htmlFor="filterStatus" className="text-xs text-slate-500">Filter:</label>
                                    <select
                                        id="filterStatus"
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="admin-select"
                                    >
                                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowInviteForm((v) => !v)}
                                className="btn-primary-gradient px-4 py-2 rounded-lg text-sm font-semibold text-white"
                            >
                                Invite
                            </button>
                        </div>

                        {showInviteForm && (
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                                <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-4">
                                    <div className="flex-1 min-w-[200px]">
                                        <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                                        <input
                                            id="invite-email"
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            placeholder="user@example.com"
                                            className="admin-input"
                                        />
                                    </div>
                                    <div className="w-40">
                                        <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                                        <select
                                            id="invite-role"
                                            value={inviteRole}
                                            onChange={(e) => setInviteRole(e.target.value)}
                                            className="admin-select w-full"
                                        >
                                            {ROLES.map((r) => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={inviting}
                                        className="btn-primary-gradient px-4 py-2 rounded-lg text-sm font-semibold text-white"
                                    >
                                        {inviting ? 'Sending…' : 'Send invite'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={inviting}
                                        onClick={() => setShowInviteForm(false)}
                                        className="btn-outline px-4 py-2 rounded-lg text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                </form>
                            </div>
                        )}

                        {error && (
                            <div className="mx-6 mt-4 mb-2 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="admin-table-head">
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Revoke</th>
                                        <th style={{ textAlign: 'right' }}>Delete</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-8 text-center text-sm text-slate-400">
                                                Loading users and invitations…
                                            </td>
                                        </tr>
                                    ) : filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-8 text-center text-sm text-slate-400">
                                                No users found for the selected filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <tr key={user.id} className="admin-table-row">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">{user.email}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{user.role}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                                                        user.status === 'Accepted' ? 'badge-approved' :
                                                        user.status === 'Pending'  ? 'badge-pending'  :
                                                        user.status === 'Revoked' || user.status === 'Expired' ? 'badge-rejected' :
                                                        'badge-default'
                                                    }`}>
                                                        {user.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                    {user.type === 'invite' && user.status === 'Pending' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeactivate(user)}
                                                            className="text-red-500 hover:text-red-700 font-medium text-xs transition-colors"
                                                        >
                                                            Revoke Invite
                                                        </button>
                                                    ) : user.type === 'invite' ? (
                                                        <span className="text-xs text-slate-400">—</span>
                                                    ) : user.status === 'Active' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeactivate(user)}
                                                            className="text-red-500 hover:text-red-700 font-medium text-xs ml-2 transition-colors"
                                                        >
                                                            Deactivate
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleActivate(user)}
                                                            className="text-green-600 hover:text-green-800 font-medium text-xs ml-2 transition-colors"
                                                        >
                                                            Activate
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                    {user.type === 'invite' && user.status === 'Pending' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeactivate(user)}
                                                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                            title="Delete invitation"
                                                            aria-label="Delete invitation"
                                                        >
                                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                <path d="M3 6h18" />
                                                                <path d="M8 6V4h8v2" />
                                                                <path d="M19 6l-1 14H6L5 6" />
                                                                <path d="M10 11v6" />
                                                                <path d="M14 11v6" />
                                                            </svg>
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
