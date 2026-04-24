import { EDITOR_DOCUMENTS } from '../editor/editorData';
import { REVIEWER_DOCUMENTS } from '../reviewer/reviewerData';

export const TENANT_HEALTH = {
  status: 'healthy',
  checks: [
    { name: 'API latency', value: '142ms', status: 'ok' },
    { name: 'Vector index sync', value: 'Up to date', status: 'ok' },
    { name: 'OCR backlog', value: '4 pending', status: 'warning' },
  ],
};

export const USAGE_OVERVIEW = {
  monthlyQueries: 12480,
  activeUsers: 86,
  storageGb: 42.7,
  refusalRate: 0.17,
};

export const POLICY_STATUS = [
  { key: 'Chat Retention', value: '90 days', enforced: true },
  { key: 'Logging Level', value: 'Standard', enforced: true },
  { key: 'Analytics Depth', value: 'High-level', enforced: true },
  { key: 'OCR Deletion', value: 'Delete source after 30 days', enforced: true },
];

export const SHAREPOINT_CONNECTIONS = [
  { id: 'sp-001', name: 'Corporate SharePoint', status: 'connected', mode: 'read-only' },
  { id: 'sp-002', name: 'Audit Library', status: 'connected', mode: 'read-only' },
];

export const SHAREPOINT_FOLDERS = [
  { id: 'fld-100', label: 'Policies/2026' },
  { id: 'fld-101', label: 'Operations/SOP' },
  { id: 'fld-102', label: 'Security/Incident Reports' },
  { id: 'fld-103', label: 'Finance/Invoices' },
];

export const IMPORT_RUNS = [
  { id: 'run-5001', source: 'Corporate SharePoint', docs: 1200, status: 'done', landedStatus: 'DRAFT', startedAt: '2026-03-09T07:00:00Z' },
  { id: 'run-5002', source: 'Audit Library', docs: 430, status: 'processing', landedStatus: 'DRAFT', startedAt: '2026-03-09T09:20:00Z' },
  { id: 'run-5003', source: 'Corporate SharePoint', docs: 300, status: 'failed', landedStatus: 'DRAFT', startedAt: '2026-03-08T18:15:00Z' },
];

export const ANALYTICS = {
  usageMetrics: [
    { label: 'Total questions (30d)', value: 12480 },
    { label: 'Grounded answers (30d)', value: 10240 },
    { label: 'Refusals (30d)', value: 2240 },
  ],
  languageUsage: [
    { language: 'English', percent: 46 },
    { language: 'French', percent: 18 },
    { language: 'German', percent: 12 },
    { language: 'Arabic', percent: 9 },
    { language: 'Spanish', percent: 8 },
    { language: 'Dutch', percent: 7 },
  ],
  validationOutcomes: [
    { label: 'Supported by approved docs', value: 82 },
    { label: 'Refused outside approved scope', value: 18 },
  ],
};

export const AUDIT_LOGS = [
  { id: 'evt-7001', at: '2026-03-09T07:30:00Z', actor: 'editor@tenant.com', type: 'upload', details: 'Uploaded 42 files (manual)' },
  { id: 'evt-7002', at: '2026-03-09T08:05:00Z', actor: 'reviewer@tenant.com', type: 'batch_approve', details: 'Batch ID B-11, docs: 220' },
  { id: 'evt-7003', at: '2026-03-09T08:12:00Z', actor: 'admin@tenant.com', type: 'policy_change', details: 'Updated chat retention to 90 days' },
  { id: 'evt-7004', at: '2026-03-09T09:00:00Z', actor: 'admin@tenant.com', type: 'provider_change', details: 'LLM provider switched to OpenAI' },
  { id: 'evt-7005', at: '2026-03-09T09:10:00Z', actor: 'admin@tenant.com', type: 'role_change', details: 'User role changed: Editor -> Reviewer' },
  { id: 'evt-7006', at: '2026-03-09T10:02:00Z', actor: 'reviewer@tenant.com', type: 'reject', details: 'Rejected doc rev-2003 due to low OCR quality' },
];

export const DEFAULT_BRANDING = {
  tenantDisplayName: 'Acme Governance Tenant',
  primaryColor: '#2563eb',
  secondaryColor: '#0f172a',
  subdomain: 'acme-governance',
};

export function formatDate(isoString) {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString();
}

export function tone(value) {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'done' || normalized === 'connected' || normalized === 'ok' || normalized === 'healthy') return 'bg-success-soft text-success-500';
  if (normalized === 'processing' || normalized === 'warning') return 'bg-warning-soft text-warning-500';
  if (normalized === 'failed') return 'bg-error-soft text-error-500';
  return 'bg-background-subtle text-text-muted';
}

export function editorAndReviewerSummary() {
  const draft = EDITOR_DOCUMENTS.filter((d) => d.status === 'DRAFT').length;
  const review = REVIEWER_DOCUMENTS.filter((d) => d.status === 'REVIEW').length;
  const approved = EDITOR_DOCUMENTS.filter((d) => d.status === 'APPROVED').length;
  return { draft, review, approved };
}
