import type { TFunction, i18n as I18nInstance } from 'i18next';

/**
 * Translates a form validation message.
 *
 * Zod schemas declare i18n keys as messages (e.g. `property.validation.name.minLength`) and
 * Zod v4 returns them untouched, so they must be translated when rendered. Messages that are
 * not keys (already translated by the global error map, or coming from the server) are
 * returned as they are.
 */
export function translateValidationMessage(
  message: string | undefined | null,
  t: TFunction,
  i18n: Pick<I18nInstance, 'exists'>,
): string | undefined {
  if (!message) return undefined;
  return i18n.exists(message) ? String(t(message)) : message;
}
