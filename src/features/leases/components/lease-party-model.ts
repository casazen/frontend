import { type LeasePartyFormValues } from '../schemas/lease.schema';
import { normalizeFiscalCode } from '@/lib/fiscal-code';

export function emptyParty(role: 'Landlord' | 'Tenant'): LeasePartyFormValues {
  return { role, firstName: '', lastName: '', fiscalCode: '', citizenship: '', contactEmail: '' };
}


export function toPartyDto(party: LeasePartyFormValues, role: 'Landlord' | 'Tenant') {
  return { ...party, role, fiscalCode: normalizeFiscalCode(party.fiscalCode) };
}
