import { searchWithDetail } from '@/lib/detail-address';
import { layerIdOf, parseLayerId } from '../lib/layer-address';
import { COMPLIANCE_COCKPIT_PATH } from '../ticino/ticino-layer-address';

export const SWISS_LAYER_KIND = 'swiss-notification';

export const parseSwissLayerId = parseLayerId;

export function swissLayerPath(propertyId: string | null | undefined, day?: string | null): string {
  const id = propertyId ? layerIdOf(propertyId, day) : null;
  return id ? `${COMPLIANCE_COCKPIT_PATH}${searchWithDetail('', { kind: SWISS_LAYER_KIND, id })}` : COMPLIANCE_COCKPIT_PATH;
}
