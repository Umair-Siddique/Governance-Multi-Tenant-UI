import React from 'react';
import { Navigate } from 'react-router-dom';
import { getAccessToken } from '../../api/apiClient';
import { getUserRole, getDashboardRouteForRole } from '../../utils/authUtils';

/**
 * ProtectedRoute Wrapper
 * Enforces both authentication (must be logged in)
 * and authorization (must have an allowed role).
 * 
 * @param {object} props
 * @param {string[]} props.allowedRoles Array of allowed roles (e.g., ['admin', 'editor'])
 * @param {React.ReactNode} props.children 
 */
export default function ProtectedRoute({ allowedRoles, children }) {
    const token = getAccessToken();
    
    if (!token) {
        // Not authenticated
        return <Navigate to="/" replace />;
    }

    const currentRole = getUserRole();

    if (allowedRoles && !allowedRoles.includes(currentRole)) {
        // Not authorized for this route, redirect to their role-specific dashboard
        return <Navigate to={getDashboardRouteForRole(currentRole)} replace />;
    }

    // Authenticated & Authorized
    return children;
}
