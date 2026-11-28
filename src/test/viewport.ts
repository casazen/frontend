import { vi } from 'vitest';

const CONDITION = /\(width\s*(<=|>=|<|>)\s*([\d.]+)rem\)/g;

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
