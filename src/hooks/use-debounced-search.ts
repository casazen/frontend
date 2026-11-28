import { useEffect, useState } from 'react';

const SEARCH_DEBOUNCE_MS = 300;

export function useDebouncedSearch(setPage: (page: number) => void) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [input, setPage]);
  return { input, setInput, search };
}
