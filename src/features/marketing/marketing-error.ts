import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';

const FRIENDLY_CODES: Record<string, string> = {
  marketing_ai_unavailable: 'marketingHub.errors.aiUnavailable',
  marketing_ai_invalid: 'marketingHub.errors.aiInvalid',
  marketing_search_unavailable: 'marketingHub.errors.searchUnavailable',
  marketing_city_required: 'marketingHub.errors.cityRequired',
  marketing_event_period_invalid: 'marketingHub.errors.periodInvalid',
};

export function marketingErrorText(error: unknown, t: TFunction, fallback?: string): string {
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  const key = code ? FRIENDLY_CODES[code] : undefined;
  if (key) return t(key);
  return getProblemMessage(error, t) ?? fallback ?? t('marketingHub.errors.generic');
}
