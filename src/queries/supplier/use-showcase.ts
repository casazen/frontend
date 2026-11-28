import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supplierShowcaseApi } from '@/api/supplier-showcase.api';
import type { ShowcaseContent, ShowcaseTextSuggestionRequest } from '@/types/supplier-showcase';

const CONTENT_KEY = ['supplier', 'showcase', 'content'] as const;
const STATS_KEY = ['supplier', 'showcase', 'stats'] as const;

export function useShowcaseContent() {
  return useQuery({ queryKey: CONTENT_KEY, queryFn: supplierShowcaseApi.getContent, staleTime: 0 });
}

export function useStoreShowcaseContent() {
  const client = useQueryClient();
  return useCallback((content: ShowcaseContent) => client.setQueryData(CONTENT_KEY, content), [client]);
}

export function useShowcaseStats() {
  return useQuery({ queryKey: STATS_KEY, queryFn: supplierShowcaseApi.getStats, staleTime: 60_000 });
}

export function useShowcaseTextSuggestionStatus() {
  return useQuery({
    queryKey: ['supplier', 'showcase', 'text-suggestion-status'] as const,
    queryFn: supplierShowcaseApi.getTextSuggestionStatus,
    staleTime: 5 * 60_000,
  });
}

export function useSuggestShowcaseTexts() {
  return useMutation({ mutationFn: (request: ShowcaseTextSuggestionRequest) => supplierShowcaseApi.suggestTexts(request) });
}

function useShowcaseCommand<TVariables = void>(run: (variables: TVariables) => Promise<ShowcaseContent>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (content) => {
      client.setQueryData(CONTENT_KEY, content);
      void client.invalidateQueries({ queryKey: STATS_KEY });
      void client.invalidateQueries({ queryKey: ['supplier', 'checklist'] });
    },
  });
}

export const usePublishShowcase = () => useShowcaseCommand((version?: number) => supplierShowcaseApi.publish(version));

export const useUndoPublishShowcase = () => useShowcaseCommand(() => supplierShowcaseApi.undoPublish());

export const useDiscardShowcaseChanges = () => useShowcaseCommand((version?: number) => supplierShowcaseApi.discard(version));

export const usePauseShowcase = () => useShowcaseCommand(() => supplierShowcaseApi.pause());

export const useResumeShowcase = () => useShowcaseCommand(() => supplierShowcaseApi.resume());
