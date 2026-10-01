import type { LegalDocumentKey } from '@/types/onboarding.types';

/**
 * Public pages of the CasaZen legal documents (PL-14): Terms, Privacy notice, DPA and subprocessors (GDPR art. 28),
 * linked from the public footer and from the onboarding consents step.
 */
export const LEGAL_INDEX_PATH = '/legale';
export const LEGAL_SUBPROCESSORS_PATH = '/legale/sub-responsabili';

export const LEGAL_DOCUMENT_PATHS: Record<LegalDocumentKey, string> = {
  tos: '/legale/termini',
  privacy: '/legale/privacy',
  dpa: '/legale/dpa',
};

export const LEGAL_DOCUMENT_KEYS: LegalDocumentKey[] = ['tos', 'privacy', 'dpa'];

/** Date a version is in force, as a calendar date in Europe/Rome (the backend stores it in UTC). */
export function formatLegalDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'Europe/Rome' }).format(new Date(iso));
}
