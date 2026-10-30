import { useMemo, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, BellRing, CalendarCheck, CalendarDays, CreditCard, Euro, ExternalLink, Phone, RotateCcw, UserRound, Wrench, X, XCircle } from 'lucide-react';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListCardContent, ListMenuEntry, ListRowAction } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { requestTitle } from '@/features/supplier/requests/request-model';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { ServiceRequest } from '@/types/service-request';
import { priceText, whenText } from '../long-rent/long-rent-request-model';
import {
  againPathOf,
  canDo,
  DEFAULT_INTERVENTION_CHIP,
  hostActionKind,
  isOver,
  mayDo,
  phoneHref,
  remindWaitText,
  waitsForHost,
  type HostPermissions,
} from './intervention-model';
import { INTERVENTION_DRAWER_KIND, interventionPath, requestInterventionPath } from './paths';
import type { InterventionSteps } from './use-intervention-actions';

export interface InterventionsListOptions {
  steps: InterventionSteps;
  /** A step is running: the one action of a row waits, so that a second tap cannot send it twice. */
  busy: boolean;
  permissions: HostPermissions;
  /** The properties of the host, for the filter. */
  properties: readonly { id: string; name: string }[];
  /** The suppliers the host asked, for the filter. */
  suppliers: readonly { value: string; label: string }[];
  /** The codes of the categories of the catalog, for the filter. */
  categories: readonly string[];
}

/** The line under the name of an intervention: where, and how pressing when it is not an ordinary one. */
function subLine(request: ServiceRequest, t: TFunction): string {
  const urgency = request.urgency === 'Normal' ? null : t(`interventions.list.urgency.${request.urgency}`);
  return [request.propertyName, request.propertyCity, urgency].filter(Boolean).join(' · ');
}

/** The day and the hours of the work; a request with no time says so, it is never made up. */
function whenCell(request: ServiceRequest, t: TFunction, language: string): ReactNode {
  const when = whenText(request, language, t);
  if (!when.day) return <span className="text-foreground/70">{t('interventions.list.noTime')}</span>;
  return (
    <>
      <span className="block">{when.day}</span>
      {when.time ? <span className="block text-sm text-foreground/70">{when.time}</span> : null}
    </>
  );
}

function whenLine(request: ServiceRequest, t: TFunction, language: string): string {
  const when = whenText(request, language, t);
  return [when.day, when.time].filter(Boolean).join(' · ') || t('interventions.list.noTime');
}

/** What the server asks of the host, as a few words under the state: only the cases the state alone does not say. */
function stateNote(request: ServiceRequest, t: TFunction): string | null {
  switch (hostActionKind(request)) {
    case 'acceptProposal':
      return t('interventions.list.note.proposal');
    case 'confirmFinalAmount':
      return t('interventions.list.note.amount');
    default:
      return null;
  }
}

/**
 * The list of the interventions of the host (SR-08) on the unified list (UI-14), in `server` mode: the server filters it, counts the
 * chips, orders it and pages it (`GET /api/service-requests`, SR-08a), and the list shows the rows as they come.
 *
 * Five columns: what and where, when, the supplier, the state and the price. The stay, and the day the request was made, are for who asks
 * for them. **The one action of a row is the one the server names** (`hostAction`): the list reads it and has no state logic of its own;
 * the rest is in the menu «⋯». A person who may not write sees no button (decision SR-D30). The name of a row opens its drawer (UI-15, the
 * same one the calendar opens); «Apri la scheda» leads to the page.
 *
 * The chips are the views of the API (`?chip=topay` in the address, `view=topay` in the request); only «Da pagare» carries its number: it is
 * what asks something of the host (UI-14 puts a number on the chips that need attention, and on those alone).
 */
export function useInterventionsList({ steps, busy, permissions, properties, suppliers, categories }: InterventionsListOptions) {
  const { t, i18n } = useTranslation();
  const { canManage, canRequest } = permissions;

  return useMemo(() => {
    const language = i18n.language;

    const primaryOf = (request: ServiceRequest): ListRowAction | null => {
      const kind = hostActionKind(request);
      const may = (action: string) => mayDo(action, { canManage, canRequest });

      if (kind === 'none') {
        // A new request reminded not long ago: the button is not there to press, it says when it will be.
        const wait = remindWaitText(request, t);
        return wait && may('remind') ? { id: 'remind-wait', label: wait, icon: BellRing, disabled: true, testId: 'intervention-row-remind-wait' } : null;
      }
      if (!may(kind)) return null;

      switch (kind) {
        case 'remind':
          return { id: 'remind', label: t('interventions.action.remind'), icon: BellRing, disabled: busy, onSelect: () => steps.remind(request), testId: 'intervention-row-remind' };
        case 'acceptProposal':
          return { id: 'accept', label: t('interventions.action.acceptProposal'), icon: CalendarCheck, disabled: busy, onSelect: () => steps.acceptProposal(request), testId: 'intervention-row-accept' };
        case 'confirmFinalAmount':
          return { id: 'confirm', label: t('interventions.action.confirmAmount'), icon: BadgeCheck, disabled: busy, onSelect: () => steps.confirmAmount(request), testId: 'intervention-row-confirm' };
        case 'pay':
          return { id: 'pay', label: t('interventions.action.pay'), icon: CreditCard, disabled: busy, onSelect: () => steps.pay(request), testId: 'intervention-row-pay' };
        case 'markPaid':
          return { id: 'markPaid', label: t('interventions.action.markPaid'), icon: BadgeCheck, disabled: busy, onSelect: () => steps.markPaid(request), testId: 'intervention-row-mark-paid' };
        case 'requestAgain':
          return { id: 'again', label: t('interventions.action.requestAgain'), icon: RotateCcw, href: againPathOf(request), testId: 'intervention-row-again' };
        default:
          return null;
      }
    };

    const stateCell = (request: ServiceRequest) => {
      const note = stateNote(request, t);
      return (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <StatusBadge kind="request" status={request.status} />
          {note ? (
            <span className="text-xs font-medium text-warning-foreground" data-testid="intervention-state-note">
              {note}
            </span>
          ) : null}
        </div>
      );
    };

    const priceCell = (request: ServiceRequest) => {
      const price = priceText(request, language);
      return price ? <span className="whitespace-nowrap font-medium">{price}</span> : <span className="text-foreground/70">{t('interventions.list.priceTbd')}</span>;
    };

    return defineList<ServiceRequest>({
      key: 'interventions',
      title: t('interventions.title'),
      rowKey: (request) => request.id,
      rowLabel: (request) => [requestTitle(request, t), request.propertyName].filter(Boolean).join(' · '),
      columns: [
        {
          id: 'request',
          label: t('interventions.list.columns.request'),
          default: true,
          always: true,
          rowHeader: true,
          render: (request, cell) => {
            const sub = subLine(request, t);
            return (
              <span className="block min-w-0">
                {cell.open(requestTitle(request, t))}
                {sub ? <span className="mt-0.5 block break-words text-sm font-normal text-foreground/70">{sub}</span> : null}
              </span>
            );
          },
        },
        // The ids of the two columns the server can order by (`SORT_KEYS` of the model).
        {
          id: 'when',
          label: t('interventions.list.columns.when'),
          default: true,
          sort: (request) => request.scheduledStart ?? null,
          render: (request) => whenCell(request, t, language),
        },
        {
          id: 'supplier',
          label: t('interventions.list.columns.supplier'),
          default: true,
          render: (request) => <span className="break-words">{request.supplierName || '—'}</span>,
        },
        {
          id: 'state',
          label: t('interventions.list.columns.state'),
          default: true,
          sort: (request) => request.status,
          render: stateCell,
        },
        {
          id: 'price',
          label: t('interventions.list.columns.price'),
          default: true,
          align: 'end',
          render: priceCell,
        },
        {
          id: 'stay',
          label: t('interventions.list.columns.stay'),
          render: (request) => (request.stay ? <span className="break-words">{request.stay.guestName}</span> : <span className="text-foreground/70">—</span>),
        },
        {
          id: 'requested',
          label: t('interventions.list.columns.requested'),
          sort: (request) => request.createdAt,
          render: (request) => formatRomeDateTime(request.createdAt, language, { day: 'numeric', month: 'short', year: 'numeric' }),
        },
      ],

      search: { label: t('interventions.list.searchLabel'), placeholder: t('interventions.list.searchPlaceholder') },
      chips: [
        { id: 'all', label: t('interventions.list.chips.all') },
        { id: 'pending', label: t('interventions.list.chips.pending'), hint: t('interventions.list.chips.pendingHint') },
        { id: 'active', label: t('interventions.list.chips.active'), hint: t('interventions.list.chips.activeHint') },
        { id: 'topay', label: t('interventions.list.chips.topay'), urgent: true, hint: t('interventions.list.chips.topayHint') },
        { id: 'done', label: t('interventions.list.chips.done'), hint: t('interventions.list.chips.doneHint') },
      ],
      defaultChip: DEFAULT_INTERVENTION_CHIP,
      filters: [
        {
          id: 'property',
          type: 'select',
          label: t('interventions.list.filters.property'),
          allLabel: t('interventions.list.filters.allProperties'),
          options: properties.map((property) => ({ value: property.id, label: property.name })),
        },
        // The choices are those of the latest interventions: a list of rows is a function, so that an address that names a supplier the
        // list does not know yet is not dropped before the choices have arrived.
        {
          id: 'supplier',
          type: 'select',
          label: t('interventions.list.filters.supplier'),
          allLabel: t('interventions.list.filters.allSuppliers'),
          options: () => suppliers,
        },
        {
          id: 'type',
          type: 'select',
          label: t('interventions.list.filters.category'),
          allLabel: t('interventions.list.filters.allCategories'),
          options: categories.map((code) => ({ value: code, label: getServiceCategoryLabel(code, t) })),
        },
        { id: 'date', type: 'date', label: t('interventions.list.filters.date') },
      ],

      primaryAction: primaryOf,
      menu: (request) => {
        const entries: ListMenuEntry[] = [{ id: 'page', label: t('interventions.action.openPage'), icon: ExternalLink, href: interventionPath(request.id) }];
        const phone = request.supplierContact?.phone?.trim();
        if (phone) entries.push({ id: 'call', label: t('interventions.action.call'), icon: Phone, href: phoneHref(phone), testId: 'intervention-row-call' });
        if (canManage && canDo(request, 'rejectProposal')) {
          entries.push({ id: 'reject', label: t('interventions.action.rejectProposal'), icon: X, disabled: busy, onSelect: () => steps.rejectProposal(request) });
        }
        if (canManage && canDo(request, 'cancel')) {
          entries.push('separator');
          entries.push({ id: 'cancel', label: t('interventions.action.cancel'), icon: XCircle, danger: true, onSelect: () => steps.cancel(request), testId: 'intervention-row-cancel' });
        }
        return entries;
      },

      card: (request): ListCardContent => {
        const note = stateNote(request, t);
        return {
          title: requestTitle(request, t),
          sub: subLine(request, t) || undefined,
          status: <StatusBadge kind="request" status={request.status} />,
          meta: [
            { icon: CalendarDays, label: t('interventions.list.columns.when'), text: whenLine(request, t, language) },
            { icon: UserRound, label: t('interventions.list.columns.supplier'), text: request.supplierName || '—' },
            { icon: Euro, label: t('interventions.list.columns.price'), text: priceText(request, language) ?? t('interventions.list.priceTbd') },
            ...(note ? [{ text: note }] : []),
          ],
        };
      },
      // The swipe is the one action of the row and nothing else; the menu of the card has it too (a gesture is never the only way).
      swipe: (request) => {
        const primary = primaryOf(request);
        return primary && !primary.disabled
          ? { left: { id: primary.id, label: primary.label, icon: primary.icon, tone: 'success', href: primary.href, onSelect: primary.onSelect } }
          : undefined;
      },

      // The name opens the drawer (UI-15); «Apri la scheda» leads to the page, which is also where a row goes when the drawer cannot open it.
      rowHref: (request) => interventionPath(request.id),
      detail: { drawerKind: INTERVENTION_DRAWER_KIND },
      // What waits for the host is marked at the start of its row; what is over is quieter.
      rowTone: (request) => (waitsForHost(request) ? 'urgent' : isOver(request.status) ? 'done' : undefined),
      // With the sidebar open (from `lg`) five columns and the button are not seen whole under 1280 px: cards until then.
      cardsUntil: 'xl',
      csv: false,

      empty: {
        icon: Wrench,
        title: t('interventions.list.emptyTitle'),
        description: t('interventions.list.emptyDescription'),
        action: canRequest ? { label: t('interventions.request'), href: requestInterventionPath() } : undefined,
      },
      noResults: { title: t('interventions.list.noResultsTitle'), description: t('interventions.list.noResultsDescription') },
      countLabel: (count) => t('interventions.list.count', { count }),
    });
  }, [t, i18n.language, steps, busy, canManage, canRequest, properties, suppliers, categories]);
}
