import { useMutation, useQuery } from '@tanstack/react-query';
import { CfSimulatorApi } from '@/api/cf-simulator.api';
import { saveBlobAs } from '@/lib/file-download';
import type {
  CfSimulatorDocumentKind,
  CfSimulatorLinkParams,
  CfSimulatorSetStatusBody,
} from '@/types/cf-simulator.types';

/** File names of the sample documents the panel downloads. */
const DOCUMENT_FILE_NAMES: Record<CfSimulatorDocumentKind, string> = {
  contract: 'contratto-esempio',
  attestation: 'attestazione-esempio',
  receipt: 'ricevuta-registrazione-esempio',
};

/**
 * What the simulated module learns from its link when the page opens (CF-SIM). Asked once: a 404 is the answer (the simulator is off),
 * and a second read would only ask the server again about the same link.
 */
export function useCfSimulatorLink(link: CfSimulatorLinkParams, enabled: boolean) {
  return useQuery({
    queryKey: ['cf-simulator', 'link', link.leaseId ?? '', link.expiresAt ?? '', link.signature ?? ''],
    queryFn: () => CfSimulatorApi.checkLink(link),
    enabled,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** The "send" of the module: the practice is taken in. */
export function useCfSimulatorCreatePractice() {
  return useMutation({
    mutationFn: (link: CfSimulatorLinkParams) => CfSimulatorApi.createPractice(link),
  });
}

/** The state of the practice, from the test panel. */
export function useCfSimulatorSetStatus(practiceId: string) {
  return useMutation({
    mutationFn: (body: CfSimulatorSetStatusBody) => CfSimulatorApi.setStatus(practiceId, body),
  });
}

/** Downloads a sample document of the practice and saves it. */
export function useCfSimulatorDocument(practiceId: string, controlToken: string) {
  return useMutation({
    mutationFn: async (kind: CfSimulatorDocumentKind) => {
      const blob = await CfSimulatorApi.downloadDocument(practiceId, kind, controlToken);
      saveBlobAs(blob, `${DOCUMENT_FILE_NAMES[kind]}-${practiceId}.pdf`);
    },
  });
}
