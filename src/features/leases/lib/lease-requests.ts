import type { TFunction } from 'i18next';
import type { DayListItem } from '@/components/shared/calm';
import { hostPhaseOf, isClosedRequest, notesSnippet, waitsForLandlord, whenText, type HostPhase } from '@/features/service-requests/long-rent/long-rent-request-model';
import { longRentRequestPath } from '@/features/service-requests/long-rent/paths';
import { requestTitle } from '@/features/supplier/requests/request-model';
import { getServiceRequestStatusLabel } from '@/lib/i18n-labels';
import type { ServiceRequest } from '@/types/service-request';

/** The one thing the landlord is asked to do about a request, in a few words: the phases where it is their turn (the page of the request does it). */
const ACTION_KEYS: Readonly<Partial<Record<HostPhase, string>>> = {
  proposal: 'leaseSheet.requests.action.proposal',
  confirmAmount: 'leaseSheet.requests.action.confirmAmount',
  payOnline: 'leaseSheet.requests.action.pay',
  payManual: 'leaseSheet.requests.action.markPaid',
};

export interface LeaseRequestRows {
  /** The requests still to follow, the ones that wait for the landlord first. */
  open: DayListItem[];
  /** The requests that are over (paid, rejected, cancelled). */
  closed: DayListItem[];
}

/**
 * The jobs asked of the suppliers for one lease, as the rows of the tab «Interventi» of its sheet (LR-03c): the day of the job (else the day
 * it was asked), what it is, the supplier and the hours, its state in words, and, for the ones that wait for the landlord, the one thing to do
 * (it leads to the page of the request, where it is done). The server decides the state and what changes what is asked of the landlord; here
 * only the words are chosen. Nothing of the tenant is in a row: a request carries the property and the lease, not the person.
 */
export function leaseRequestRows(requests: readonly ServiceRequest[], { t, language }: { t: TFunction; language: string }): LeaseRequestRows {
  const rowOf = (request: ServiceRequest): { row: DayListItem; waits: boolean } => {
    const phase = hostPhaseOf(request);
    const waits = waitsForLandlord(phase);
    const when = whenText(request, language, t);
    const title = requestTitle(request, t);
    const actionKey = ACTION_KEYS[phase];
    const path = longRentRequestPath(request.id);
    return {
      waits,
      row: {
        id: request.id,
        day: request.scheduledStart || request.createdAt,
        title,
        subtitle: [request.supplierName, when.time ?? notesSnippet(request.notes)].filter(Boolean).join(' · ') || undefined,
        meta: getServiceRequestStatusLabel(request.status, t),
        tone: waits ? 'warning' : undefined,
        href: path,
        action: waits && actionKey ? { label: t(actionKey), ariaLabel: `${t(actionKey)}: ${title}`, href: path } : undefined,
      },
    };
  };

  const rows = requests.map((request) => ({ request, ...rowOf(request) }));
  const open = rows.filter(({ request }) => !isClosedRequest(request.status));
  return {
    // Stable: the ones that wait for the landlord go up, the rest keeps the order the server gave (newest first).
    open: [...open.filter((entry) => entry.waits), ...open.filter((entry) => !entry.waits)].map((entry) => entry.row),
    closed: rows.filter(({ request }) => isClosedRequest(request.status)).map((entry) => entry.row),
  };
}
