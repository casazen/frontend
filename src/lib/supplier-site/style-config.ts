import type { CSSProperties } from 'react';
import { contrastRatio, AA_TEXT_CONTRAST } from '@/lib/public-site-colors';
import { normalizeHexColor } from '@/lib/public-site-themes';

/**
 * The four styles of a supplier's showcase and its three typefaces (SP-09-FE, decision VT-D8). The palettes, the radii and the
 * typefaces live in `styles/supplier-site.css` under `.vz[data-vz-style|data-vz-font]`; this module only knows what the code
 * has to decide: which style fits a trade, how the cover is laid out and which color a supplier may put on its buttons.
 */
export const SITE_STYLE_IDS = ['acqua', 'scintilla', 'fresco', 'naturale'] as const;
export type SiteStyleId = (typeof SITE_STYLE_IDS)[number];

export const SITE_FONT_IDS = ['moderno', 'editoriale', 'classico'] as const;
export type SiteFontId = (typeof SITE_FONT_IDS)[number];

/** `full`: the scene across the whole width under a dark veil. `split`: the text on the left and the picture on the right. */
export type HeroLayout = 'full' | 'split';

interface SiteStyleDefinition {
  hero: HeroLayout;
  /** The typeface the style starts with. */
  font: SiteFontId;
  /** The color of its buttons (the same as `--vz-cta` in the CSS): white text on it is at least 4.5:1. */
  cta: string;
  /** The service categories (codes of the backend catalog) the style is recommended for. */
  categories: readonly string[];
}

export const SITE_STYLES: Record<SiteStyleId, SiteStyleDefinition> = {
  acqua: { hero: 'full', font: 'moderno', cta: '#0b5fa5', categories: ['plumbing', 'maintenance'] },
  scintilla: { hero: 'full', font: 'moderno', cta: '#1f2933', categories: ['electrical', 'check-in'] },
  fresco: { hero: 'split', font: 'editoriale', cta: '#0f766e', categories: ['cleaning', 'laundry', 'linen'] },
  naturale: { hero: 'split', font: 'classico', cta: '#2f6b3a', categories: ['gardening'] },
};

/** Where nothing says otherwise (a trade with no style of its own: events, rental, excursions). */
const DEFAULT_STYLE: SiteStyleId = 'fresco';

const isStyleId = (value: unknown): value is SiteStyleId =>
  typeof value === 'string' && (SITE_STYLE_IDS as readonly string[]).includes(value);

const isFontId = (value: unknown): value is SiteFontId =>
  typeof value === 'string' && (SITE_FONT_IDS as readonly string[]).includes(value);

/** The style recommended for the first of the supplier's categories that has one. */
export function styleForCategories(categories: readonly string[]): SiteStyleId {
  for (const category of categories) {
    const found = SITE_STYLE_IDS.find((id) => SITE_STYLES[id].categories.includes(category));
    if (found) return found;
  }
  return DEFAULT_STYLE;
}

/** The style the supplier chose, or the one recommended for its trade when it chose none (or sent a name nobody knows). */
export function resolveSiteStyle(chosen: string | null | undefined, categories: readonly string[]): SiteStyleId {
  return isStyleId(chosen) ? chosen : styleForCategories(categories);
}

/** The typeface the supplier chose, or the one of the style. */
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

/**
 * The variables of a custom button color, set inline on the root of the site (and on its dialogs, which live outside the
 * root). The deeper shades are derived the way the prototype does, so the ones used as text on the light surfaces keep AA.
 */
export function siteColorVars(color: string): Record<string, string> {
  return {
    '--vz-cta': color,
    '--vz-cta-hover': `color-mix(in srgb, ${color} 82%, #000)`,
    '--vz-cta-ink': `color-mix(in srgb, ${color} 78%, #000)`,
    '--vz-cta-soft': `color-mix(in srgb, ${color} 13%, #fff)`,
  };
}

/** What the root of the site, and each sheet it opens, wears: the style, the typeface and, if there is one, the color of the buttons. */
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
