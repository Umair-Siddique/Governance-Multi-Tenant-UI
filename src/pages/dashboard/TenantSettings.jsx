import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/dashboard/Sidebar';
import { getTenantSettings, updateTenantSettings, testTenantKey } from '../../api/tenantSettings';

const TENANT_TYPES = [
    { value: 'self_managed', label: 'Self-Managed (BYO-LLM)', description: 'Tenant provides API keys. Encrypted storage. Same governance enforcement. Platform does not pay usage costs.', default: true },
    { value: 'managed', label: 'Managed (Future tier)', description: 'Platform-managed credentials. Platform bears usage cost. Full governance enforcement.', default: false, disabled: true },
];

const LLM_PROVIDERS = [
    { value: '', label: 'Select provider' },
    { value: 'openai', label: 'OpenAI (GPT)' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'google', label: 'Google (Gemini)' },
    { value: 'mistral', label: 'Mistral' },
];

const OCR_PROVIDERS = [
    { value: 'none', label: 'None (built-in only)' },
    { value: 'google_vision', label: 'Google Cloud Vision' },
    { value: 'aws_textract', label: 'AWS Textract' },
];

const initialSettings = {
    tenantType: 'self_managed',
    llmProvider: '',
    llmKeySet: false,
    ocrProvider: 'none',
    ocrKeySet: false,
};

export default function TenantSettings() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState(initialSettings);
    const [loading, setLoading] = useState(true);
    const [llmKeyInput, setLlmKeyInput] = useState('');
    const [ocrKeyInput, setOcrKeyInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState(null);
    const [testingKey, setTestingKey] = useState(null);
    const [testResult, setTestResult] = useState(null);

    useEffect(() => {
        getTenantSettings()
            .then((data) => setSettings((s) => ({ ...s, ...data })))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSaveMessage(null);
        try {
            const payload = {
                tenantType: settings.tenantType,
                llmProvider: settings.llmProvider || undefined,
                ocrProvider: settings.ocrProvider !== 'none' ? settings.ocrProvider : undefined,
            };
            if (llmKeyInput) payload.llmApiKey = llmKeyInput;
            if (ocrKeyInput && settings.ocrProvider !== 'none') payload.ocrApiKey = ocrKeyInput;
            await updateTenantSettings(payload);
            if (llmKeyInput) {
                setSettings((s) => ({ ...s, llmKeySet: true }));
                setLlmKeyInput('');
            }
            if (ocrKeyInput && settings.ocrProvider !== 'none') {
                setSettings((s) => ({ ...s, ocrKeySet: true }));
                setOcrKeyInput('');
            }
            setSaveMessage({ type: 'success', text: 'Settings saved successfully.' });
        } catch (err) {
            setSaveMessage({ type: 'error', text: err.message || 'Failed to save.' });
        } finally {
            setSaving(false);
        }
    };

    const handleTestKey = async (type) => {
        setTestingKey(type);
        setTestResult(null);
        try {
            const data = await testTenantKey(type);
            setTestResult({ type, success: data.success, message: data.message || (data.success ? 'Key is valid.' : 'Test failed.') });
        } catch (err) {
            setTestResult({ type, success: false, message: err.message || 'Test failed.' });
        } finally {
            setTestingKey(null);
        }
    };

    const showOcrKeyField = settings.ocrProvider && settings.ocrProvider !== 'none';

    return (
        <div className="min-h-screen bg-background-main flex">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0">
                <header className="bg-background-surface shadow">
                    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-text-primary">Tenant Settings</h1>
                        <div className="flex items-center">
                            <span className="text-sm font-medium text-text-primary">Welcome Admin</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6 max-w-3xl">
                    {loading && (
                        <div className="mb-4 text-sm text-text-muted">Loading settings…</div>
                    )}

                    <div className="mb-6 p-4 bg-primary-soft border border-primary-500 rounded-lg text-sm text-primary-500">
                        <p className="font-medium mb-1">Key storage & usage</p>
                        <ul className="list-disc list-inside space-y-0.5 text-primary-500">
                            <li>Keys are encrypted at rest</li>
                            <li>Keys are used server-side only; never exposed to the client</li>
                            <li>Keys are isolated per tenant</li>
                        </ul>
                    </div>

                    <form onSubmit={handleSave} className="space-y-8">
                        <div className="bg-background-surface rounded-lg shadow border border-border-default overflow-hidden">
                            <div className="px-6 py-4 border-b border-border-default">
                                <h2 className="text-lg font-semibold text-text-primary">Tenant type</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                {TENANT_TYPES.map((t) => (
                                    <label
                                        key={t.value}
                                        className={`flex gap-4 p-4 rounded-lg border-2 cursor-pointer ${settings.tenantType === t.value ? 'border-primary-500 bg-primary-soft' : 'border-border-default hover:border-border-strong'} ${t.disabled ? 'opacity-60 pointer-events-none' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="tenantType"
                                            value={t.value}
                                            checked={settings.tenantType === t.value}
                                            onChange={() => !t.disabled && setSettings((s) => ({ ...s, tenantType: t.value }))}
                                            disabled={t.disabled}
                                            className="mt-1"
                                        />
                                        <div>
                                            <span className="font-medium text-text-primary">{t.label}</span>
                                            <p className="text-sm text-text-secondary mt-1">{t.description}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {settings.tenantType === 'self_managed' && (
                            <div className="bg-background-surface rounded-lg shadow border border-border-default overflow-hidden">
                                <div className="px-6 py-4 border-b border-border-default">
                                    <h2 className="text-lg font-semibold text-text-primary">LLM provider (BYO-Key)</h2>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label htmlFor="llm-provider" className="block text-sm font-medium text-text-primary mb-1">Provider</label>
                                        <select
                                            id="llm-provider"
                                            value={settings.llmProvider}
                                            onChange={(e) => setSettings((s) => ({ ...s, llmProvider: e.target.value }))}
                                            className="w-full px-3 py-2 border border-border-default rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm bg-background-surface"
                                        >
                                            {LLM_PROVIDERS.map((p) => (
                                                <option key={p.value || 'empty'} value={p.value} disabled={!p.value}>{p.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {settings.llmProvider && (
                                        <>
                                            <div>
                                                <label htmlFor="llm-key" className="block text-sm font-medium text-text-primary mb-1">API key</label>
                                                <input
                                                    id="llm-key"
                                                    type="password"
                                                    value={llmKeyInput}
                                                    onChange={(e) => setLlmKeyInput(e.target.value)}
                                                    placeholder={settings.llmKeySet ? '•••••••••••• (leave blank to keep current)' : 'Enter your API key'}
                                                    className="w-full px-3 py-2 border border-border-default rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm bg-background-surface"
                                                    autoComplete="off"
                                                />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleTestKey('llm')}
                                                    disabled={testingKey === 'llm' || (!settings.llmKeySet && !llmKeyInput)}
                                                    className="px-4 py-2 border border-border-default rounded-md text-sm font-medium text-text-primary hover:bg-background-subtle disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {testingKey === 'llm' ? 'Testing…' : 'Test key'}
                                                </button>
                                                {testResult?.type === 'llm' && (
                                                    <span className={`text-sm ${testResult.success ? 'text-success-500' : 'text-error-500'}`}>
                                                        {testResult.message}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="bg-background-surface rounded-lg shadow border border-border-default overflow-hidden">
                            <div className="px-6 py-4 border-b border-border-default">
                                <h2 className="text-lg font-semibold text-text-primary">OCR provider (optional)</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label htmlFor="ocr-provider" className="block text-sm font-medium text-text-primary mb-1">Provider</label>
                                    <select
                                        id="ocr-provider"
                                        value={settings.ocrProvider}
                                        onChange={(e) => setSettings((s) => ({ ...s, ocrProvider: e.target.value }))}
                                        className="w-full px-3 py-2 border border-border-default rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm bg-background-surface"
                                    >
                                        {OCR_PROVIDERS.map((p) => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                    </select>
                                </div>
                                {showOcrKeyField && (
                                    <>
                                        <div>
                                            <label htmlFor="ocr-key" className="block text-sm font-medium text-text-primary mb-1">API key</label>
                                            <input
                                                id="ocr-key"
                                                type="password"
                                                value={ocrKeyInput}
                                                onChange={(e) => setOcrKeyInput(e.target.value)}
                                                placeholder={settings.ocrKeySet ? '•••••••••••• (leave blank to keep current)' : 'Enter your OCR API key'}
                                                className="w-full px-3 py-2 border border-border-default rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm bg-background-surface"
                                                autoComplete="off"
                                            />
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => handleTestKey('ocr')}
                                                disabled={testingKey === 'ocr' || (!settings.ocrKeySet && !ocrKeyInput)}
                                                className="px-4 py-2 border border-border-default rounded-lg text-sm font-medium text-text-primary hover:bg-background-main disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {testingKey === 'ocr' ? 'Testing…' : 'Test key'}
                                            </button>
                                            {testResult?.type === 'ocr' && (
                                                <span className={`text-sm ${testResult.success ? 'text-success-500' : 'text-error-500'}`}>
                                                    {testResult.message}
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {saveMessage && (
                            <div className={`p-4 rounded-lg text-sm ${saveMessage.type === 'success' ? 'bg-success-soft text-success-500 border border-success-500' : 'bg-error-soft text-error-500 border border-error-500'}`}>
                                {saveMessage.text}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-text-inverse text-sm font-medium rounded-lg shadow-sm transition-colors"
                            >
                                {saving ? 'Saving…' : 'Save settings'}
                            </button>
                        </div>
                    </form>
                </main>
            </div>
        </div>
    );
}

