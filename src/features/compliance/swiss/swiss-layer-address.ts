import { searchWithDetail } from '@/lib/detail-address';
import { layerIdOf, parseLayerId } from '../lib/layer-address';
import { COMPLIANCE_COCKPIT_PATH } from '../ticino/ticino-layer-address';

/**
 * The address of the layer of the assisted notification of the guests of a property in a canton other than Ticino (E31/F02/US02/T02, NF-131, casazen/backend#979). It is a kind of
 * the global detail drawer (UI-15), as the Ticino one is: `?detail=swiss-notification:<property>` or `?detail=swiss-notification:<property>:<yyyy-MM-dd>` on the page of the cockpit,
 * so a link, a notification or a bookmark opens the guests of that property over the cockpit, on that arrival day (without one, on the first day still to notify). This file is the pure
 * part: from the property and the day to the address and back.
 */
export const SWISS_LAYER_KIND = 'swiss-notification';

/** The property and the day of the id the drawer hands to the layer; `null` when the id is not one this layer makes (the layer then says it cannot find it). */
export const parseSwissLayerId = parseLayerId;

/**
 * The address that opens the layer of a property over the cockpit (`/app/short-rent/compliance?detail=swiss-notification:<property>[:<day>]`): the one the cockpit rows, the bell and
 * the card of the regime of the property page lead to. Without a property an address can hold, the cockpit alone.
 */
export function swissLayerPath(propertyId: string | null | undefined, day?: string | null): string {
  const id = propertyId ? layerIdOf(propertyId, day) : null;
  return id ? `${COMPLIANCE_COCKPIT_PATH}${searchWithDetail('', { kind: SWISS_LAYER_KIND, id })}` : COMPLIANCE_COCKPIT_PATH;
}
