// The holistic-wide set of UI languages. English (US) is the canonical source
// language and the default for everyone who hasn't chosen otherwise; German and
// Japanese are full translations. Adding a language = add an entry here plus the
// matching column in every registered message bundle.

export type Locale = 'en-US' | 'de' | 'ja';

export interface LocaleInfo {
  code: Locale;
  /** English name, for menus rendered in English. */
  label: string;
  /** Endonym — how speakers name the language themselves (shown in the switcher). */
  native: string;
}

export const LOCALES: readonly LocaleInfo[] = [
  { code: 'en-US', label: 'English (US)', native: 'English (US)' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'ja', label: 'Japanese', native: '日本語' },
];

/** New users (and anyone without a stored choice) start here. */
export const DEFAULT_LOCALE: Locale = 'en-US';

export function isLocale(value: unknown): value is Locale {
  return value === 'en-US' || value === 'de' || value === 'ja';
}
