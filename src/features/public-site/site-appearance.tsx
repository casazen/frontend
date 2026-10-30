import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import {
  DEFAULT_PUBLIC_SITE_THEME,
  type PublicSiteFontId,
  type PublicSiteThemeId,
} from '@/lib/public-site-themes';

/**
 * How the booking site of a host looks (DB-20): its theme, the font pair it chose and the inline variables of its own color. The
 * shell of the site knows it and offers it here, so that what is drawn in a portal (a popover, a sheet, a dialog), outside the
 * themed root of the page, can wear the same tokens.
 */
export interface SiteAppearance {
  themeId: PublicSiteThemeId;
  /** The font pair the host chose; null = the one its theme starts with. */
  fontId: PublicSiteFontId | null;
  /** The variables of the host's own primary color (`publicSiteColorVars`), undefined for the theme's own. */
  colorStyle?: CSSProperties;
}

const DEFAULT_APPEARANCE: SiteAppearance = { themeId: DEFAULT_PUBLIC_SITE_THEME, fontId: null };

const SiteAppearanceContext = createContext<SiteAppearance>(DEFAULT_APPEARANCE);

export function SiteAppearanceProvider({ value, children }: { value: SiteAppearance; children: ReactNode }) {
  return <SiteAppearanceContext.Provider value={value}>{children}</SiteAppearanceContext.Provider>;
}

/** The appearance of the site this component is in; the default theme outside a site (a test, a page for developers). */
export function useSiteAppearance(): SiteAppearance {
  return useContext(SiteAppearanceContext);
}

/**
 * The attributes of the root of a portal: the class that maps the tokens of the site on the components of the app, and the
 * theme, the font pair and the color of the host. `data-theme` on the same element as the class, as `PublicSiteShell` does.
 */
export function usePortalRootProps(): {
  className: string;
  'data-theme': PublicSiteThemeId;
  'data-font'?: PublicSiteFontId;
  style?: CSSProperties;
} {
  const { themeId, fontId, colorStyle } = useSiteAppearance();
  return useMemo(
    () => ({
      className: 'public-site-root',
      'data-theme': themeId,
      'data-font': fontId ?? undefined,
      style: colorStyle,
    }),
    [themeId, fontId, colorStyle],
  );
}
