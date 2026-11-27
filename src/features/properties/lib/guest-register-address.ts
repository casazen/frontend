import { isValidDetailId, searchWithDetail } from '@/lib/detail-address';

/**
 * The address of the layer of the guest register of a property in Switzerland (E31/F02/US02/T01, NF-130, casazen/backend#979). It is a kind of the global detail drawer (UI-15):
 * `?detail=guest-register:<property>` on any page of the shell, so a link or a bookmark opens the register of that property over the page that is open. No page of its own, and no
 * route of the manifest: the drawer is the deep link. This file is the pure part: from the property to the address and back.
 */
export const GUEST_REGISTER_LAYER_KIND = 'guest-register';

/** A property as the address holds it: the id of the API (a GUID). */
const PROPERTY_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The property of the id the drawer hands to the layer; `null` when the id is not one this layer makes (the layer then says it cannot find it). */
export function parseGuestRegisterLayerId(id: string): string | null {
  return PROPERTY_ID.test(id) && isValidDetailId(id) ? id : null;
}

/**
 * The address that opens the register of a property over the page of the property (`/app/short-rent/properties/<property>?detail=guest-register:<property>`): the link of the card of
 * the regime, for a page with no drawer (a new tab, an isolated render). Without a property an address can hold, the properties page alone.
 */
export function guestRegisterLayerPath(propertyId: string): string {
  const id = parseGuestRegisterLayerId(propertyId);
  return id ? `/app/short-rent/properties/${id}${searchWithDetail('', { kind: GUEST_REGISTER_LAYER_KIND, id })}` : '/app/short-rent/properties';
}
