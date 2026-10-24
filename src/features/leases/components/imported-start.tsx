import type { LeaseContractType } from '@/types';
import { NewLeaseStep } from '../wizard/new-lease-step';

/**
 * Where «Ho già i documenti» of a new contract leads, whatever its type: the ONE place that decides what a contract the person
 * already has starts with. Today it is the wizard of a contract already signed (the origin is `Imported`, chosen here and never
 * changed) with the data typed by hand and the type already chosen; the screen that takes the documents and reads them replaces this
 * body and nothing else of the page.
 */
export function ImportedStart({ contractType, defaultPropertyId }: { contractType: LeaseContractType; defaultPropertyId?: string }) {
  return <NewLeaseStep origin="Imported" contractType={contractType} defaultPropertyId={defaultPropertyId} />;
}
