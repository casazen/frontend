import { createContext, useContext, useMemo, type CSSProperties } from 'react';
import {
  DEFAULT_PUBLIC_SITE_THEME,
  type PublicSiteFontId,
  type PublicSiteThemeId,
} from '@/lib/public-site-themes';

/**
 * How the booking site of a host looks (DB-20): its theme, the font pair it chose and the inline variables of its own color. The
 * shell of the site knows it and offers it here (`SiteAppearanceProvider`), so that what is drawn in a portal (a popover, a
 * sheet, a dialog), outside the themed root of the page, can wear the same tokens.
 */
export interface SiteAppearance {
  themeId: PublicSiteThemeId;
  fontId: PublicSiteFontId | null;
  colorStyle?: CSSProperties;
  brand?: 'casazen';
}

const DEFAULT_APPEARANCE: SiteAppearance = { themeId: DEFAULT_PUBLIC_SITE_THEME, fontId: null };

export const SiteAppearanceContext = createContext<SiteAppearance>(DEFAULT_APPEARANCE);

export function useSiteAppearance(): SiteAppearance {
  return useContext(SiteAppearanceContext);
}

export function usePortalRootProps(): {
  className: string;
  'data-theme': PublicSiteThemeId;
  'data-font'?: PublicSiteFontId;
  'data-brand'?: 'casazen';
  style?: CSSProperties;
} {
  const { themeId, fontId, colorStyle, brand } = useSiteAppearance();
  return useMemo(
    () => ({
      className: 'public-site-root',
      'data-theme': themeId,
      'data-font': fontId ?? undefined,
      'data-brand': brand,
      style: colorStyle,
    }),
    [themeId, fontId, colorStyle, brand],
  );
}
