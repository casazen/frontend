import { useEffect, useState } from 'react';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Search box that updates its filter 300 ms after the last keystroke, not on every one (A1-26), and goes back to the
 * first page of the list when it does.
 */
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
