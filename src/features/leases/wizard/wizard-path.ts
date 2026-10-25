import { leasesApi } from '@/api/leases.api';
import { firstStepWithNeeds, leaseEditPath, registeredSteps } from './wizard-model';

/**
 * Where the wizard of a contract already signed opens once its contract was looked at (NL-DOCS, and the contract ConcordatoFacile
 * delivers, CF-IMPORT): the first step with something missing when the contract was read, or by hand from the parties when it was not
 * (the reading failed, found nothing, or is still going on). The draft is read once, for its flow only, and not kept.
 */
export async function wizardPath(leaseId: string, read: boolean): Promise<string> {
  if (!read) return leaseEditPath(leaseId, 2);
  try {
    const draft = await leasesApi.getDraft(leaseId);
    return leaseEditPath(leaseId, firstStepWithNeeds(draft.flow, registeredSteps('Imported')));
  } catch {
    // The wizard reads the draft itself and says what is wrong with it.
    return leaseEditPath(leaseId, 2);
  }
}
