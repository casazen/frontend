import type { CSSProperties } from 'react';
import { contrastRatio, mixHex, AA_TEXT_CONTRAST } from '@/lib/public-site-colors';
import { normalizeHexColor } from '@/lib/public-site-themes';

export const SITE_STYLE_IDS = ['acqua', 'scintilla', 'fresco', 'naturale'] as const;
export type SiteStyleId = (typeof SITE_STYLE_IDS)[number];

export const SITE_FONT_IDS = ['moderno', 'editoriale', 'classico'] as const;
export type SiteFontId = (typeof SITE_FONT_IDS)[number];

export type HeroLayout = 'full' | 'split';

interface SiteStyleDefinition {
  hero: HeroLayout;
  font: SiteFontId;
  cta: string;
  bg: string;
  categories: readonly string[];
}

export const SITE_STYLES: Record<SiteStyleId, SiteStyleDefinition> = {
  acqua: { hero: 'full', font: 'moderno', cta: '#0b5fa5', bg: '#f4f7fa', categories: ['plumbing', 'maintenance'] },
  scintilla: { hero: 'full', font: 'moderno', cta: '#1f2933', bg: '#f6f5f1', categories: ['electrical', 'check-in'] },
  fresco: { hero: 'split', font: 'editoriale', cta: '#0f766e', bg: '#f2f9f6', categories: ['cleaning', 'laundry', 'linen'] },
  naturale: { hero: 'split', font: 'classico', cta: '#2f6b3a', bg: '#f5f2ea', categories: ['gardening'] },
};

export const SITE_FONT_FAMILIES: Record<SiteFontId, string> = {
  moderno: "'Inter Variable', Inter, 'Segoe UI', system-ui, sans-serif",
  editoriale: "'Fraunces Variable', Fraunces, 'Iowan Old Style', Georgia, serif",
  classico: "'Playfair Display Variable', 'Playfair Display', Didot, 'Bodoni MT', Georgia, serif",
};

/** Where nothing says otherwise (a trade with no style of its own: events, rental, excursions). */
const DEFAULT_STYLE: SiteStyleId = 'fresco';

const isStyleId = (value: unknown): value is SiteStyleId =>
  typeof value === 'string' && (SITE_STYLE_IDS as readonly string[]).includes(value);

const isFontId = (value: unknown): value is SiteFontId =>
  typeof value === 'string' && (SITE_FONT_IDS as readonly string[]).includes(value);

export function recommendedStyleFor(categories: readonly string[]): SiteStyleId | null {
  for (const category of categories) {
    const found = SITE_STYLE_IDS.find((id) => SITE_STYLES[id].categories.includes(category));
    if (found) return found;
  }
  return null;
}

export function styleForCategories(categories: readonly string[]): SiteStyleId {
  return recommendedStyleFor(categories) ?? DEFAULT_STYLE;
}

export function resolveSiteStyle(chosen: string | null | undefined, categories: readonly string[]): SiteStyleId {
  return isStyleId(chosen) ? chosen : styleForCategories(categories);
}

export function resolveSiteFont(chosen: string | null | undefined, style: SiteStyleId): SiteFontId {
  return isFontId(chosen) ? chosen : SITE_STYLES[style].font;
}

/**
 * The color the supplier chose for its buttons: `#rrggbb` when white text reads on it at 4.5:1 (WCAG AA), otherwise null and
 * the style's own color stays. The server refuses such a color too (SP-13a); this is the same calculation, so a value that
 * reaches the page by another way can never put unreadable buttons on it.
 */
export function siteButtonColor(chosen: string | null | undefined): string | null {
  const color = normalizeHexColor(chosen);
  if (!color) return null;
  return contrastRatio(color, '#ffffff') >= AA_TEXT_CONTRAST ? color : null;
}

export function suggestReadableColor(chosen: string, fallback = SITE_STYLES.fresco.cta): string {
  const color = normalizeHexColor(chosen);
  if (!color) return fallback;
  if (contrastRatio(color, '#ffffff') >= AA_TEXT_CONTRAST) return color;
  for (let step = 1; step <= 45; step += 1) {
    const candidate = mixHex(color, '#000000', step * 0.02);
    if (contrastRatio(candidate, '#ffffff') >= AA_TEXT_CONTRAST) return candidate;
  }
  return fallback;
}

export function siteColorVars(color: string): Record<string, string> {
  return {
    '--vz-cta': color,
    '--vz-cta-hover': `color-mix(in srgb, ${color} 82%, #000)`,
    '--vz-cta-ink': `color-mix(in srgb, ${color} 78%, #000)`,
    '--vz-cta-soft': `color-mix(in srgb, ${color} 13%, #fff)`,
  };
}

export interface SiteThemeProps {
  'data-vz-style': SiteStyleId;
  'data-vz-font': SiteFontId;
  style?: CSSProperties;
}

export function siteThemeProps(style: SiteStyleId, font: SiteFontId, buttonColor: string | null): SiteThemeProps {
  return {
    'data-vz-style': style,
    'data-vz-font': font,
    ...(buttonColor ? { style: siteColorVars(buttonColor) as CSSProperties } : {}),
  };
}
