import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';

const FRIENDLY_CODES: Record<string, string> = {
  marketing_ai_unavailable: 'marketingHub.errors.aiUnavailable',
  marketing_ai_invalid: 'marketingHub.errors.aiInvalid',
  marketing_search_unavailable: 'marketingHub.errors.searchUnavailable',
  marketing_city_required: 'marketingHub.errors.cityRequired',
  marketing_event_period_invalid: 'marketingHub.errors.periodInvalid',
  marketing_voice_invalid: 'marketingHub.errors.voiceInvalid',
  marketing_settings_invalid: 'marketingHub.errors.settingsInvalid',
  import_file_empty: 'marketingHub.errors.importEmpty',
  invalid_mapping: 'marketingHub.errors.importMapping',
  invalid_basis: 'marketingHub.errors.importDetails',
  invalid_source: 'marketingHub.errors.importDetails',
  property_unavailable: 'marketingHub.errors.importProperty',
  import_concurrent_write: 'marketingHub.errors.importBusy',
};

const FRIENDLY_STATUSES: Record<number, string> = {
  413: 'marketingHub.errors.fileTooLarge',
  415: 'marketingHub.errors.fileUnsupported',
};

export function marketingErrorText(error: unknown, t: TFunction, fallback?: string): string {
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  const status = getHttpStatus(error);
  const key = (code ? FRIENDLY_CODES[code] : undefined) ?? (status ? FRIENDLY_STATUSES[status] : undefined);
  if (key) return t(key);
  return getProblemMessage(error, t) ?? fallback ?? t('marketingHub.errors.generic');
}
