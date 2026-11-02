import { useEffect, useState, type ComponentType } from 'react';

export interface LazyCanvas<P> {
  /** The component once its chunk has loaded; `failed` if loading failed; `null` while it loads. */
  canvas: { Component: ComponentType<P> } | 'failed' | null;
  /** Tries again after a failure. */
  retry: () => void;
}

/**
 * Loads on demand the chunk with the code of a map (the engine and the drawing code are not in the page's own chunk, and
 * pages without a map never load them). `React.lazy` cannot try again after a failure, which is the one thing a map in a
 * bad network needs, so the chunk is loaded here and kept in state. `load` has to be a stable function (a module-level one).
 */
export function useLazyCanvas<P>(load: () => Promise<{ default: ComponentType<P> }>): LazyCanvas<P> {
  const [canvas, setCanvas] = useState<LazyCanvas<P>['canvas']>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    load()
      .then((m) => {
        if (alive) setCanvas({ Component: m.default });
      })
      .catch(() => {
        if (alive) setCanvas('failed');
      });
    return () => {
      alive = false;
    };
  }, [load, attempt]);
  return {
    canvas,
    retry: () => {
      setCanvas(null);
      setAttempt((n) => n + 1);
    },
  };
}
