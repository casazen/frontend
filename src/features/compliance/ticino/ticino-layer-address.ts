import { isValidDetailId, searchWithDetail } from '@/lib/detail-address';
import { isStayDate } from '@/lib/stay-dates';

/**
 * The address of the layer of the Ticino police notification (E30/F02/US03, casazen/backend#979). It is a kind of the global detail drawer (UI-15), so the
 * address is `?detail=ticino:<property>` or `?detail=ticino:<property>:<yyyy-MM-dd>` on the page of the cockpit, and a link, a notification or a bookmark
 * opens the guided notification of that property over the cockpit, on that arrival day (without one, on the first day still to notify). This file is the
 * pure part: from the property and the day to the address and back.
 */
export const TICINO_LAYER_KIND = 'ticino';

/** The page the layer opens over: the cockpit of the adempimenti, where the days to notify are listed. */
export const COMPLIANCE_COCKPIT_PATH = '/app/short-rent/compliance';

/** A property as the address holds it: the id of the API (a GUID), with no colon, which separates the day. */
const PROPERTY_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** What the layer opens on: a property and, when the address says it, an arrival day. */
interface TicinoLayerAddress {
  propertyId: string;
  /** The arrival day (`yyyy-MM-dd`); absent when the address names none: the layer then opens on the first day still to notify. */
  day?: string;
}

/**
 * The id of the layer for a property and, when it is a real calendar day, an arrival day; `null` when the property is not one an address can hold.
 * A day that is not a day (a month, a mistyped date) is left out: the layer then opens on the first day to notify, never on a date nobody asked for.
 */
function ticinoLayerId(propertyId: string, day?: string | null): string | null {
  if (!PROPERTY_ID.test(propertyId)) return null;
  const id = day && isStayDate(day) ? `${propertyId}:${day}` : propertyId;
  return isValidDetailId(id) ? id : null;
}

/** The property and the day of the id the drawer hands to the layer; `null` when the id is not one this layer makes (the layer then says it cannot find it). */
export function parseTicinoLayerId(id: string): TicinoLayerAddress | null {
  const [propertyId, day, ...rest] = id.split(':');
  if (!PROPERTY_ID.test(propertyId) || rest.length > 0) return null;
  if (day === undefined) return { propertyId };
  // A day that is not a day is not an error of the person: the property still opens, on its first day to notify.
  return isStayDate(day) ? { propertyId, day } : { propertyId };
}

/**
 * The address that opens the layer of a property over the cockpit (`/app/short-rent/compliance?detail=ticino:<property>[:<day>]`): the one the cockpit rows, the bell, the property
 * page and the old address of the page (`/app/short-rent/compliance/ticino?property=&date=`) lead to. Without a property an address can hold, the cockpit alone.
 */
export function ticinoLayerPath(propertyId: string | null | undefined, day?: string | null): string {
  const id = propertyId ? ticinoLayerId(propertyId, day) : null;
  return id ? `${COMPLIANCE_COCKPIT_PATH}${searchWithDetail('', { kind: TICINO_LAYER_KIND, id })}` : COMPLIANCE_COCKPIT_PATH;
}
