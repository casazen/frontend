import { getStatusView } from '@/components/shared/status/status-view';
import type { SupplierServiceRequest } from '@/types/service-request';
import { phaseOf, type RequestPhase } from './request-model';

/** The phases that are a state of their own and not a status of the API, by the `data-status` they carry. */
export const PHASE_STATUS: Partial<Record<RequestPhase, string>> = {
  proposalPending: 'ProposalPending',
  quotePending: 'QuotePending',
  backupWaiting: 'BackupWaiting',
  backupAccepted: 'BackupAccepted',
  backupActive: 'BackupActive',
};

/** The state of a request as plain text, in the same words as the badge of `request-parts`: for the CSV of the list (SP-08b). */
export function requestStateText(
  request: SupplierServiceRequest,
  t: Parameters<typeof getStatusView>[3],
  i18n: Parameters<typeof getStatusView>[4],
): string {
  const phase = phaseOf(request);
  if (PHASE_STATUS[phase]) return t(`supplier.requests.phase.${phase}`);
  return getStatusView('request', request.status, 'supplier', t, i18n).label;
}
