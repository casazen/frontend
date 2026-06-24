import { z } from 'zod';
import type { i18n as I18nInstance } from 'i18next';

let _i18n: I18nInstance | null = null;

export function setZodErrorMapI18n(i18n: I18nInstance): void {
  _i18n = i18n;
}

function resolveI18nMessage(message: string): string {
  if (!_i18n) return message;
  const resolved = _i18n.t(message);
  return resolved !== message ? resolved : message;
}

export const i18nZodErrorMap: z.ZodErrorMap = (issue) => {
  if (issue.message) {
    const resolved = resolveI18nMessage(issue.message);
    if (resolved !== issue.message) {
      return { message: resolved };
    }
    return { message: issue.message };
  }
  if ('defaultError' in issue) {
    return { message: (issue as Record<string, string>).defaultError };
  }
  return { message: 'Invalid input' };
};
