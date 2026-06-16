// A tiny, dependency-free message catalog shared process-wide. @holistic/ui ships
// the core bundle; every service (and the app shell) registers its own bundle at
// module-load time via registerMessages(). Lookups fall back to English (US), then
// to the raw key, so a missing translation degrades gracefully instead of blanking
// the UI.

import { DEFAULT_LOCALE, type Locale } from './locales';

export type MessageVars = Record<string, string | number>;
/** A message is either a literal (with optional `{name}` placeholders) or, for
 *  plural/gender forms that differ per language, a function of its variables. */
export type MessageValue = string | ((vars: MessageVars) => string);
export type LocaleMessages = Record<string, MessageValue>;
export type MessageBundle = Partial<Record<Locale, LocaleMessages>>;

const catalog: Record<string, LocaleMessages> = {};

/** Merge a bundle into the shared catalog. Later registrations win on key clash,
 *  so a service can override a core string if it ever needs to. */
export function registerMessages(bundle: MessageBundle): void {
  for (const code of Object.keys(bundle) as Locale[]) {
    const messages = bundle[code];
    if (!messages) continue;
    (catalog[code] ??= {});
    Object.assign(catalog[code], messages);
  }
}

function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/** Resolve a key for a locale. Falls back: locale → en-US → the key itself. */
export function translate(locale: string, key: string, vars?: MessageVars): string {
  const value = catalog[locale]?.[key] ?? catalog[DEFAULT_LOCALE]?.[key];
  if (value == null) return key;
  return typeof value === 'function' ? value(vars ?? {}) : interpolate(value, vars);
}

/** Whether a key has a translation for this locale (or in the en-US fallback). */
export function hasMessage(locale: string, key: string): boolean {
  return catalog[locale]?.[key] != null || catalog[DEFAULT_LOCALE]?.[key] != null;
}
