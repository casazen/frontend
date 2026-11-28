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
import { requestInterventionPath } from './paths';

export const INTERVENTIONS_PAGE_SIZE = 20;

export const INTERVENTION_CHIPS: readonly InterventionView[] = ['all', 'pending', 'active', 'topay', 'done'];

export const DEFAULT_INTERVENTION_CHIP: InterventionView = 'all';

const MAX_SEARCH_LENGTH = 60;

const SORT_KEYS: Readonly<Record<string, string>> = { when: 'scheduled', state: 'status', requested: 'created' };

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

function sortOf(sort: ListSort | null, chip: InterventionView): string {
  const key = sort ? SORT_KEYS[sort.id] : undefined;
  if (sort && key) return `${key}:${sort.direction}`;
  if (chip === 'pending' || chip === 'active') return 'scheduled:asc';
  if (chip === 'topay' || chip === 'done') return 'scheduled:desc';
  return 'status:asc';
}

export function interventionListParams(state: ListState, address: { bookingId?: string } = {}): InterventionListParams {
  const chip = (INTERVENTION_CHIPS as readonly string[]).includes(state.chip) ? (state.chip as InterventionView) : DEFAULT_INTERVENTION_CHIP;
  return { ...interventionFilterParams(state, address), view: chip, sort: sortOf(state.sort, chip), page: state.page, pageSize: INTERVENTIONS_PAGE_SIZE };
}

const LEGACY_STATUS_CHIPS: Readonly<Record<string, InterventionView>> = {
  Richiesto: 'pending',
  PresoInCarico: 'active',
  InCorso: 'active',
  Completato: 'topay',
  Pagato: 'done',
  Rifiutato: 'done',
  Annullato: 'done',
};

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

export function canDo(request: Pick<ServiceRequest, 'availableActions'>, action: string): boolean {
  return request.availableActions?.includes(action) ?? false;
}

export function waitsForHost(request: Pick<ServiceRequest, 'hostAction'>): boolean {
  const kind = hostActionKind(request);
  return kind === 'acceptProposal' || kind === 'confirmFinalAmount' || kind === 'pay' || kind === 'markPaid';
}

export function isOver(status: ServiceRequestStatus): boolean {
  return status === 'Pagato' || status === 'Rifiutato' || status === 'Annullato';
}

export interface HostPermissions {
  canManage: boolean;
  canRequest: boolean;
}

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

export function readBookingId(address: URLSearchParams): string | undefined {
  const value = address.get('bookingId')?.trim();
  return value && UUID.test(value) ? value : undefined;
}

export function supplierOptions(requests: readonly Pick<ServiceRequest, 'supplierOrgId' | 'supplierName'>[]): { value: string; label: string }[] {
  const names = new Map<string, string>();
  for (const request of requests) {
    const name = request.supplierName?.trim();
    if (name && request.supplierOrgId && !names.has(request.supplierOrgId)) names.set(request.supplierOrgId, name);
  }
  return [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Where «Richiedi di nuovo» leads: the guided request, for the same property and the same kind of work; after a refusal not for the same
 * supplier (it said no), otherwise for it.
 */
export function againPathOf(request: Pick<ServiceRequest, 'propertyId' | 'category' | 'status' | 'supplierOrgId'>): string {
  return requestInterventionPath(request.propertyId, {
    type: request.category,
    supplierOrgId: request.status === 'Rifiutato' ? undefined : request.supplierOrgId,
  });
}

export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

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
