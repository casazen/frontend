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

// The module is a public page, as the real one is: nothing here carries the token of a signed-in user.
const PUBLIC = { public: true } as const;

/** The parameters of the link as a query string (the ones that are there). */
function queryOf(link: CfSimulatorLinkParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(link)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}

/**
 * The simulated module of the service that prepares the contract (CF-SIM, task CF-SIM of the backend): test environments only. Where the
 * simulator is off every call answers 404 and the page says it is not available.
 */
export const CfSimulatorApi = {
  /** What the module learns from its link when its page opens (signature and expiry checked as the service does). */
  checkLink: (link: CfSimulatorLinkParams): Promise<CfSimulatorLinkResponse> =>
    ApiClient.get<CfSimulatorLinkResponse>('/cf-simulator/link', link, PUBLIC),

  /** The "send" of the module: takes the practice in. Bound to the contract only when the link is good. */
  createPractice: (link: CfSimulatorLinkParams): Promise<CfSimulatorCreatedPractice> =>
    ApiClient.post<CfSimulatorCreatedPractice>(`/cf-simulator/practices?${queryOf(link)}`, undefined, PUBLIC),

  /** Moves the practice to a state (any), with the reason when it is closed without attestation. */
  setStatus: (practiceId: string, body: CfSimulatorSetStatusBody): Promise<CfSimulatorPractice> =>
    ApiClient.post<CfSimulatorPractice>(`/cf-simulator/practices/${encodeURIComponent(practiceId)}/status`, body, PUBLIC),

  /** A sample PDF of the practice. */
  downloadDocument: async (practiceId: string, kind: CfSimulatorDocumentKind, controlToken: string): Promise<Blob> =>
    (
      await axios.get<Blob>(`/cf-simulator/practices/${encodeURIComponent(practiceId)}/documents/${kind}`, {
        params: { controlToken },
        responseType: 'blob',
        public: true,
      })
    ).data,
};
