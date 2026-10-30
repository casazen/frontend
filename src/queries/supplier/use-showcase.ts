import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supplierShowcaseApi } from '@/api/supplier-showcase.api';
import type { ShowcaseContent } from '@/types/supplier-showcase';

const CONTENT_KEY = ['supplier', 'showcase', 'content'] as const;
const STATS_KEY = ['supplier', 'showcase', 'stats'] as const;

/** The content of the showcase: the draft, what is published, the state, the readiness. Read again at every visit. */
export function useShowcaseContent() {
  return useQuery({ queryKey: CONTENT_KEY, queryFn: supplierShowcaseApi.getContent, staleTime: 0 });
}

/** Puts a document the server just sent (after a save) in the cache, so every part of the page reads the same one. */
export function useStoreShowcaseContent() {
  const client = useQueryClient();
  return useCallback((content: ShowcaseContent) => client.setQueryData(CONTENT_KEY, content), [client]);
}

/** The two true numbers: the requests that came from the showcase in the last 30 days and how many still wait. */
export function useShowcaseStats() {
  return useQuery({ queryKey: STATS_KEY, queryFn: supplierShowcaseApi.getStats, staleTime: 60_000 });
}

/**
 * A command on the showcase (publish, undo, pause...): every one answers with the whole document, which becomes the content on
 * screen at once. What else reads the publication (the numbers, the checklist of the home) is read again.
 */
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

/** Publishes the draft; the version read goes with it, so a command never acts on a draft that was not seen. */
export const usePublishShowcase = () => useShowcaseCommand((version?: number) => supplierShowcaseApi.publish(version));

/** "Annulla" of a publication, until the time the server gave. */
export const useUndoPublishShowcase = () => useShowcaseCommand(() => supplierShowcaseApi.undoPublish());

/** Throws the changes of the draft away: it goes back to what is published. */
export const useDiscardShowcaseChanges = () => useShowcaseCommand((version?: number) => supplierShowcaseApi.discard(version));

export const usePauseShowcase = () => useShowcaseCommand(() => supplierShowcaseApi.pause());

export const useResumeShowcase = () => useShowcaseCommand(() => supplierShowcaseApi.resume());
