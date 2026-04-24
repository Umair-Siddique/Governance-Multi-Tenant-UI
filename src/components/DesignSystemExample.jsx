import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearTokens } from '../api/apiClient';

export default function DesignSystemExample() {
    const navigate = useNavigate();
    const [isDark, setIsDark] = useState(false);

    const handleLogout = () => {
        clearTokens();
        navigate('/login');
    };

    // Handle dark mode toggle
    useEffect(() => {
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    return (
        <div className="min-h-screen bg-background text-text-primary font-sans transition-colors duration-200">
            {/* Dashboard Layout: Sidebar + Content */}
            <div className="flex min-h-screen">

                {/* Sidebar */}
                <aside className="w-64 bg-surface border-r border-border hidden md:flex flex-col">
                    <div className="p-6 border-b border-border">
                        <h1 className="text-xl font-bold text-primary-600">SaaS App</h1>
                    </div>
                    <nav className="flex-1 p-4 space-y-1">
                        <a href="#" className="block px-4 py-2 rounded-md bg-primary-soft text-primary-500 font-medium">
                            Dashboard
                        </a>
                        <a href="#" className="block px-4 py-2 rounded-md text-text-secondary hover:bg-background-subtle hover:text-text-primary transition-colors">
                            Projects
                        </a>
                        <a href="#" className="block px-4 py-2 rounded-md text-text-secondary hover:bg-background-subtle hover:text-text-primary transition-colors">
                            Team
                        </a>
                        <a href="#" className="block px-4 py-2 rounded-md text-text-secondary hover:bg-background-subtle hover:text-text-primary transition-colors">
                            Settings
                        </a>
                        <button onClick={handleLogout} className="w-full text-left block px-4 py-2 rounded-md text-text-secondary hover:bg-background-subtle hover:text-text-primary transition-colors">
                            Logout
                        </button>
                    </nav>
                    <div className="p-4 border-t border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-soft flex items-center justify-center text-primary-500 font-bold">
                                JD
                            </div>
                            <div className="text-sm">
                                <p className="font-medium">John Doe</p>
                                <p className="text-text-secondary text-xs">Admin</p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1">
                    {/* Header */}
                    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shadow-sm">
                        <h2 className="text-lg font-semibold">Dashboard Overview</h2>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsDark(!isDark)}
                                className="p-2 rounded-md hover:bg-background-main text-text-secondary"
                            >
                                {isDark ? '☀️ Light' : '🌙 Dark'}
                            </button>
                            <button className="bg-primary-500 hover:bg-primary-600 text-text-inverse px-4 py-2 rounded-md shadow-sm transition-colors text-sm font-medium">
                                New Project
                            </button>
                        </div>
                    </header>

                    <div className="p-8 space-y-8">

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
                                <p className="text-text-secondary text-sm font-medium">Total Revenue</p>
                                <p className="text-3xl font-bold mt-2">$45,231.89</p>
                                <p className="text-success-600 text-sm mt-2 flex items-center gap-1">
                                    ↑ 20.1% <span className="text-text-secondary">from last month</span>
                                </p>
                            </div>
                            <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
                                <p className="text-text-secondary text-sm font-medium">Active Users</p>
                                <p className="text-3xl font-bold mt-2">+2350</p>
                                <p className="text-success-600 text-sm mt-2 flex items-center gap-1">
                                    ↑ 180.1% <span className="text-text-secondary">from last month</span>
                                </p>
                            </div>
                            <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
                                <p className="text-text-secondary text-sm font-medium">Pending Tasks</p>
                                <p className="text-3xl font-bold mt-2">12</p>
                                <p className="text-warning-500 text-sm mt-2 flex items-center gap-1">
                                    Requires attention
                                </p>
                            </div>
                        </div>

                        {/* Component Showcase using Card */}
                        <div className="bg-surface rounded-lg shadow-md border border-border overflow-hidden">
                            <div className="p-6 border-b border-border">
                                <h3 className="text-lg font-semibold">Component Library</h3>
                                <p className="text-text-secondary mt-1">Examples of design system components.</p>
                            </div>
                            <div className="p-6 space-y-8">

                                {/* Buttons */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium uppercase tracking-wider text-text-secondary">Buttons</h4>
                                    <div className="flex flex-wrap gap-4">
                                        <button className="bg-primary-500 hover:bg-primary-600 text-text-inverse px-4 py-2 rounded-md shadow-sm transition-colors font-medium focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
                                            Primary Button
                                        </button>
                                        <button className="bg-success-500 hover:bg-success-600 text-text-inverse px-4 py-2 rounded-md shadow-sm transition-colors font-medium focus:ring-2 focus:ring-success-500 focus:ring-offset-2">
                                            Secondary Button
                                        </button>
                                        <button className="bg-background-surface border border-border text-text-primary hover:bg-background-subtle px-4 py-2 rounded-md shadow-sm transition-colors font-medium focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
                                            Outline Button
                                        </button>
                                        <button className="bg-error-500 hover:bg-error-600 text-text-inverse px-4 py-2 rounded-md shadow-sm transition-colors font-medium">
                                            Destructive
                                        </button>
                                    </div>
                                </div>

                                {/* Inputs */}
                                <div className="space-y-4 max-w-md">
                                    <h4 className="text-sm font-medium uppercase tracking-wider text-text-secondary">Form Elements</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-text-primary mb-1">Email Address</label>
                                            <input
                                                type="email"
                                                placeholder="you@example.com"
                                                className="w-full px-3 py-2 bg-background-surface border border-border-default rounded-md shadow-sm placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-text-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-text-primary mb-1">Bio</label>
                                            <textarea
                                                className="w-full px-3 py-2 bg-surface border border-border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-text-primary"
                                                rows="3"
                                                placeholder="Tell us about yourself..."
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>

                                {/* Alerts */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium uppercase tracking-wider text-text-secondary">Alerts</h4>
                                    <div className="bg-info-500/10 border border-info-500/20 text-info-500 p-4 rounded-md flex items-start gap-3">
                                        <span className="text-xl">ℹ️</span>
                                        <div>
                                            <h5 className="font-semibold text-sm">Update Available</h5>
                                            <p className="text-sm mt-1 opacity-90">A new version of the dashboard is available. Refresh to update.</p>
                                        </div>
                                    </div>

                                    <div className="bg-danger-500/10 border border-danger-500/20 text-danger-600 p-4 rounded-md flex items-start gap-3">
                                        <span className="text-xl">⚠️</span>
                                        <div>
                                            <h5 className="font-semibold text-sm">Critical Error</h5>
                                            <p className="text-sm mt-1 opacity-90">Failed to connect to the database. Please contact support.</p>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
}

