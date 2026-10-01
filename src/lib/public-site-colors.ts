import type { CSSProperties } from 'react';
import {
  PUBLIC_SITE_THEME_PALETTES,
  normalizeHexColor,
  type PublicSiteThemeId,
} from '@/lib/public-site-themes';

/**
 * WCAG 2.1 contrast of the public booking site colors (BK-13, A3-32). The host picks the primary color freely
 * (BK-12): this module derives the colors that have to stay readable on top of, or next to, it, so that any choice
 * meets AA instead of only the theme's own colors.
 */

/** WCAG 2.1 AA, normal text (1.4.3). */
export const AA_TEXT_CONTRAST = 4.5;

/** Candidates for the text on a primary fill, in order of preference: white, near-black, pure black. */
const ON_PRIMARY_CANDIDATES = ['#ffffff', '#111827', '#000000'] as const;

type Rgb = readonly [number, number, number];

function toRgb(hex: string): Rgb {
  const normalized = normalizeHexColor(hex);
  if (!normalized) throw new Error(`Not a hex color: ${hex}`);
  return [1, 3, 5].map((i) => Number.parseInt(normalized.slice(i, i + 2), 16)) as unknown as Rgb;
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a hex color (WCAG 2.1 definition), 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Contrast ratio of two hex colors, from 1 to 21 (WCAG 2.1). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The text color for a fill: white when it reaches AA, otherwise near-black, otherwise pure black. Between white and
 * pure black one of them is always at least 4.58:1, so the result always meets AA.
 */
export function readableTextOn(fillHex: string): { color: string; ratio: number } {
  for (const color of ON_PRIMARY_CANDIDATES) {
    const ratio = contrastRatio(color, fillHex);
    if (ratio >= AA_TEXT_CONTRAST) return { color, ratio };
  }
  const color = ON_PRIMARY_CANDIDATES[2];
  return { color, ratio: contrastRatio(color, fillHex) };
}

/** `colorHex` mixed with black by `amount` (0 = unchanged, 1 = black): the same hue, darker. */
function darken(colorHex: string, amount: number): string {
  const [r, g, b] = toRgb(colorHex);
  return toHex([r * (1 - amount), g * (1 - amount), b * (1 - amount)]);
}

/**
 * The color to use as text, link hover or focus ring on the given light surfaces: `colorHex` itself when it reaches
 * the minimum contrast on all of them, otherwise the same hue darkened in 2% steps until it does.
 */
export function readableOnSurfaces(colorHex: string, surfaces: readonly string[], minRatio = AA_TEXT_CONTRAST): string {
  const meets = (candidate: string) => surfaces.every((surface) => contrastRatio(candidate, surface) >= minRatio);
  if (meets(colorHex)) return normalizeHexColor(colorHex) ?? colorHex;
  for (let step = 1; step <= 50; step += 1) {
    const candidate = darken(colorHex, step * 0.02);
    if (meets(candidate)) return candidate;
  }
  return '#000000';
}

export interface PrimaryColorAnalysis {
  /** The host's color, `#rrggbb`. */
  primary: string;
  /** Text color on a primary fill (buttons, hero without photo). */
  onPrimary: string;
  /** Contrast of `onPrimary` on `primary`: always at least 4.5. */
  onPrimaryRatio: number;
  /** The primary as text/link hover/focus ring on the page: `primary` itself when it is readable there. */
  primaryText: string;
  /** True when `primaryText` is not the host's color (it is too light to be read as text on the page). */
  primaryTextAdjusted: boolean;
}

/** What the public site does with a primary color on a theme, so that every pair meets AA (shell, preview, settings page). */
export function analyzePrimaryColor(primaryHex: string, themeId: PublicSiteThemeId): PrimaryColorAnalysis | null {
  const primary = normalizeHexColor(primaryHex);
  if (!primary) return null;
  const palette = PUBLIC_SITE_THEME_PALETTES[themeId];
  const { color: onPrimary, ratio: onPrimaryRatio } = readableTextOn(primary);
  const primaryText = readableOnSurfaces(primary, [palette.bg, palette.surface]);
  return { primary, onPrimary, onPrimaryRatio, primaryText, primaryTextAdjusted: primaryText !== primary };
}

/** CSS custom properties of a host primary color (set inline on the themed root): the color and the two derived ones. */
export function publicSiteColorVars(
  primaryHex: string | null | undefined,
  themeId: PublicSiteThemeId,
): Record<string, string> | null {
  const analysis = primaryHex ? analyzePrimaryColor(primaryHex, themeId) : null;
  if (!analysis) return null;
  return {
    '--cz-public-primary': analysis.primary,
    '--cz-public-on-primary': analysis.onPrimary,
    '--cz-public-primary-text': analysis.primaryText,
  };
}

/** `publicSiteColorVars` as a `style` prop; undefined when the org uses the theme's own colors. */
export function publicSiteColorStyle(
  primaryHex: string | null | undefined,
  themeId: PublicSiteThemeId,
): CSSProperties | undefined {
  const vars = publicSiteColorVars(primaryHex, themeId);
  return vars ? (vars as CSSProperties) : undefined;
}
