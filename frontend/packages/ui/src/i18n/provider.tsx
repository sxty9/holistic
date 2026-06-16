import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales';
import { hasMessage, translate, type MessageVars } from './engine';

// The chosen language lives in localStorage, exactly like the theme — per device,
// no backend, default en-US. The provider keeps every useT()/useLocale() consumer
// in sync and mirrors the choice onto <html lang> for the platform & a11y.
const STORAGE_KEY = 'holistic-locale';

function readStored(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

/** A translator bound to the active locale. */
export interface TranslateFn {
  (key: string, vars?: MessageVars): string;
  /** True when `key` resolves to a real message (not just the raw key fallback). */
  has(key: string): boolean;
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStored);

  useEffect(() => {
    document.documentElement.lang = locale === 'en-US' ? 'en' : locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** [locale, setLocale]. Safe to call without a provider (resolves to en-US). */
export function useLocale(): [Locale, (locale: Locale) => void] {
  const ctx = useContext(LocaleContext);
  if (!ctx) return [DEFAULT_LOCALE, () => {}];
  return [ctx.locale, ctx.setLocale];
}

/** The translator for the active locale; re-renders consumers on language change. */
export function useT(): TranslateFn {
  const [locale] = useLocale();
  return useMemo(() => {
    const fn = ((key: string, vars?: MessageVars) => translate(locale, key, vars)) as TranslateFn;
    fn.has = (key: string) => hasMessage(locale, key);
    return fn;
  }, [locale]);
}
