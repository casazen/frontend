/**
 * Numeric helpers of the schematic map engine (DB-19a): pseudo-random generators, value noise and the small string helpers the SVG
 * writers need. Pure functions: no DOM, no module state, so the same input always gives the same drawing.
 */

export const PI = Math.PI;
export const DEG = PI / 180;

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** FNV-1a: a stable 32-bit hash of a string. */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rand = () => number;

function mulberry32(seed: number): Rand {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic generator seeded by one or more parts (strings or numbers). */
export const rngOf = (...parts: (string | number)[]): Rand => mulberry32(hashStr(parts.join('|')));

export function hash2(ix: number, iy: number, s: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s | 0, 1013904223)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in 0..1. */
export function vnoise(x: number, y: number, s = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash2(ix, iy, s), hash2(ix + 1, iy, s), u), lerp(hash2(ix, iy + 1, s), hash2(ix + 1, iy + 1, s), u), v);
}

/** Compact number (fixed decimals, never «-0»). */
export const num = (v: number, d = 1): string => {
  const k = 10 ** d;
  const r = Math.round(v * k) / k;
  return String(Object.is(r, -0) ? 0 : r);
};

/** Escapes text for an SVG text node or attribute. */
export const esc = (s: unknown): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
