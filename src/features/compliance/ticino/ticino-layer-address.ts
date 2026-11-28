import { searchWithDetail } from '@/lib/detail-address';
import { layerIdOf, parseLayerId } from '../lib/layer-address';

export const TICINO_LAYER_KIND = 'ticino';

export const COMPLIANCE_COCKPIT_PATH = '/app/short-rent/compliance';

export const parseTicinoLayerId = parseLayerId;

export function ticinoLayerPath(propertyId: string | null | undefined, day?: string | null): string {
  const id = propertyId ? layerIdOf(propertyId, day) : null;
  return id ? `${COMPLIANCE_COCKPIT_PATH}${searchWithDetail('', { kind: TICINO_LAYER_KIND, id })}` : COMPLIANCE_COCKPIT_PATH;
}
