import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DesignSystemExample from './components/DesignSystemExample';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Callback from './pages/auth/Callback';
import TenantCreate from './pages/auth/TenantCreate';
import AcceptInvite from './pages/auth/AcceptInvite';
import ProtectedRoute from './components/auth/ProtectedRoute';

import UserDashboard from './pages/dashboard/UserDashboard';
import UserManagement from './pages/dashboard/UserManagement';
import TenantSettings from './pages/dashboard/TenantSettings';
import LLMProviders from './pages/dashboard/LLMProviders';
import ProfileSettings from './pages/dashboard/ProfileSettings';
import EditorDashboard from './pages/editor/EditorDashboard';
import CMSLibrary from './pages/editor/CMSLibrary';
import UploadPage from './pages/editor/UploadPage';
import DocumentDetail from './pages/editor/DocumentDetail';
import EditorSettings from './pages/editor/EditorSettings';
import ReviewerDashboard from './pages/reviewer/ReviewerDashboard';
import ReviewQueue from './pages/reviewer/ReviewQueue';
import ApprovedDocuments from './pages/reviewer/ApprovedDocuments';
import ReviewDetail from './pages/reviewer/ReviewDetail';
import ReviewerSettings from './pages/reviewer/ReviewerSettings';
import ChatHome from './pages/user/ChatHome';
import NewChatRedirect from './pages/user/NewChatRedirect';
import ChatSession from './pages/user/ChatSession';
import ContextManagement from './pages/admin/ContextManagement';
import AdminChatHome from './pages/admin/AdminChatHome';
import AdminNewChatRedirect from './pages/admin/AdminNewChatRedirect';
import AdminChatSession from './pages/admin/AdminChatSession';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/accept-invite/:token" element={<AcceptInvite />} />
        <Route path="/auth/callback" element={<Callback />} />
        <Route path="/create-tenant" element={<TenantCreate />} />

        {/* --- Admin Routes --- */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><UserDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/user-management" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
        <Route path="/dashboard/tenant-settings" element={<ProtectedRoute allowedRoles={['admin']}><TenantSettings /></ProtectedRoute>} />
        <Route path="/dashboard/context-management" element={<ProtectedRoute allowedRoles={['admin']}><ContextManagement /></ProtectedRoute>} />

        {/* Settings Routes (Admin) */}
        <Route path="/dashboard/settings" element={<ProtectedRoute allowedRoles={['admin']}><Navigate to="/dashboard/settings/llm-providers" replace /></ProtectedRoute>} />
        <Route path="/dashboard/settings/llm-providers" element={<ProtectedRoute allowedRoles={['admin']}><LLMProviders /></ProtectedRoute>} />
        <Route path="/dashboard/settings/profile" element={<ProtectedRoute allowedRoles={['admin']}><ProfileSettings /></ProtectedRoute>} />

        {/* --- Admin Chat Routes --- */}
        <Route path="/dashboard/chat" element={<ProtectedRoute allowedRoles={['admin']}><AdminChatHome /></ProtectedRoute>} />
        <Route path="/dashboard/chat/new" element={<ProtectedRoute allowedRoles={['admin']}><AdminNewChatRedirect /></ProtectedRoute>} />
        <Route path="/dashboard/chat/session/:sessionId" element={<ProtectedRoute allowedRoles={['admin']}><AdminChatSession /></ProtectedRoute>} />

        {/* --- Editor Routes --- */}
        <Route path="/editor/dashboard" element={<ProtectedRoute allowedRoles={['editor', 'admin']}><EditorDashboard /></ProtectedRoute>} />
        <Route path="/editor/library" element={<ProtectedRoute allowedRoles={['editor', 'admin']}><CMSLibrary /></ProtectedRoute>} />
        <Route path="/editor/upload" element={<ProtectedRoute allowedRoles={['editor', 'admin']}><UploadPage /></ProtectedRoute>} />
        <Route path="/editor/documents/:documentId" element={<ProtectedRoute allowedRoles={['editor', 'admin']}><DocumentDetail /></ProtectedRoute>} />
        <Route path="/editor/settings" element={<ProtectedRoute allowedRoles={['editor', 'admin']}><EditorSettings /></ProtectedRoute>} />

        {/* --- Reviewer Routes --- */}
        <Route path="/reviewer/dashboard" element={<ProtectedRoute allowedRoles={['reviewer', 'admin']}><ReviewerDashboard /></ProtectedRoute>} />
        <Route path="/reviewer/queue" element={<ProtectedRoute allowedRoles={['reviewer', 'admin']}><ReviewQueue /></ProtectedRoute>} />
        <Route path="/reviewer/approved" element={<ProtectedRoute allowedRoles={['reviewer', 'admin']}><ApprovedDocuments /></ProtectedRoute>} />
        <Route path="/reviewer/documents/:documentId" element={<ProtectedRoute allowedRoles={['reviewer', 'admin']}><ReviewDetail /></ProtectedRoute>} />
        <Route path="/reviewer/settings" element={<ProtectedRoute allowedRoles={['reviewer', 'admin']}><ReviewerSettings /></ProtectedRoute>} />

        {/* --- User/Chat Routes --- */}
        <Route path="/user/chat" element={<ProtectedRoute allowedRoles={['user', 'admin']}><ChatHome /></ProtectedRoute>} />
        <Route path="/user/chat/new" element={<ProtectedRoute allowedRoles={['user', 'admin']}><NewChatRedirect /></ProtectedRoute>} />
        <Route path="/user/chat/session/:sessionId" element={<ProtectedRoute allowedRoles={['user', 'admin']}><ChatSession /></ProtectedRoute>} />

        {/* Backward Compatibility Redirects */}
        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
        <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />

        {/* Deprecated/Old LLM Providers Route (optional: keep or remove) */}
        <Route path="/dashboard/llm-providers" element={<Navigate to="/dashboard/settings/llm-providers" replace />} />

        <Route path="/" element={<Login />} />
        <Route path="/design-system" element={<DesignSystemExample />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
