import React, { useEffect, useMemo, useState } from 'react';
import UserSidebar from '../../components/user/UserSidebar';
import { getPreferredLanguage, setPreferredLanguage } from '../../api/userPreferences';

export default function UserChatLayout({ title, children, noPageScroll = false }) {
  const [supportedLanguages, setSupportedLanguages] = useState([]);
  const [preferredLanguage, setPreferredLanguageState] = useState('English');
  const [languageLoading, setLanguageLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLanguageLoading(true);
        const data = await getPreferredLanguage();
        if (cancelled) return;
        setSupportedLanguages(data?.supported_languages || []);
        setPreferredLanguageState(data?.preferred_language || data?.default_language || 'English');
      } catch {
        if (!cancelled) {
          setSupportedLanguages([]);
          setPreferredLanguageState('English');
        }
      } finally {
        if (!cancelled) setLanguageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const languageOptions = useMemo(() => {
    const opts = Array.isArray(supportedLanguages) ? supportedLanguages : [];
    return opts.length ? opts : ['English'];
  }, [supportedLanguages]);

  async function handleLanguageChange(e) {
    const next = (e?.target?.value || '').toString();
    if (!next || next === preferredLanguage) return;
    // Optimistic update so the user sees it immediately.
    setPreferredLanguageState(next);
    try {
      await setPreferredLanguage(next);
    } catch {
      // Best-effort: revert to English if the update fails.
      setPreferredLanguageState('English');
    }
  }

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      <UserSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-100 shrink-0"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <div className="px-6 py-3.5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">AI Assistant</p>
            </div>
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              <select
                value={preferredLanguage}
                onChange={handleLanguageChange}
                disabled={languageLoading}
                className="h-8 pl-2 pr-7 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-all"
                aria-label="Preferred language"
              >
                {languageOptions.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>
        </header>
        <main
          className={`flex-1 min-h-0 w-full ${noPageScroll ? 'overflow-hidden' : 'overflow-y-auto'}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
