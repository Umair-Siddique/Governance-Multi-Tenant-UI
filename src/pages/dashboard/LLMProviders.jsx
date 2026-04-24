import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getLLMProviders,
    createLLMProvider,
    updateLLMProvider,
    deleteLLMProvider,
    getSupportedProviders,
    getProviderModels,
} from '../../api/llmProviders';
import SettingsLayout from '../../components/dashboard/SettingsLayout';

const PROVIDER_LABELS = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    mistral: 'Mistral',
};

const emptyForm = {
    provider_type: '',
    name: '',
    api_key: '',
    default_model: '',
    is_active: true,
};

export default function LLMProviders() {
    const navigate = useNavigate();

    // ── State ──
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // Supported provider types from backend
    const [providerTypes, setProviderTypes] = useState([]);
    const [providerTypesLoading, setProviderTypesLoading] = useState(false);

    // Models from backend for selected provider
    const [availableModels, setAvailableModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(false);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [focusedSelect, setFocusedSelect] = useState(null);

    const [providerToDelete, setProviderToDelete] = useState(null);

    // ── Fetch supported provider types from backend ──
    const fetchProviderTypes = async () => {
        setProviderTypesLoading(true);
        try {
            const data = await getSupportedProviders();
            // Backend may return { providers: [...] } or a flat array
            const raw = Array.isArray(data) ? data : (data?.providers ?? data?.data ?? []);
            const types = Array.isArray(raw) && raw.length > 0
                ? raw.map((d) => (typeof d === 'string' ? d : d.provider_type || d.type || d.value || d))
                : [];
            setProviderTypes(types);
            if (types.length > 0) {
                setForm((f) => ({ ...f, provider_type: f.provider_type || types[0] }));
            }
        } catch {
            setProviderTypes([]);
        } finally {
            setProviderTypesLoading(false);
        }
    };

    // ── Fetch models for a specific provider type ──
    const fetchModelsForProvider = async (providerType) => {
        if (!providerType) { setAvailableModels([]); return; }
        setModelsLoading(true);
        setAvailableModels([]);
        try {
            const data = await getProviderModels(providerType);
            // Backend may return { models: [...] } or a flat array
            const raw = Array.isArray(data) ? data : (data?.models ?? data?.data ?? []);
            const models = Array.isArray(raw) && raw.length > 0
                ? raw.map((m) => (typeof m === 'string' ? m : m.id || m.model || m.name || m))
                : [];
            setAvailableModels(models);
            setForm((f) => ({
                ...f,
                default_model: f.default_model && models.includes(f.default_model) ? f.default_model : (models[0] || ''),
            }));
        } catch {
            setAvailableModels([]);
        } finally {
            setModelsLoading(false);
        }
    };

    // ── Data Fetching ──
    const fetchProviders = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getLLMProviders();
            setProviders(Array.isArray(data) ? data : (data?.providers ?? data?.data ?? []));
        } catch (err) {
            setError(err.message || 'Failed to load providers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProviders();
        fetchProviderTypes();
    }, []);

    // Fetch models whenever provider_type changes in form
    useEffect(() => {
        if (showModal && form.provider_type) {
            fetchModelsForProvider(form.provider_type);
        }
    }, [form.provider_type, showModal]);

    // ── Handlers ──
    const openCreate = () => {
        setEditingId(null);
        const defaultType = providerTypes[0] || '';
        setForm({ ...emptyForm, provider_type: defaultType });
        setFormError(null);
        setShowModal(true);
    };

    const openEdit = (provider) => {
        setEditingId(provider.id);
        setForm({
            provider_type: provider.provider_type || '',
            name: provider.name || '',
            api_key: '',
            default_model: provider.default_model || '',
            is_active: provider.is_active ?? true,
        });
        setFormError(null);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
        setFormError(null);
        setAvailableModels([]);
    };

    const handleProviderTypeChange = (newType) => {
        setForm((f) => ({ ...f, provider_type: newType, default_model: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError(null);

        if (!form.provider_type) { setFormError('Provider type is required.'); return; }
        if (!form.name.trim()) { setFormError('Name is required.'); return; }
        if (!editingId && !form.api_key) { setFormError('API key is required.'); return; }
        if (!form.default_model) { setFormError('Default model is required.'); return; }

        setSaving(true);
        try {
            if (editingId) {
                const payload = {
                    name: form.name.trim(),
                    default_model: form.default_model,
                    is_active: form.is_active,
                };
                if (form.api_key) payload.api_key = form.api_key;
                await updateLLMProvider(editingId, payload);
                setSuccessMsg('Provider updated successfully.');
            } else {
                await createLLMProvider({
                    provider_type: form.provider_type,
                    name: form.name.trim(),
                    api_key: form.api_key,
                    default_model: form.default_model,
                    is_active: form.is_active,
                });
                setSuccessMsg('Provider created successfully.');
            }
            closeModal();
            fetchProviders();
        } catch (err) {
            setFormError(err.message || 'Operation failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (provider) => {
        setProviderToDelete(provider);
    };

    const confirmDelete = async () => {
        if (!providerToDelete) return;
        setSaving(true);
        try {
            await deleteLLMProvider(providerToDelete.id);
            setSuccessMsg('Provider deleted.');
            setProviderToDelete(null);
            fetchProviders();
        } catch (err) {
            setError(err.message || 'Failed to delete provider');
            setProviderToDelete(null);
        } finally {
            setSaving(false);
        }
    };

    // ── Auto-dismiss success messages ──
    useEffect(() => {
        if (!successMsg) return;
        const t = setTimeout(() => setSuccessMsg(null), 4000);
        return () => clearTimeout(t);
    }, [successMsg]);

    // ── Render ──
    return (
        <SettingsLayout title="LLM Providers">
            <div className="space-y-6">
                {/* Success message */}
                {successMsg && (
                    <div className="p-4 rounded-lg text-sm bg-success-soft text-success-500 border border-success-500">
                        {successMsg}
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div className="p-4 rounded-lg text-sm bg-error-soft text-error-500 border border-error-500">
                        {error}
                        <button onClick={() => setError(null)} className="ml-3 underline text-error-500 hover:text-error-500 text-xs">Dismiss</button>
                    </div>
                )}

                {/* Providers Table */}
                <div className="bg-background-surface rounded-lg shadow border border-border-default overflow-hidden">
                    <div className="px-6 py-4 border-b border-border-default flex items-center justify-between gap-4 flex-wrap">
                        <h3 className="text-base font-semibold text-text-primary">All providers</h3>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-text-inverse text-sm font-medium rounded-lg shadow-sm transition-colors"
                        >
                            Add Provider
                        </button>
                    </div>

                    {loading ? (
                        <div className="px-6 py-12 text-center text-sm text-text-muted">Loading providers…</div>
                    ) : providers.length === 0 ? (
                        <div className="px-6 py-12 text-center text-sm text-text-muted">No LLM providers configured yet. Click "Add Provider" to get started.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border-default">
                                <thead className="bg-background-subtle">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Provider</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Default Model</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-background-surface divide-y divide-border-default">
                                    {providers.map((p) => (
                                        <tr key={p.id} className="hover:bg-background-subtle">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">{p.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{PROVIDER_LABELS[p.provider_type] || p.provider_type}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary font-mono">{p.default_model}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${p.is_active ? 'bg-success-soft text-success-500' : 'bg-background-subtle text-text-muted'}`}>
                                                    {p.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-3">
                                                <button type="button" onClick={() => openEdit(p)} className="text-primary-500 hover:text-primary-600 font-medium text-xs">
                                                    Edit
                                                </button>
                                                <button type="button" onClick={() => handleDelete(p)} className="text-error-500 hover:text-error-500 font-medium text-xs">
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Create / Edit Modal ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-500/40">
                    <div className="bg-background-surface rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-border-default">
                            <h2 className="text-lg font-semibold text-text-primary">
                                {editingId ? 'Edit Provider' : 'Add New Provider'}
                            </h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 rounded-lg text-sm bg-error-soft text-error-500 border border-error-500">{formError}</div>
                            )}

                            {/* Provider type */}
                            <div>
                                <label htmlFor="provider-type" className="block text-sm font-medium text-text-primary mb-1">Provider Type</label>
                                <div className="relative">
                                    <select
                                        id="provider-type"
                                        value={form.provider_type}
                                        onChange={(e) => handleProviderTypeChange(e.target.value)}
                                        onFocus={() => setFocusedSelect('provider-type')}
                                        onBlur={() => setFocusedSelect(null)}
                                        disabled={!!editingId || providerTypesLoading}
                                        className="w-full px-3 py-2 pr-10 border border-border-default rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm bg-background-surface disabled:bg-background-main disabled:cursor-not-allowed appearance-none"
                                    >
                                        {providerTypesLoading ? (
                                            <option value="">Loading…</option>
                                        ) : providerTypes.length === 0 ? (
                                            <option value="">No providers available</option>
                                        ) : (
                                            providerTypes.map((t) => (
                                                <option key={t} value={t}>{PROVIDER_LABELS[t] || t}</option>
                                            ))
                                        )}
                                    </select>
                                    <svg className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none transition-transform duration-200 ${focusedSelect === 'provider-type' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                </div>
                            </div>

                            {/* Name */}
                            <div>
                                <label htmlFor="provider-name" className="block text-sm font-medium text-text-primary mb-1">Name</label>
                                <input
                                    id="provider-name"
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. OpenAI GPT Provider"
                                    className="w-full px-3 py-2 border border-border-default rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm bg-background-surface"
                                />
                            </div>

                            {/* API Key */}
                            <div>
                                <label htmlFor="provider-key" className="block text-sm font-medium text-text-primary mb-1">API Key</label>
                                <input
                                    id="provider-key"
                                    type="password"
                                    value={form.api_key}
                                    onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                                    placeholder={editingId ? '•••••••••••• (leave blank to keep current)' : 'Enter API key'}
                                    className="w-full px-3 py-2 border border-border-default rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm bg-background-surface"
                                    autoComplete="off"
                                />
                            </div>

                            {/* Default Model — loaded from backend */}
                            <div>
                                <label htmlFor="default-model" className="block text-sm font-medium text-text-primary mb-1">Default Model</label>
                                <div className="relative">
                                    <select
                                        id="default-model"
                                        value={form.default_model}
                                        onChange={(e) => setForm((f) => ({ ...f, default_model: e.target.value }))}
                                        onFocus={() => setFocusedSelect('default-model')}
                                        onBlur={() => setFocusedSelect(null)}
                                        disabled={!form.provider_type || modelsLoading}
                                        className="w-full px-3 py-2 pr-10 border border-border-default rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm bg-background-surface disabled:bg-background-main disabled:cursor-not-allowed appearance-none"
                                    >
                                        {modelsLoading ? (
                                            <option value="">Loading models…</option>
                                        ) : availableModels.length === 0 ? (
                                            <option value="">No models found</option>
                                        ) : (
                                            availableModels.map((m) => (
                                                <option key={m} value={m}>{m}</option>
                                            ))
                                        )}
                                    </select>
                                    <svg className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none transition-transform duration-200 ${focusedSelect === 'default-model' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                </div>
                            </div>

                            {/* Is Active */}
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                                    className="h-4 w-4 rounded border-border-default text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-text-primary">Active</span>
                            </label>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 border border-border-default rounded-lg text-sm font-medium text-text-primary hover:bg-background-main"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-text-inverse text-sm font-medium rounded-lg shadow-sm transition-colors"
                                >
                                    {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation Modal ── */}
            {providerToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-500/40">
                    <div className="bg-background-surface rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                        <div className="px-6 py-5">
                            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-error-soft rounded-full mb-4">
                                <svg className="w-6 h-6 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-center text-text-primary mb-2">Delete Provider</h3>
                            <p className="text-sm text-center text-text-muted">
                                Are you sure you want to delete <span className="font-semibold text-text-primary">{providerToDelete.name}</span>? This action cannot be undone.
                            </p>

                            <div className="mt-6 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setProviderToDelete(null)}
                                    className="flex-1 px-4 py-2 border border-border-default rounded-lg text-sm font-medium text-text-primary hover:bg-background-main"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDelete}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-error-500 hover:bg-error-600 disabled:opacity-50 text-text-inverse text-sm font-medium rounded-lg shadow-sm transition-colors"
                                >
                                    {saving ? 'Deleting…' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </SettingsLayout>
    );
}
