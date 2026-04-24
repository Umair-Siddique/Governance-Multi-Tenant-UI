export const EDITOR_STATUSES = ['DRAFT', 'REVIEW', 'APPROVED'];

export const EDITOR_DOCUMENTS = [
  {
    id: 'doc-1001',
    title: 'Safety Procedure - Plant A.pdf',
    status: 'DRAFT',
    category: 'Operations',
    tags: ['safety', 'plant-a'],
    uploadSource: 'manual',
    fileType: 'pdf',
    uploadedAt: '2026-03-07T11:22:00Z',
    processingState: 'processing',
    ocr: {
      used: true,
      status: 'processing',
      confidence: 0.72,
      flags: ['low-text-density'],
    },
    extractedText: 'OCR in progress. Partial text available...',
    versions: [
      { version: 1, updatedAt: '2026-03-07T11:22:00Z', actor: 'editor@tenant.com', note: 'Initial upload' },
    ],
  },
  {
    id: 'doc-1002',
    title: 'HR Policy Handbook.docx',
    status: 'REVIEW',
    category: 'HR',
    tags: ['policy', 'handbook'],
    uploadSource: 'sharepoint',
    fileType: 'docx',
    uploadedAt: '2026-03-06T08:10:00Z',
    processingState: 'done',
    ocr: {
      used: false,
      status: 'not_required',
      confidence: null,
      flags: [],
    },
    extractedText: 'Employee conduct policy, leave policy, and onboarding requirements...',
    versions: [
      { version: 1, updatedAt: '2026-03-06T08:10:00Z', actor: 'importer@system', note: 'Imported from SharePoint' },
      { version: 2, updatedAt: '2026-03-06T09:44:00Z', actor: 'editor@tenant.com', note: 'Metadata update' },
    ],
  },
  {
    id: 'doc-1003',
    title: 'Incident Response Runbook.txt',
    status: 'APPROVED',
    category: 'Security',
    tags: ['incident-response', 'runbook'],
    uploadSource: 'manual',
    fileType: 'txt',
    uploadedAt: '2026-03-05T17:30:00Z',
    processingState: 'done',
    ocr: {
      used: false,
      status: 'not_required',
      confidence: null,
      flags: [],
    },
    extractedText: 'Step 1: classify incident severity. Step 2: isolate impacted systems...',
    versions: [
      { version: 1, updatedAt: '2026-03-05T17:30:00Z', actor: 'editor@tenant.com', note: 'Initial upload' },
      { version: 2, updatedAt: '2026-03-05T18:05:00Z', actor: 'reviewer@tenant.com', note: 'Approved for indexing' },
    ],
  },
  {
    id: 'doc-1004',
    title: 'Invoice Archive 2025.zip',
    status: 'DRAFT',
    category: 'Finance',
    tags: ['invoice', 'archive'],
    uploadSource: 'sharepoint',
    fileType: 'zip',
    uploadedAt: '2026-03-08T14:12:00Z',
    processingState: 'queued',
    ocr: {
      used: true,
      status: 'queued',
      confidence: null,
      flags: [],
    },
    extractedText: 'Extraction queued.',
    versions: [
      { version: 1, updatedAt: '2026-03-08T14:12:00Z', actor: 'importer@system', note: 'Bulk import created draft' },
    ],
  },
  {
    id: 'doc-1005',
    title: 'Warehouse Camera Snapshot.png',
    status: 'DRAFT',
    category: 'Operations',
    tags: ['ocr', 'image'],
    uploadSource: 'manual',
    fileType: 'png',
    uploadedAt: '2026-03-08T15:04:00Z',
    processingState: 'failed',
    ocr: {
      used: true,
      status: 'failed',
      confidence: 0.35,
      flags: ['noisy-text', 'low-confidence'],
    },
    extractedText: '',
    versions: [
      { version: 1, updatedAt: '2026-03-08T15:04:00Z', actor: 'editor@tenant.com', note: 'Initial upload' },
      { version: 2, updatedAt: '2026-03-08T15:19:00Z', actor: 'system@pipeline', note: 'OCR failed' },
    ],
  },
];

export const IMPORT_OCR_JOBS = [
  { id: 'job-9001', type: 'SharePoint Import', status: 'done', startedAt: '2026-03-08T10:00:00Z', endedAt: '2026-03-08T10:09:00Z' },
  { id: 'job-9002', type: 'OCR Batch', status: 'processing', startedAt: '2026-03-09T08:40:00Z', endedAt: null },
  { id: 'job-9003', type: 'Manual Upload Parse', status: 'queued', startedAt: null, endedAt: null },
  { id: 'job-9004', type: 'SharePoint Import', status: 'failed', startedAt: '2026-03-07T07:00:00Z', endedAt: '2026-03-07T07:02:00Z' },
];

export function formatDate(isoString) {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString();
}

export function statusTone(value) {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'approved' || normalized === 'done') return 'bg-success-soft text-success-500';
  if (normalized === 'review' || normalized === 'processing') return 'bg-warning-soft text-warning-500';
  if (normalized === 'failed' || normalized === 'reject') return 'bg-error-soft text-error-500';
  return 'bg-background-subtle text-text-muted';
}
