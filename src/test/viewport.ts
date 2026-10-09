import { vi } from 'vitest';

const CONDITION = /\(width\s*(<=|>=|<|>)\s*([\d.]+)rem\)/g;

/** True when a window `widthPx` wide matches a media query made of `(width <op> N rem)` conditions (the ones of the app). */
function matchesWidth(query: string, widthPx: number): boolean {
  const width = widthPx / 16;
  const conditions = [...query.matchAll(CONDITION)];
  if (conditions.length === 0) return false;
  return conditions.every(([, operator, value]) => {
    const limit = Number(value);
    if (operator === '<') return width < limit;
    if (operator === '<=') return width <= limit;
    if (operator === '>') return width > limit;
    return width >= limit;
  });
}

/**
 * Gives the test a window of `widthPx` (jsdom has no `matchMedia`): the width queries of the app (`PHONE_QUERY` and the
 * others, in `rem` as Tailwind writes them) answer for it. `resize` changes the width and tells whoever listens, as a
 * browser does. Undo with `vi.unstubAllGlobals()` in `afterEach`.
 */
export function stubViewportWidth(widthPx: number) {
  let width = widthPx;
  const listeners = new Set<{ query: string; listener: () => void }>();

  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return matchesWidth(query, width);
    },
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add({ query, listener }),
    removeEventListener: (_type: string, listener: () => void) => {
      for (const entry of listeners) if (entry.listener === listener) listeners.delete(entry);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));

  return {
    resize(next: number) {
      width = next;
      for (const { listener } of [...listeners]) listener();
    },
  };
}
