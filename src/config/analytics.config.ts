import { hasConsent } from '@/lib/cookie-consent';

export function resolvePlausibleDomain(value: unknown): string | null {
  const domain = typeof value === 'string' ? value.trim() : '';
  return domain.length > 0 ? domain : null;
}

const configuredPlausibleDomain = resolvePlausibleDomain(import.meta.env.VITE_PLAUSIBLE_DOMAIN);

export const analyticsConfig = {
  get plausibleDomain(): string | null {
    return hasConsent('statistics') ? configuredPlausibleDomain : null;
  },
};
