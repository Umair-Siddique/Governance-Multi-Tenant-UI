export const REVIEWER_DOCUMENTS = [
  {
    id: 'rev-2001',
    title: 'Branch Safety Drill Scan.pdf',
    status: 'REVIEW',
    category: 'Operations',
    tags: ['safety', 'drill'],
    uploadSource: 'manual',
    fileType: 'pdf',
    uploadedAt: '2026-03-09T07:12:00Z',
    extractedText: 'Emergency drill steps and branch evacuation guidance...',
    ocr: {
      quality: 'low',
      confidence: 0.58,
      flags: ['low-text', 'noisy-text'],
    },
    versions: [
      { version: 1, actor: 'editor@tenant.com', action: 'uploaded', at: '2026-03-09T07:12:00Z' },
      { version: 2, actor: 'pipeline@system', action: 'ocr-complete', at: '2026-03-09T07:20:00Z' },
    ],
  },
  {
    id: 'rev-2002',
    title: 'Regulatory Control Checklist.docx',
    status: 'REVIEW',
    category: 'Compliance',
    tags: ['control', 'audit'],
    uploadSource: 'sharepoint',
    fileType: 'docx',
    uploadedAt: '2026-03-08T12:40:00Z',
    extractedText: 'Control objective 1, evidence mapping, audit notes...',
    ocr: {
      quality: 'good',
      confidence: 0.94,
      flags: [],
    },
    versions: [
      { version: 1, actor: 'importer@system', action: 'imported', at: '2026-03-08T12:40:00Z' },
      { version: 2, actor: 'editor@tenant.com', action: 'metadata-updated', at: '2026-03-08T13:01:00Z' },
    ],
  },
  {
    id: 'rev-2003',
    title: 'Camera Photo Evidence.png',
    status: 'REVIEW',
    category: 'Security',
    tags: ['image', 'ocr'],
    uploadSource: 'manual',
    fileType: 'png',
    uploadedAt: '2026-03-09T09:05:00Z',
    extractedText: '',
    ocr: {
      quality: 'low',
      confidence: 0.31,
      flags: ['empty-text', 'low-confidence'],
    },
    versions: [
      { version: 1, actor: 'editor@tenant.com', action: 'uploaded', at: '2026-03-09T09:05:00Z' },
      { version: 2, actor: 'pipeline@system', action: 'ocr-flagged', at: '2026-03-09T09:07:00Z' },
    ],
  },
  {
    id: 'rev-2004',
    title: 'Supplier Contract Addendum.txt',
    status: 'APPROVED',
    category: 'Procurement',
    tags: ['contract', 'supplier'],
    uploadSource: 'manual',
    fileType: 'txt',
    uploadedAt: '2026-03-07T15:00:00Z',
    extractedText: 'Payment schedule and warranty obligations...',
    ocr: {
      quality: 'good',
      confidence: null,
      flags: [],
    },
    versions: [
      { version: 1, actor: 'editor@tenant.com', action: 'uploaded', at: '2026-03-07T15:00:00Z' },
      { version: 2, actor: 'reviewer@tenant.com', action: 'approved', at: '2026-03-07T16:12:00Z' },
    ],
  },
];

export function formatDate(isoString) {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString();
}

export function toneByStatus(value) {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'approved') return 'bg-success-soft text-success-500';
  if (normalized === 'review') return 'bg-warning-soft text-warning-500';
  if (normalized === 'rejected') return 'bg-error-soft text-error-500';
  return 'bg-background-subtle text-text-muted';
}

export function toneByQuality(value) {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'good') return 'bg-success-soft text-success-500';
  if (normalized === 'medium') return 'bg-warning-soft text-warning-500';
  return 'bg-error-soft text-error-500';
}
