import axios from '@/lib/axios';
import { ApiClient } from '@/api/client';
import type {
  CfSimulatorCreatedPractice,
  CfSimulatorDocumentKind,
  CfSimulatorLinkParams,
  CfSimulatorLinkResponse,
  CfSimulatorPractice,
  CfSimulatorSetStatusBody,
} from '@/types/cf-simulator.types';

const PUBLIC = { public: true } as const;

function queryOf(link: CfSimulatorLinkParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(link)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}

export const CfSimulatorApi = {
  checkLink: (link: CfSimulatorLinkParams): Promise<CfSimulatorLinkResponse> =>
    ApiClient.get<CfSimulatorLinkResponse>('/cf-simulator/link', link, PUBLIC),

  createPractice: (link: CfSimulatorLinkParams): Promise<CfSimulatorCreatedPractice> =>
    ApiClient.post<CfSimulatorCreatedPractice>(`/cf-simulator/practices?${queryOf(link)}`, undefined, PUBLIC),

  setStatus: (practiceId: string, body: CfSimulatorSetStatusBody): Promise<CfSimulatorPractice> =>
    ApiClient.post<CfSimulatorPractice>(`/cf-simulator/practices/${encodeURIComponent(practiceId)}/status`, body, PUBLIC),

  downloadDocument: async (practiceId: string, kind: CfSimulatorDocumentKind, controlToken: string): Promise<Blob> =>
    (
      await axios.get<Blob>(`/cf-simulator/practices/${encodeURIComponent(practiceId)}/documents/${kind}`, {
        params: { controlToken },
        responseType: 'blob',
        public: true,
      })
    ).data,
};
