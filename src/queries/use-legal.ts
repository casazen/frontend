import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LegalApi } from '@/api/legal.api';
import type { LegalDocumentKey } from '@/types/onboarding.types';

export const LEGAL_QUERY_KEY = ['legal'] as const;

export function useLegalLanguage(): string {
  const { i18n } = useTranslation();
  return (i18n.resolvedLanguage ?? i18n.language ?? 'it').slice(0, 2).toLowerCase();
}

function fetchLegalDocument(key: LegalDocumentKey, lang: string) {
  switch (key) {
    case 'tos':
      return LegalApi.getTos(lang);
    case 'privacy':
      return LegalApi.getPrivacy(lang);
    case 'dpa':
      return LegalApi.getDpa(lang);
  }
}

function legalDocumentQuery(key: LegalDocumentKey, lang: string) {
  return { queryKey: ['legal', key, lang] as const, queryFn: () => fetchLegalDocument(key, lang) };
}

export function useLegalDocument(key: LegalDocumentKey) {
  const lang = useLegalLanguage();
  return useQuery(legalDocumentQuery(key, lang));
}

export function useSubprocessors() {
  return useQuery({ queryKey: ['legal', 'subprocessors'], queryFn: () => LegalApi.getSubprocessors() });
}

export function useLegalDocuments() {
  const lang = useLegalLanguage();
  const tos = useQuery(legalDocumentQuery('tos', lang));
  const privacy = useQuery(legalDocumentQuery('privacy', lang));
  const dpa = useQuery(legalDocumentQuery('dpa', lang));
  const subprocessors = useSubprocessors();
  const queries = [tos, privacy, dpa, subprocessors];

  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  const isRetrying = queries.some((query) => query.isError && query.isFetching);
  const retry = () => {
    queries.forEach((query) => {
      if (query.isError) void query.refetch();
    });
  };

  return {
    tos: tos.data,
    privacy: privacy.data,
    dpa: dpa.data,
    subprocessors: subprocessors.data,
    isLoading,
    isError,
    isRetrying,
    retry,
  };
}

export function useReloadLegalDocuments() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.resetQueries({ queryKey: LEGAL_QUERY_KEY }), [queryClient]);
}
