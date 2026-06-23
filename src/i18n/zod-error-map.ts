import { z } from 'zod';
import i18n from './config';

/**
 * Custom Zod error map that resolves i18n keys at display time.
 * Schema validation messages use dot-notation keys (e.g. 'property.validation.name.minLength').
 * When the key resolves to something different than the raw string, the translation is used.
 * Otherwise, the raw message is returned as-is (handles non-i18n Zod default messages).
 */
export const i18nZodErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.message) {
    const resolved = i18n.t(issue.message);
    if (resolved !== issue.message) {
      return { message: resolved };
    }
    return { message: issue.message };
  }
  return { message: ctx.defaultError };
};
