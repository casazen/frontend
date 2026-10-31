import type { Appearance } from '@stripe/stripe-js';

/**
 * How the Payment Element looks on the site of a supplier: the color of its buttons. The element lives in an iframe of Stripe and cannot
 * read our CSS variables, so the values are passed here; the fonts of the site are not reachable from the iframe either.
 */
export function stripeAppearanceFor(buttonColor: string): Appearance {
  return {
    theme: 'stripe',
    variables: {
      colorPrimary: buttonColor,
      colorBackground: '#ffffff',
      colorText: '#1b1f24',
      colorDanger: '#b4232a',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      borderRadius: '10px',
      spacingUnit: '4px',
    },
  };
}
