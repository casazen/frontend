import { isValidDetailId } from '@/lib/detail-address';
import { isStayDate } from '@/lib/stay-dates';

/** A property as the address of a layer holds it: the id of the API (a GUID), with no colon, which separates the day. */
const PROPERTY_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** What a layer of the guest notification opens on: a property and, when the address says it, an arrival day. */
interface LayerAddress {
  propertyId: string;
  /** The arrival day (`yyyy-MM-dd`); absent when the address names none: the layer then opens on the first day still to notify. */
  day?: string;
}

/**
 * The id of the layer for a property and, when it is a real calendar day, an arrival day; `null` when the property is not one an address can hold.
 * A day that is not a day (a month, a mistyped date) is left out: the layer then opens on the first day to notify, never on a date nobody asked for.
 */
export function layerIdOf(propertyId: string, day?: string | null): string | null {
  if (!PROPERTY_ID.test(propertyId)) return null;
  const id = day && isStayDate(day) ? `${propertyId}:${day}` : propertyId;
  return isValidDetailId(id) ? id : null;
}

/** The property and the day of the id the drawer hands to a layer; `null` when the id is not one the layer makes (the layer then says it cannot find it). */
export function parseLayerId(id: string): LayerAddress | null {
  const [propertyId, day, ...rest] = id.split(':');
  if (!PROPERTY_ID.test(propertyId) || rest.length > 0) return null;
  if (day === undefined) return { propertyId };
  // A day that is not a day is not an error of the person: the property still opens, on its first day to notify.
  return isStayDate(day) ? { propertyId, day } : { propertyId };
}
