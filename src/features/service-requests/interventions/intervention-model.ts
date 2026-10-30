import type { TFunction } from 'i18next';
import { parseDateRange, type ListState } from '@/components/shared/list-view/list-state';
import type { ListSort } from '@/components/shared/list-view/list-types';
import type {
  HostActionKind,
  InterventionFilterParams,
  InterventionListParams,
  InterventionView,
  ServiceRequest,
  ServiceRequestStatus,
} from '@/types/service-request';

/**
 * What the host's page of the interventions (SR-08) knows about a request, worked out from what the API sends and nothing more.
 * The state machine is the server's: the page reads `hostAction` and `availableActions`, it never works out what comes next.
 */

/** Requests in a page of the list. */
export const INTERVENTIONS_PAGE_SIZE = 20;

/** The chips are the views of the API: their ids are what the address (`?chip=topay`) and the request (`view=topay`) call them. */
export const INTERVENTION_CHIPS: readonly InterventionView[] = ['all', 'pending', 'active', 'topay', 'done'];

/** The chip the list opens on: every intervention, the ones that wait for the host first. */
export const DEFAULT_INTERVENTION_CHIP: InterventionView = 'all';

/** The longest search the server accepts (it refuses one shorter than two letters, so a single letter is not sent). */
const MAX_SEARCH_LENGTH = 60;

/** The columns the server orders by (`sort` of the API), by the id of the column. */
const SORT_KEYS: Readonly<Record<string, string>> = { when: 'scheduled', state: 'status', requested: 'created' };

/** The filters of the state of the list as the API takes them: for the rows and for the numbers on the chips. */
export function interventionFilterParams(
  state: Pick<ListState, 'q' | 'filters'>,
  address: { bookingId?: string } = {},
): InterventionFilterParams {
  const query = state.q.trim();
  const { from, to } = parseDateRange(state.filters.date ?? '');
  return {
    q: query.length >= 2 ? query.slice(0, MAX_SEARCH_LENGTH) : undefined,
    propertyId: state.filters.property || undefined,
    supplierOrgId: state.filters.supplier || undefined,
    category: state.filters.type || undefined,
    bookingId: address.bookingId || undefined,
    from,
    to,
  };
}

/**
 * The order of the rows. What the person chose; without a choice, what waits for the host comes first on the plain list, the next work
 * first where the work is still to be done, and the latest first where it is over.
 */
function sortOf(sort: ListSort | null, chip: InterventionView): string {
  const key = sort ? SORT_KEYS[sort.id] : undefined;
  if (sort && key) return `${key}:${sort.direction}`;
  if (chip === 'pending' || chip === 'active') return 'scheduled:asc';
  if (chip === 'topay' || chip === 'done') return 'scheduled:desc';
  return 'status:asc';
}

/** What the state of the list asks of `GET /api/service-requests`. */
export function interventionListParams(state: ListState, address: { bookingId?: string } = {}): InterventionListParams {
  const chip = (INTERVENTION_CHIPS as readonly string[]).includes(state.chip) ? (state.chip as InterventionView) : DEFAULT_INTERVENTION_CHIP;
  return { ...interventionFilterParams(state, address), view: chip, sort: sortOf(state.sort, chip), page: state.page, pageSize: INTERVENTIONS_PAGE_SIZE };
}

/** The chip an old address (`?status=Completato`, the tabs of the old list) stands for. */
const LEGACY_STATUS_CHIPS: Readonly<Record<string, InterventionView>> = {
  Richiesto: 'pending',
  PresoInCarico: 'active',
  InCorso: 'active',
  Completato: 'topay',
  Pagato: 'done',
  Rifiutato: 'done',
  Annullato: 'done',
};

/**
 * An address of the page as the links of the app wrote it (`?propertyId=`, `?status=`) as the address of this list (`?f_property=`,
 * `?chip=`), or null when it has neither. What the address already says of the list is kept; `bookingId` is left where it is.
 */
export function currentInterventionsSearch(address: URLSearchParams): URLSearchParams | null {
  const status = address.get('status');
  const propertyId = address.get('propertyId');
  if (status === null && propertyId === null) return null;

  const next = new URLSearchParams(address);
  next.delete('status');
  next.delete('propertyId');
  const chip = status ? LEGACY_STATUS_CHIPS[status] : undefined;
  if (chip && !next.has('chip')) next.set('chip', chip);
  if (propertyId && !next.has('f_property')) next.set('f_property', propertyId);
  return next;
}

// ─── What the server says the host can do ───

/** The word of the server for the one action of the row (`hostAction.kind`); `none` for a request without one and for a word this version does not know. */
export function hostActionKind(request: Pick<ServiceRequest, 'hostAction'>): HostActionKind {
  const kind = request.hostAction?.kind;
  switch (kind) {
    case 'remind':
    case 'acceptProposal':
    case 'confirmFinalAmount':
    case 'pay':
    case 'markPaid':
    case 'requestAgain':
      return kind;
    default:
      return 'none';
  }
}

/** The action is among the ones the server says the host can do now (`availableActions`). */
export function canDo(request: Pick<ServiceRequest, 'availableActions'>, action: string): boolean {
  return request.availableActions?.includes(action) ?? false;
}

/** What waits for the host to be done: an answer to give, an amount to confirm, a payment. The row says so. */
export function waitsForHost(request: Pick<ServiceRequest, 'hostAction'>): boolean {
  const kind = hostActionKind(request);
  return kind === 'acceptProposal' || kind === 'confirmFinalAmount' || kind === 'pay' || kind === 'markPaid';
}

/** A request that is over for good: paid, refused or cancelled. The row is quieter. */
export function isOver(status: ServiceRequestStatus): boolean {
  return status === 'Pagato' || status === 'Rifiutato' || status === 'Annullato';
}

/** The permissions of the person in the short-rent area that decide which buttons it gets. */
export interface HostPermissions {
  /** `property.write`: remind, answer a time, confirm an amount, pay, cancel. */
  canManage: boolean;
  /** `servicerequest.write`: ask for an intervention, mark one paid. A collaborator has it and has not `property.write` (decision SR-D30). */
  canRequest: boolean;
}

/** May the person do the action? The server decides again (403); this keeps the buttons the person cannot press off the page. */
export function mayDo(action: string, permissions: HostPermissions): boolean {
  switch (action) {
    case 'markPaid':
    case 'requestAgain':
      return permissions.canRequest;
    default:
      return permissions.canManage;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The stay an address narrows the list to (`?bookingId=`, how the page of a booking links here): only an id the API can read. */
export function readBookingId(address: URLSearchParams): string | undefined {
  const value = address.get('bookingId')?.trim();
  return value && UUID.test(value) ? value : undefined;
}

/** The suppliers of some requests as the choices of a filter: each one once, by name; a request with no supplier name adds none. */
export function supplierOptions(requests: readonly Pick<ServiceRequest, 'supplierOrgId' | 'supplierName'>[]): { value: string; label: string }[] {
  const names = new Map<string, string>();
  for (const request of requests) {
    const name = request.supplierName?.trim();
    if (name && request.supplierOrgId && !names.has(request.supplierOrgId)) names.set(request.supplierOrgId, name);
  }
  return [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** The phone number as a link that starts a call (`tel:`): digits and a leading plus only. */
export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** "tra 3 ore" / "tra 40 minuti": how long until the host can remind the supplier again, or `null` when it already can. */
export function remindWaitText(request: Pick<ServiceRequest, 'hostAction'>, t: TFunction, now: number = Date.now()): string | null {
  const at = request.hostAction?.remindAvailableAt;
  if (!at) return null;
  const ms = Date.parse(at) - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.ceil(ms / 60_000);
  return minutes >= 60
    ? t('interventions.action.remindInHours', { count: Math.ceil(minutes / 60) })
    : t('interventions.action.remindInMinutes', { count: minutes });
}
