import { getStatusView } from '@/components/shared/status/status-view';
import type { SupplierServiceRequest } from '@/types/service-request';
import { phaseOf, type RequestPhase } from './request-model';

export const PHASE_STATUS: Partial<Record<RequestPhase, string>> = {
  proposalPending: 'ProposalPending',
  quotePending: 'QuotePending',
  backupWaiting: 'BackupWaiting',
  backupAccepted: 'BackupAccepted',
  backupActive: 'BackupActive',
};

export function requestStateText(
  request: SupplierServiceRequest,
  t: Parameters<typeof getStatusView>[3],
  i18n: Parameters<typeof getStatusView>[4],
): string {
  const phase = phaseOf(request);
  if (PHASE_STATUS[phase]) return t(`supplier.requests.phase.${phase}`);
  return getStatusView('request', request.status, 'supplier', t, i18n).label;
}
