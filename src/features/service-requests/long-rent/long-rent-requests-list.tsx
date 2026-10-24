import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { CalendarDays, Euro, UserRound, Wrench } from 'lucide-react';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListCardContent, ListDefinition } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { requestTitle } from '@/features/supplier/requests/request-model';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import type { ServiceRequest } from '@/types/service-request';
import {
  hostPhaseOf,
  isClosedRequest,
  notesSnippet,
  priceText,
  statusRank,
  waitsForLandlord,
  whenText,
  type RequestTab,
} from './long-rent-request-model';
import { longRentRequestPath } from './paths';

export interface LongRentRequestsListOptions {
  /** The tab the list is under: what an empty list says depends on it. */
  tab: RequestTab;
  /** `property.write` (long-rent): who may ask for a request gets the button in the empty list. */
  canRequest: boolean;
  /** Opens the window to ask for a request. */
  onRequest: () => void;
}

/** The line under the name of a request: where it is, and how the landlord described it. */
function subLine(request: ServiceRequest): string {
  return [request.propertyName, notesSnippet(request.notes)].filter(Boolean).join(' · ');
}

/** The cell of the day and the hours; an old request has no time, and it is said, never guessed (the supplier's list says the same). */
function whenCell(request: ServiceRequest, t: TFunction, language: string): ReactNode {
  const when = whenText(request, language, t);
  if (!when.day) return <span className="text-foreground/70">{t('longRentRequests.list.noTime')}</span>;
  return (
    <>
      <span className="block">{when.day}</span>
      {when.time ? <span className="block text-sm text-foreground/70">{when.time}</span> : null}
    </>
  );
}

/** The cell of the price as the server worked it out; "da definire" while there is none. */
function priceCell(request: ServiceRequest, t: TFunction, language: string): ReactNode {
  const price = priceText(request, language);
  return price ? <span className="whitespace-nowrap font-medium">{price}</span> : <span className="text-foreground/70">{t('longRentRequests.list.priceTbd')}</span>;
}

/**
 * The list of the requests to a supplier of Affitti lunghi (LR-08b) on the unified list (UI-14), in `client` mode: the page hands
 * over every request of the tab (the server narrows them by `view`, LR-08a) and the list searches and sorts them. Five columns,
 * the state in a `StatusBadge` of the host, a card on a phone, and the empty list in the words of the tab it is under.
 *
 * Not here: the tenant of the lease the request is for, nor the lease itself (a request is tied to the property, not to a lease),
 * and the CSV of the list.
 */
export function useLongRentRequestsList({ tab, canRequest, onRequest }: LongRentRequestsListOptions): ListDefinition<ServiceRequest> {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(() => {
    const emptyOf = {
      open: { title: t('longRentRequests.list.empty.open.title'), description: t('longRentRequests.list.empty.open.description') },
      closed: { title: t('longRentRequests.list.empty.closed.title'), description: t('longRentRequests.list.empty.closed.description') },
      all: { title: t('longRentRequests.list.empty.all.title'), description: t('longRentRequests.list.empty.all.description') },
    }[tab];

    return defineList<ServiceRequest>({
      key: 'long-rent-requests',
      title: t('nav.serviceRequests'),
      rowKey: (request) => request.id,
      rowLabel: (request) => [requestTitle(request, t), request.propertyName].filter(Boolean).join(' · '),
      columns: [
        {
          id: 'request',
          label: t('longRentRequests.list.columns.request'),
          always: true,
          default: true,
          rowHeader: true,
          sort: (request) => requestTitle(request, t),
          render: (request, cell) => {
            const sub = subLine(request);
            return (
              <span className="block min-w-0">
                {cell.open(requestTitle(request, t))}
                {sub ? <span className="mt-0.5 block break-words text-sm font-normal text-foreground/70">{sub}</span> : null}
              </span>
            );
          },
        },
        {
          id: 'when',
          label: t('longRentRequests.list.columns.when'),
          default: true,
          sort: (request) => request.scheduledStart ?? null,
          render: (request) => whenCell(request, t, language),
        },
        {
          id: 'supplier',
          label: t('longRentRequests.list.columns.supplier'),
          default: true,
          sort: (request) => request.supplierName ?? null,
          render: (request) => <span className="break-words">{request.supplierName || '—'}</span>,
        },
        {
          id: 'status',
          label: t('longRentRequests.list.columns.status'),
          default: true,
          sort: (request) => statusRank(request.status),
          render: (request) => <StatusBadge kind="request" status={request.status} />,
        },
        {
          id: 'price',
          label: t('longRentRequests.list.columns.price'),
          default: true,
          align: 'end',
          sort: (request) => request.price?.amountCents ?? null,
          render: (request) => priceCell(request, t, language),
        },
      ],
      search: {
        label: t('longRentRequests.list.search.label'),
        placeholder: t('longRentRequests.list.search.placeholder'),
        text: (request) =>
          [requestTitle(request, t), getServiceCategoryLabel(request.category, t), request.notes, request.propertyName, request.supplierName]
            .filter(Boolean)
            .join(' '),
      },
      primaryAction: (request) => ({ id: 'open', label: t('longRentRequests.list.open'), href: longRentRequestPath(request.id) }),
      rowHref: (request) => longRentRequestPath(request.id),
      // What waits for the landlord is marked at the start of its row; what is over is quieter.
      rowTone: (request) => (waitsForLandlord(hostPhaseOf(request)) ? 'urgent' : isClosedRequest(request.status) ? 'done' : undefined),
      card: (request): ListCardContent => {
        const when = whenText(request, language, t);
        const price = priceText(request, language);
        return {
          title: requestTitle(request, t),
          sub: subLine(request) || undefined,
          status: <StatusBadge kind="request" status={request.status} />,
          meta: [
            { icon: CalendarDays, label: t('longRentRequests.list.columns.when'), text: [when.day, when.time].filter(Boolean).join(' · ') || t('longRentRequests.list.noTime') },
            { icon: UserRound, label: t('longRentRequests.list.columns.supplier'), text: request.supplierName || '—' },
            { icon: Euro, label: t('longRentRequests.list.columns.price'), text: price ?? t('longRentRequests.list.priceTbd') },
          ],
        };
      },
      // With the sidebar open (from `lg`) a table of five columns and a button is not seen whole under 1280 px: cards until then.
      cardsUntil: 'xl',
      csv: false,
      countLabel: (count) => t('longRentRequests.list.count', { count }),
      empty: {
        icon: Wrench,
        ...emptyOf,
        action: tab !== 'closed' && canRequest ? { label: t('longRentRequests.list.request'), onClick: onRequest } : undefined,
      },
      noResults: { title: t('longRentRequests.list.noResults.title'), description: t('longRentRequests.list.noResults.description') },
    });
  }, [t, language, tab, canRequest, onRequest]);
}
