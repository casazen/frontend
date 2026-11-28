import { isValidDetailId, searchWithDetail } from '@/lib/detail-address';

export const GUEST_REGISTER_LAYER_KIND = 'guest-register';

const PROPERTY_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function parseGuestRegisterLayerId(id: string): string | null {
  return PROPERTY_ID.test(id) && isValidDetailId(id) ? id : null;
}

export function guestRegisterLayerPath(propertyId: string): string {
  const id = parseGuestRegisterLayerId(propertyId);
  return id ? `/app/short-rent/properties/${id}${searchWithDetail('', { kind: GUEST_REGISTER_LAYER_KIND, id })}` : '/app/short-rent/properties';
}
