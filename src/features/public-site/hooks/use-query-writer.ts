import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

interface WrittenQuery {
  /** Last query written, rendered or not. */
  latest: URLSearchParams;
  /** Queries written and not rendered yet, oldest first. */
  pending: string[];
}

/**
 * Writes the query of the address, one edit after the other without losing any. The router renders a navigation in a transition:
 * quick successive edits (the arrival, the departure, the guests) must build on the last query written, not on the last one
 * rendered, or an edit is lost. `write` gets the query to start from and returns the one to write; by default the address is
 * replaced, so the Back button does not step through every edit (`replace: false` adds an entry for a decisive one).
 */
export function useQueryWriter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const written = useRef<WrittenQuery>({ latest: searchParams, pending: [] });

  useEffect(() => {
    const state = written.current;
    const index = state.pending.indexOf(searchParams.toString());
    if (index >= 0) {
      // One of our writes is now rendered; the later ones are still on their way.
      state.pending = state.pending.slice(index + 1);
      if (state.pending.length > 0) return;
    } else {
      // Navigation from elsewhere (link, back button): it becomes the base of the next edit.
      state.pending = [];
    }
    state.latest = searchParams;
  }, [searchParams]);

  const write = useCallback(
    (change: (current: URLSearchParams) => URLSearchParams, options: { replace?: boolean } = {}) => {
      const state = written.current;
      const updated = change(state.latest);
      const query = updated.toString();
      state.latest = updated;
      if (state.pending[state.pending.length - 1] !== query) state.pending.push(query);
      setSearchParams(updated, { replace: options.replace ?? true });
    },
    [setSearchParams],
  );

  return { searchParams, write };
}
