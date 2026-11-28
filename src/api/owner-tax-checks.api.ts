import axios from '@/lib/axios';
import { ApiClient } from './client';
import { acceptsRefusal } from './accept-refusal';
import type { CompanyTenantCase, CompanyTenantCaseState, DecideShortLetTaxCommand, OwnerUnitsCheck, ShortLetTaxDecision } from '@/types';

/**
 * The two checks of the Italian short-let withholding that look at the owner and at the tenant (E18/F01/US03/T01, NF-117, ⚖ I7 and I8). Paths are relative to the API base URL, which already ends in `/api`.
 * Every call exists behind the flag `taxReportingExports`: the backend answers 404 while it is off, so nothing asks for them without the flag. The reach of the caller is the server's: a booking or an owner outside it
 * is the 404 of one that does not exist.
 */
export const ownerTaxChecksApi = {
  /**
   * The stays of a company tenant in the Italian property of a private owner, the most recent check-out first (at most 200), with the decision in force; `state` keeps only the ones still `Pending` or only the ones
   * `Decided`. It needs `agency.owner.financial.read`: `null` when the server refuses it to this caller (403), which the page tells instead of the whole app going to the page of no access. Never the tenant.
   */
  listCompanyTenantCases: async (state?: CompanyTenantCaseState): Promise<CompanyTenantCase[] | null> => {
    const response = await axios.get<CompanyTenantCase[]>('/owner-tax-decisions', { params: state ? { state } : undefined, validateStatus: acceptsRefusal });
    return response.status === 403 ? null : response.data;
  },

  decide: (command: DecideShortLetTaxCommand) => ApiClient.post<ShortLetTaxDecision>('/owner-tax-decisions', command),

  getUnitsCheck: async (ownerId: string): Promise<OwnerUnitsCheck | null> => {
    const response = await axios.get<OwnerUnitsCheck>(`/owners/${encodeURIComponent(ownerId)}/tax-checks`, { validateStatus: acceptsRefusal });
    return response.status === 403 ? null : response.data;
  },

  declareExternalUnits: (ownerId: string, units: number) => ApiClient.put<OwnerUnitsCheck>(`/owners/${encodeURIComponent(ownerId)}/external-short-let-units`, { units }),
};
