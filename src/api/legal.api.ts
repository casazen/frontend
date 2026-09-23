import { ApiClient } from '@/api/client';
import type { LegalDocumentMeta, SubprocessorsDocument } from '@/types/onboarding.types';

export const LegalApi = {
  getTos: (): Promise<LegalDocumentMeta> =>
    ApiClient.get<LegalDocumentMeta>('/legal/tos', undefined, { public: true }),
  getPrivacy: (): Promise<LegalDocumentMeta> =>
    ApiClient.get<LegalDocumentMeta>('/legal/privacy', undefined, { public: true }),
  getDpa: (): Promise<LegalDocumentMeta> =>
    ApiClient.get<LegalDocumentMeta>('/legal/dpa', undefined, { public: true }),
  getSubprocessors: (): Promise<SubprocessorsDocument> =>
    ApiClient.get<SubprocessorsDocument>('/legal/subprocessors', undefined, { public: true }),
};
