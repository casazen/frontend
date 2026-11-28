import type { Appearance, StripeElementLocale } from '@stripe/stripe-js';
import { PUBLIC_SITE_THEME_PALETTES, type PublicSiteThemeId } from '@/lib/public-site-themes';

/**
 * How the Stripe Payment Element of the checkout looks on the booking site (DB-01; the checkout connects it in DB-05): the
 * theme's colors, the radius of its fields and the host's own primary color when it has one, so that the card form does not
 * look like a different site inside the page. The element lives in an iframe of Stripe: it cannot read our CSS variables, so the
 * values are passed here, from the same palette the CSS mirrors (`public-site-themes.ts`).
 */

const FIELD_RADIUS: Record<PublicSiteThemeId, string> = {
  terra: '10px',
  mare: '14px',
  citta: '3px',
};

const DANGER = '#b4232a';

const FONT_FAMILY = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function stripeAppearance(
  themeId: PublicSiteThemeId,
  colorVars?: Readonly<Record<string, string>> | null,
): Appearance {
  const palette = PUBLIC_SITE_THEME_PALETTES[themeId];
  const primary = colorVars?.['--cz-public-primary'] ?? palette.primary;

  return {
    theme: 'stripe',
    variables: {
      colorPrimary: primary,
      colorBackground: palette.surface,
      colorText: palette.text,
      colorTextSecondary: palette.muted,
      colorDanger: DANGER,
      fontFamily: FONT_FAMILY,
      borderRadius: FIELD_RADIUS[themeId],
      spacingUnit: '4px',
    },
    rules: {
      '.Input': { border: `1px solid ${palette.lineStrong}`, boxShadow: 'none' },
      '.Input:focus': { border: `1px solid ${primary}`, boxShadow: `0 0 0 1px ${primary}` },
      '.Label': { color: palette.text, fontWeight: '600' },
    },
  };
}

/** The language of the Payment Element for the language of the page: English for any `en`, Italian otherwise (the product's default). */
export function stripeLocale(language: string | null | undefined): StripeElementLocale {
  return language?.trim().toLowerCase().startsWith('en') ? 'en' : 'it';
}
