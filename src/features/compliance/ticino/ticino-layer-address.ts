import { searchWithDetail } from '@/lib/detail-address';
import { layerIdOf, parseLayerId } from '../lib/layer-address';

/**
 * The address of the layer of the Ticino police notification (E30/F02/US03, casazen/backend#979). It is a kind of the global detail drawer (UI-15), so the
 * address is `?detail=ticino:<property>` or `?detail=ticino:<property>:<yyyy-MM-dd>` on the page of the cockpit, and a link, a notification or a bookmark
 * opens the guided notification of that property over the cockpit, on that arrival day (without one, on the first day still to notify). This file is the
 * pure part: from the property and the day to the address and back.
 */
export const TICINO_LAYER_KIND = 'ticino';

/** The page the layer opens over: the cockpit of the adempimenti, where the days to notify are listed. */
export const COMPLIANCE_COCKPIT_PATH = '/app/short-rent/compliance';

/** The property and the day of the id the drawer hands to the layer; `null` when the id is not one this layer makes (the layer then says it cannot find it). */
export const parseTicinoLayerId = parseLayerId;

/**
 * The address that opens the layer of a property over the cockpit (`/app/short-rent/compliance?detail=ticino:<property>[:<day>]`): the one the cockpit rows, the bell, the property
 * page and the old address of the page (`/app/short-rent/compliance/ticino?property=&date=`) lead to. Without a property an address can hold, the cockpit alone.
 */
export function ticinoLayerPath(propertyId: string | null | undefined, day?: string | null): string {
  const id = propertyId ? layerIdOf(propertyId, day) : null;
  return id ? `${COMPLIANCE_COCKPIT_PATH}${searchWithDetail('', { kind: TICINO_LAYER_KIND, id })}` : COMPLIANCE_COCKPIT_PATH;
}
