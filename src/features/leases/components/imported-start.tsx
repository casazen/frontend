import type { LeaseContractType } from '@/types';
import { DocumentsStart } from '../wizard/documents-start';

/**
 * Where «Ho già i documenti» of a new contract leads, whatever its type: the ONE place that decides what a contract the person
 * already has starts with. The person gives the property and the signed contract, CasaZen reads it and the wizard of a contract
 * already signed (the origin is `Imported`, chosen here and never changed) opens with the data filled in, asking only what is missing;
 * the type is the one chosen at the start. The screen also offers the data typed by hand, for who has no file at hand.
 */
export function ImportedStart({ contractType, defaultPropertyId }: { contractType: LeaseContractType; defaultPropertyId?: string }) {
  return <DocumentsStart contractType={contractType} defaultPropertyId={defaultPropertyId} />;
}
