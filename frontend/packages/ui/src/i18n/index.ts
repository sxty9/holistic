// i18n public surface. Importing this registers the core message bundle (side
// effect of ./messages), so any consumer of @holistic/ui has the shell + file
// strings available before first render.
import './messages';

export { LOCALES, DEFAULT_LOCALE, isLocale } from './locales';
export type { Locale, LocaleInfo } from './locales';
export { registerMessages, translate, hasMessage } from './engine';
export type { MessageVars, MessageValue, LocaleMessages, MessageBundle } from './engine';
export { LocaleProvider, useLocale, useT } from './provider';
export type { TranslateFn } from './provider';
