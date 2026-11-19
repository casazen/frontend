import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHttpStatus } from '@/lib/api-errors';
import { useIstatCoverage } from '@/queries/use-istat-regions';
import { istatTakenCareOf } from './istat-coverage-model';

/**
 * What a fixed sentence of a screen may say about the ISTAT of a property (E21/F01/US02/T01): `unchanged` while the activation of the channel manager is off (or the coverage is not there to
 * be read, or the property is outside Italy): the screen is what it was; `covered` when the table says the channel manager sends the ISTAT of the region: the sentence may say that it is taken
 * care of; `seeNotice` for everything else, a read that is still on its way or failed included: the sentence is replaced by a pointer to the coverage notice, never a state that is not checked.
 */
export type IstatClaim = 'unchanged' | 'covered' | 'seeNotice';

interface IstatClaimOptions {
  /** The sentence is about the sender in force (the end of the wizard, the panel of the property): it may only be said when that sender is the channel manager. */
  channelManagerSends?: boolean;
  /** Ask nothing (the person may not read the property). */
  enabled?: boolean;
}

export function useIstatClaim(propertyId: string, { channelManagerSends = false, enabled = true }: IstatClaimOptions = {}): IstatClaim {
  const { flags } = useFeatureFlags();
  const on = enabled && flags.octorateOnboarding === true && propertyId !== '';
  const coverage = useIstatCoverage(propertyId, on);

  if (!on) return 'unchanged';
  if (coverage.isError) {
    // What an error leaves in the cache is not an answer. A 404 or a 403 is a property or a flag the notice draws nothing for: the screen is what it was; any other failure is «da verificare».
    const status = getHttpStatus(coverage.error);
    return status === 404 || status === 403 ? 'unchanged' : 'seeNotice';
  }
  if (!coverage.data) return 'seeNotice';
  if (!coverage.data.applies) return 'unchanged';
  return istatTakenCareOf(coverage.data, channelManagerSends) ? 'covered' : 'seeNotice';
}
