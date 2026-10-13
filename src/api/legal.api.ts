import { ApiClient } from '@/api/client';
import type { LegalDocumentKey, LegalDocumentMeta, SubprocessorsDocument } from '@/types/onboarding.types';

/** Public legal documents (PL-14): `lang` picks the language of the text, Italian when no translation exists. */
export const LegalApi = {
  getDocument: (key: LegalDocumentKey, lang?: string): Promise<LegalDocumentMeta> =>
    ApiClient.get<LegalDocumentMeta>(`/legal/${key}`, lang ? { lang } : undefined, { public: true }),
  getTos: (lang?: string): Promise<LegalDocumentMeta> => LegalApi.getDocument('tos', lang),
  getPrivacy: (lang?: string): Promise<LegalDocumentMeta> => LegalApi.getDocument('privacy', lang),
  getDpa: (lang?: string): Promise<LegalDocumentMeta> => LegalApi.getDocument('dpa', lang),
  getSubprocessors: (): Promise<SubprocessorsDocument> =>
    ApiClient.get<SubprocessorsDocument>('/legal/subprocessors', undefined, { public: true }),
};
