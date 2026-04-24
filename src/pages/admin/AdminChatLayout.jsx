import React, { useEffect, useMemo, useState } from 'react';
import AdminChatSidebar from '../../components/admin/AdminChatSidebar';
import ThemeToggle from '../../components/ui/ThemeToggle';
import { getPreferredLanguage, setPreferredLanguage } from '../../api/userPreferences';

export default function AdminChatLayout({ title, children, noPageScroll = false }) {
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
    setPreferredLanguageState(next);
    try {
      await setPreferredLanguage(next);
    } catch {
      setPreferredLanguageState('English');
    }
  }

  return (
    <div className="h-screen bg-background-main flex overflow-hidden">
      <AdminChatSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-background-surface shadow border-b border-border-default">
          <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 flex items-center justify-between gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">{title}</h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <span className="hidden sm:inline">Language</span>
                <select
                  value={preferredLanguage}
                  onChange={handleLanguageChange}
                  disabled={languageLoading}
                  className="h-9 px-2 rounded-md border border-border-default bg-background-surface text-text-primary text-sm disabled:opacity-60"
                  aria-label="Preferred language"
                >
                  {languageOptions.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </label>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main
          className={`flex-1 min-h-0 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 ${
            noPageScroll ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

