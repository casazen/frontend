import type { Appearance } from '@stripe/stripe-js';

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
