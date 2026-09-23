import { z } from 'zod';
import type { i18n as I18nInstance } from 'i18next';

let _i18n: I18nInstance | null = null;

export function setZodErrorMapI18n(i18n: I18nInstance): void {
  _i18n = i18n;
}

/**
 * Global Zod error map (Zod v4 `customError`).
 *
 * Zod v4 gives the message declared in the schema precedence over `customError`: this map
 * only runs for checks declared WITHOUT a message (e.g. `.max(100)`). Schema messages are
 * i18n keys and stay keys in `issue.message`; forms translate them at render time through
 * `FormFieldError` / `translateValidationMessage`.
 *
 * Here we return an already translated generic message (it needs the check parameters).
 */
export const i18nZodErrorMap: z.ZodErrorMap = (issue) => {
  if (!_i18n) return undefined;
  const t = _i18n.t.bind(_i18n);

  switch (issue.code) {
    case 'invalid_type': {
      const input = issue.input;
      const isEmpty =
        input === undefined ||
        input === null ||
        input === '' ||
        (typeof input === 'number' && Number.isNaN(input));
      return t(isEmpty ? 'validation.required' : 'validation.invalid');
    }
    case 'too_small': {
      const count = Number(issue.minimum);
      if (issue.origin === 'string') {
        return count <= 1 && issue.inclusive !== false
          ? t('validation.required')
          : t('validation.tooShort', { count });
      }
      if (issue.origin === 'array' || issue.origin === 'set') {
        return t('validation.tooFewItems', { count });
      }
      if (issue.origin === 'number' || issue.origin === 'bigint') {
        return t(issue.inclusive === false ? 'validation.greaterThan' : 'validation.min', { minimum: count });
      }
      return t('validation.invalid');
    }
    case 'too_big': {
      const count = Number(issue.maximum);
      if (issue.origin === 'string') {
        return t('validation.tooLong', { count });
      }
      if (issue.origin === 'array' || issue.origin === 'set') {
        return t('validation.tooManyItems', { count });
      }
      if (issue.origin === 'number' || issue.origin === 'bigint') {
        return t(issue.inclusive === false ? 'validation.lessThan' : 'validation.max', { maximum: count });
      }
      return t('validation.invalid');
    }
    case 'invalid_format':
      return t(issue.format === 'email' ? 'validation.email' : 'validation.format');
    case 'invalid_value':
      return t('validation.invalidOption');
    default:
      return t('validation.invalid');
  }
};
