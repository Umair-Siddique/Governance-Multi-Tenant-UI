export const USER_BRANDING = {
  tenantName: 'Acme Governance Tenant',
  appName: 'Governance Chat',
};

export const CHAT_RETENTION_ENABLED = true;

export const SUPPORTED_LANGUAGES = [
  'Arabic',
  'English',
  'French',
  'Dutch',
  'German',
  'Spanish',
];

export const INITIAL_CHAT_SESSIONS = [
  {
    id: 'chat-3001',
    title: 'Onboarding policy Q&A',
    language: 'English',
    updatedAt: '2026-03-09T09:15:00Z',
  },
  {
    id: 'chat-3002',
    title: 'Incident process clarifications',
    language: 'French',
    updatedAt: '2026-03-08T13:25:00Z',
  },
];

const APPROVED_KNOWLEDGE = {
  English: [
    {
      keywords: ['onboarding', 'policy', 'employee'],
      answer: 'Approved onboarding policy requires ID verification, security briefing, and manager sign-off in the first week.',
      citations: ['Employee Handbook v3.2', 'HR Onboarding SOP - Approved'],
    },
    {
      keywords: ['incident', 'response', 'security'],
      answer: 'Approved incident response flow is Detect -> Triage -> Contain -> Recover -> Post-incident review.',
      citations: ['Incident Response Runbook - Approved'],
    },
  ],
  French: [
    {
      keywords: ['incident', 'securite', 'reponse'],
      answer: 'Le processus approuve est Detection -> Qualification -> Contention -> Recuperation -> Revue.',
      citations: ['Incident Response Runbook - Approved (FR summary)'],
    },
  ],
  Arabic: [],
  Dutch: [],
  German: [],
  Spanish: [],
};

const MIN_CONFIDENCE = 0.6;

function hasArabicChars(value) {
  return /[\u0600-\u06FF]/.test(value || '');
}

export function isQuestionCompatibleWithLanguage({ question, language }) {
  const containsArabic = hasArabicChars(question);
  if (language === 'Arabic') return containsArabic;
  return !containsArabic;
}

export function formatDate(isoString) {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString();
}

export function evaluateApprovedAnswer({ question, language, temporaryUpload }) {
  const normalized = (question || '').trim().toLowerCase();
  const entries = APPROVED_KNOWLEDGE[language] || [];

  let bestMatch = null;
  let bestConfidence = 0;

  entries.forEach((entry) => {
    const hitCount = entry.keywords.filter((keyword) => normalized.includes(keyword)).length;
    const confidence = hitCount / entry.keywords.length;
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = entry;
    }
  });

  if (!bestMatch) {
    return {
      type: 'refusal',
      text: 'I cannot answer this from approved knowledge. Please ask a question grounded in approved tenant content.',
      citations: [],
    };
  }

  if (bestConfidence < MIN_CONFIDENCE) {
    return {
      type: 'refusal',
      text: 'I cannot provide a reliable answer because confidence is low. Please ask a more specific question based on approved content.',
      citations: [],
    };
  }

  const uploadContext = temporaryUpload
    ? ` Temporary session file "${temporaryUpload.name}" was considered for this answer only.`
    : '';

  return {
    type: 'grounded',
    text: `${bestMatch.answer}${uploadContext}`,
    citations: bestMatch.citations,
  };
}
