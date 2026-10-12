import { UTM_PARAMS } from '@/lib/signup-attribution';

/** Entry address of a supplier: the registration page, in any comune of the official list (no token, no personal data). */
export const SUPPLIER_ENTRY_PATH = '/register';

/** Entry address of a host: the signup, with the "role" that opens the host choice and the UTM of the printed code. */
export const HOST_ENTRY_PATH = '/signup';

/** Campaign name allowed in an address: letters, digits and dashes, 1 to 60 characters (the signup attribution rules). */
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

/**
 * Address printed in the QR of a host invite. The visit is measured like any signup (SE-03): `utm_source=qr`, the medium of the
 * print and the campaign the admin names (a flyer, an event), so the conversion of each printed code is in the attribution report.
 */
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
