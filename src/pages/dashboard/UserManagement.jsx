import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/dashboard/Sidebar';
import ThemeToggle from '../../components/ui/ThemeToggle';
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
        <div className="min-h-screen bg-background-main flex">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0">
                <header className="bg-background-surface shadow">
                    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-text-primary">User Management</h1>
                        <div className="flex items-center gap-3">
                            <ThemeToggle />
                            {/* <span className="text-sm font-medium text-text-primary">Welcome Admin</span> */}
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6">
                    <div className="bg-background-surface rounded-lg shadow border border-border-default overflow-hidden">
                        <div className="px-6 py-4 border-b border-border-default flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-4 flex-wrap">
                                <h3 className="text-base font-semibold text-text-primary">All users</h3>

                                {/* Status Filter */}
                                <div className="flex items-center gap-2">
                                    <label htmlFor="filterStatus" className="text-xs text-text-muted">Filter:</label>
                                    <select
                                        id="filterStatus"
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="px-2 py-1 border border-border-default rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-xs bg-background-surface"
                                    >
                                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowInviteForm((v) => !v)}
                                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-text-inverse text-sm font-medium rounded-md shadow-sm transition-colors"
                            >
                                Invite
                            </button>
                        </div>
                        {showInviteForm && (
                            <div className="px-6 py-4 bg-background-subtle border-b border-border-default">
                                <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-4">
                                    <div className="flex-1 min-w-[200px]">
                                        <label htmlFor="invite-email" className="block text-sm font-medium text-text-primary mb-1">Email address</label>
                                        <input
                                            id="invite-email"
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            placeholder="user@example.com"
                                            className="w-full px-3 py-2 border border-border-default rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm bg-background-surface"
                                        />
                                    </div>
                                    <div className="w-40">
                                        <label htmlFor="invite-role" className="block text-sm font-medium text-text-primary mb-1">Role</label>
                                        <select
                                            id="invite-role"
                                            value={inviteRole}
                                            onChange={(e) => setInviteRole(e.target.value)}
                                            className="w-full px-3 py-2 border border-border-default rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm bg-background-surface"
                                        >
                                            {ROLES.map((r) => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={inviting}
                                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-text-inverse text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50"
                                    >
                                        {inviting ? 'Sending...' : 'Send invite'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={inviting}
                                        onClick={() => setShowInviteForm(false)}
                                        className="px-4 py-2 border border-border-default rounded-md text-sm font-medium text-text-primary hover:bg-background-subtle disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                </form>
                            </div>
                        )}

                        {error && (
                            <div className="mx-6 mt-4 mb-2 p-3 bg-error-soft text-error-500 border border-error-500 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border-default">
                                <thead className="bg-background-subtle">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Revoke</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Delete</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-background-surface divide-y divide-border-default">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-8 text-center text-sm text-text-muted">
                                                Loading users and invitations...
                                            </td>
                                        </tr>
                                    ) : filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-8 text-center text-sm text-text-muted">
                                                No users found for the selected filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <tr key={user.id} className="hover:bg-background-subtle">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">{user.email}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{user.role}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${user.status === 'Accepted' ? 'bg-success-soft text-success-500' : user.status === 'Pending' ? 'bg-warning-soft text-warning-500' : user.status === 'Revoked' || user.status === 'Expired' ? 'bg-error-soft text-error-500' : 'bg-background-subtle text-text-muted'}`}>
                                                        {user.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                    {user.type === 'invite' && user.status === 'Pending' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeactivate(user)}
                                                            className="text-error-500 hover:text-error-500 font-medium text-xs"
                                                        >
                                                            Revoke Invite
                                                        </button>
                                                    ) : user.type === 'invite' ? (
                                                        <span className="text-xs text-text-muted">-</span>
                                                    ) : user.status === 'Active' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeactivate(user)}
                                                            className="text-error-500 hover:text-error-500 font-medium text-xs ml-2"
                                                        >
                                                            Deactivate
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleActivate(user)}
                                                            className="text-success-500 hover:text-success-500 font-medium text-xs ml-2"
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
                                                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-error-500 hover:bg-error-soft"
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
                                                        <span className="text-xs text-text-muted">-</span>
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
