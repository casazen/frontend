import { UTM_PARAMS } from '@/lib/signup-attribution';

export const SUPPLIER_ENTRY_PATH = '/register';

export const HOST_ENTRY_PATH = '/signup';

export function sanitizeCampaign(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function supplierInviteUrl(origin: string): string {
  return `${origin}${SUPPLIER_ENTRY_PATH}`;
}

export function hostInviteUrl(origin: string, campaign: string): string {
  const params = new URLSearchParams({ role: 'host' });
  const values: Record<(typeof UTM_PARAMS)[number], string | undefined> = {
    utm_source: 'qr',
    utm_medium: 'print',
    utm_campaign: sanitizeCampaign(campaign) || undefined,
    utm_term: undefined,
    utm_content: undefined,
  };
  for (const name of UTM_PARAMS) {
    const value = values[name];
    if (value) params.set(name, value);
  }
  return `${origin}${HOST_ENTRY_PATH}?${params.toString()}`;
}
