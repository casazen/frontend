import { useMutation, useQuery } from '@tanstack/react-query';
import { CfSimulatorApi } from '@/api/cf-simulator.api';
import { saveBlobAs } from '@/lib/file-download';
import type {
  CfSimulatorDocumentKind,
  CfSimulatorLinkParams,
  CfSimulatorSetStatusBody,
} from '@/types/cf-simulator.types';

const DOCUMENT_FILE_NAMES: Record<CfSimulatorDocumentKind, string> = {
  contract: 'contratto-esempio',
  attestation: 'attestazione-esempio',
  receipt: 'ricevuta-registrazione-esempio',
};

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

export function useCfSimulatorCreatePractice() {
  return useMutation({
    mutationFn: (link: CfSimulatorLinkParams) => CfSimulatorApi.createPractice(link),
  });
}

export function useCfSimulatorSetStatus(practiceId: string) {
  return useMutation({
    mutationFn: (body: CfSimulatorSetStatusBody) => CfSimulatorApi.setStatus(practiceId, body),
  });
}

export function useCfSimulatorDocument(practiceId: string, controlToken: string) {
  return useMutation({
    mutationFn: async (kind: CfSimulatorDocumentKind) => {
      const blob = await CfSimulatorApi.downloadDocument(practiceId, kind, controlToken);
      saveBlobAs(blob, `${DOCUMENT_FILE_NAMES[kind]}-${practiceId}.pdf`);
    },
  });
}
