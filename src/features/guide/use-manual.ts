import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { manualHintsFor, searchManual } from '@/lib/manual/manual-search';

const MIN_CHARS = 2;
const TYPING_PAUSE_MS = 200;

export function useManualSearch(query: string) {
  const typed = query.trim();
  const settled = useDebouncedValue(typed, TYPING_PAUSE_MS);
  const search = useQuery({
    queryKey: ['manual', 'search', settled],
    queryFn: () => searchManual(settled),
    enabled: settled.length >= MIN_CHARS,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
  });

  return {
    active: typed.length >= MIN_CHARS,
    hits: search.data ?? [],
    pending: settled !== typed || search.isFetching,
    failed: settled === typed && search.isError,
    retry: () => void search.refetch(),
  };
}

export function useManualHints(pathname: string) {
  return useQuery({
    queryKey: ['manual', 'hints', pathname],
    queryFn: () => manualHintsFor(pathname),
    staleTime: Infinity,
    retry: false,
  });
}
