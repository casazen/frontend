import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Color helpers for the contrast tests of the UI primitives: the colors the components paint come from CSS tokens and
 * from the fallbacks written in their class names (`text-[color:var(--color-danger-foreground,#b4232a)]`), so the tests
 * read them from the same places instead of repeating them.
 */

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

const toLinear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const toGamma = (linear: number) => {
  const c = Math.min(1, Math.max(0, linear));
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
};

type Oklab = [number, number, number];

function hexToOklab(hex: string): Oklab {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => toLinear(Number.parseInt(n.slice(i, i + 2), 16)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function oklabToHex([L, a, b]: Oklab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return `#${[r, g, bl].map((c) => hex2(toGamma(c))).join('')}`;
}

/** `oklch(L% C H)` (what `globals.css` uses) as a hex color. */
export function oklchToHex(lightnessPercent: number, chroma: number, hue: number): string {
  const L = lightnessPercent / 100;
  const radians = (hue * Math.PI) / 180;
  return oklabToHex([L, chroma * Math.cos(radians), chroma * Math.sin(radians)]);
}

/** `color-mix(in oklab, <a> <percentOfA>%, <b>)`, the mix the soft button uses. */
export function mixOklab(a: string, percentOfA: number, b: string): string {
  const [la, aa, ba] = hexToOklab(a);
  const [lb, ab, bb] = hexToOklab(b);
  const p = percentOfA / 100;
  return oklabToHex([la * p + lb * (1 - p), aa * p + ab * (1 - p), ba * p + bb * (1 - p)]);
}

/** The hex color of a `--color-<token>` declared in the `@theme` of `globals.css` as `oklch(...)` (the colors of today). */
export function themeColor(token: string): string {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');
  const match = new RegExp(`--color-${token}:\\s*oklch\\(\\s*([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\s*\\)`).exec(css);
  if (!match) throw new Error(`--color-${token} is not an oklch() color in globals.css`);
  return oklchToHex(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** The fallback hex of `var(--color-<token>, #rrggbb)` in a class list: what the component paints until the token exists. */
export function fallbackColor(classes: string, token: string): string {
  const match = new RegExp(`var\\(--color-${token},\\s*(#[0-9a-fA-F]{6})\\)`).exec(classes);
  if (!match) throw new Error(`No fallback for --color-${token} in: ${classes}`);
  return match[1].toLowerCase();
}
