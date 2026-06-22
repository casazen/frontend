import { ApiClient } from '@/api/client';
import type { LegalDocumentMeta, SubprocessorsDocument } from '@/types/onboarding.types';

export const LegalApi = {
  getTos: (): Promise<LegalDocumentMeta> => ApiClient.get<LegalDocumentMeta>('/legal/tos'),
  getPrivacy: (): Promise<LegalDocumentMeta> => ApiClient.get<LegalDocumentMeta>('/legal/privacy'),
  getDpa: (): Promise<LegalDocumentMeta> => ApiClient.get<LegalDocumentMeta>('/legal/dpa'),
  getSubprocessors: (): Promise<SubprocessorsDocument> =>
    ApiClient.get<SubprocessorsDocument>('/legal/subprocessors'),
};
