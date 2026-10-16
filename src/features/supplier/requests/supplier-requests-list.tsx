import { useMemo } from 'react';
import { Check, CheckCircle2, Inbox, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import { parseDateRange, type ListState } from '@/components/shared/list-view/list-state';
import type { ListRowAction } from '@/components/shared/list-view/list-types';
import type { SupplierServiceRequest } from '@/types/service-request';
import type { SupplierInboxParams, SupplierInboxTab, SupplierInboxWhen } from '@/types/supplier';
import { PriceCell, RequestWho, WhenCell, WhereCell } from './request-cells';
import { actionsOf, phaseOf, REQUEST_DRAWER_KIND, requestPath, requestTitle } from './request-model';
import { RequestStateBadge } from './request-parts';
import type { RequestActions } from './use-request-actions';

/** The quick filters of the list, by id in the address (`?chip=programmate`): the first is everything, the second is where the list starts. */
const CHIP_ALL = 'tutte';
const CHIP_TO_ANSWER: SupplierInboxTab = 'da-rispondere';
const MAX_SEARCH_LENGTH = 60;

/**
 * What the server is asked for a state of the list: a chip is a tab of the server (`tab=programmate`, with its own order) and
 * "Tutte" is every status. The search needs two letters to be asked (the server refuses one) and at most sixty are sent.
 */
export function inboxParamsOf(state: ListState, pageSize: number): SupplierInboxParams {
  const query = state.q.trim();
  const period = state.filters.period ? parseDateRange(state.filters.period) : {};
  const when = state.filters.when as SupplierInboxWhen | undefined;
  return {
    ...(state.chip === CHIP_ALL ? { status: 'all' as const } : { tab: state.chip as SupplierInboxTab }),
    ...(query.length >= 2 ? { q: query.slice(0, MAX_SEARCH_LENGTH) } : {}),
    ...(when ? { when } : {}),
    ...(period.from ? { from: period.from } : {}),
    ...(period.to ? { to: period.to } : {}),
    page: state.page,
    pageSize,
  };
}

/**
 * The list of the requests of the supplier (UI-14, `server` mode): the server picks the requests of a tab, searches and pages them,
 * so the list has no column to sort by. The one thing to do about a row is by phase (accept a new one, complete a taken one) and the
 * rest is in "⋯"; the row itself opens the drawer (UI-15), whose page is one link away. The names of the actions keep the
 * `data-testid`s of the old inbox (`take-<id>`, `complete-<id>`, `reject-<id>`, `open-<id>`).
 */
export function useSupplierRequestsList(actions: RequestActions) {
  const { t } = useTranslation();
  const { suspended, busy, take, complete, askReject } = actions;

  return useMemo(() => {
    const primaryAction = (request: SupplierServiceRequest): ListRowAction | null => {
      const { primary } = actionsOf(phaseOf(request));
      if (primary === 'take') {
        return { id: 'take', label: t('supplier.requests.action.take'), icon: Check, onSelect: () => take(request.id), disabled: suspended || busy, testId: `take-${request.id}` };
      }
      if (primary === 'complete') {
        return { id: 'complete', label: t('supplier.requests.action.completeShort'), icon: CheckCircle2, onSelect: () => complete(request.id), disabled: suspended || busy, testId: `complete-${request.id}` };
      }
      return null;
    };

    return defineList<SupplierServiceRequest>({
      key: 'supplier-requests',
      title: t('supplier.requests.title'),
      rowKey: (request) => request.id,
      rowLabel: (request) => requestTitle(request, t),
      columns: [
        {
          id: 'request',
          label: t('supplier.requests.list.columns.request'),
          always: true,
          rowHeader: true,
          priority: 1,
          // `cell.open` is called here and not in a component: the list looks, as the cell is built, whether the cell drew the link.
          render: (request, cell) => (
            <>
              {cell.open(requestTitle(request, t))}
              <RequestWho request={request} />
            </>
          ),
        },
        { id: 'when', label: t('supplier.requests.list.columns.when'), default: true, priority: 2, render: (request) => <WhenCell request={request} /> },
        { id: 'where', label: t('supplier.requests.list.columns.where'), default: true, priority: 3, render: (request) => <WhereCell request={request} /> },
        { id: 'state', label: t('supplier.requests.list.columns.state'), default: true, cardStatus: true, render: (request) => <RequestStateBadge request={request} /> },
        { id: 'price', label: t('supplier.requests.list.columns.price'), default: true, align: 'end', priority: 4, render: (request) => <PriceCell request={request} /> },
      ],
      search: { label: t('supplier.requests.list.search'), placeholder: t('supplier.requests.list.searchPlaceholder') },
      chips: [
        { id: CHIP_ALL, label: t('supplier.requests.chips.all') },
        { id: CHIP_TO_ANSWER, label: t('supplier.requests.chips.toAnswer'), hint: t('supplier.requests.chips.toAnswerHint'), urgent: true },
        { id: 'in-attesa', label: t('supplier.requests.chips.awaiting'), hint: t('supplier.requests.chips.awaitingHint') },
        { id: 'programmate', label: t('supplier.requests.chips.scheduled'), hint: t('supplier.requests.chips.scheduledHint') },
        { id: 'da-incassare', label: t('supplier.requests.chips.toCollect'), hint: t('supplier.requests.chips.toCollectHint') },
        { id: 'archivio', label: t('supplier.requests.chips.archive'), hint: t('supplier.requests.chips.archiveHint') },
      ],
      defaultChip: CHIP_TO_ANSWER,
      filters: [
        {
          id: 'when',
          label: t('supplier.requests.filters.when'),
          type: 'select',
          allLabel: t('supplier.requests.filters.whenAll'),
          options: [
            { value: 'oggi', label: t('supplier.requests.filters.today') },
            { value: 'settimana', label: t('supplier.requests.filters.week') },
            { value: 'mese', label: t('supplier.requests.filters.month') },
          ],
        },
        { id: 'period', label: t('supplier.requests.filters.period'), type: 'date' },
      ],
      views: [
        { id: 'today', label: t('supplier.requests.views.today'), state: { chip: CHIP_ALL, filters: { when: 'oggi' } } },
        { id: 'week', label: t('supplier.requests.views.week'), state: { chip: 'programmate', filters: { when: 'settimana' } } },
      ],
      primaryAction,
      menu: (request) => [
        { id: 'open-page', label: t('supplier.requests.action.openPage'), href: requestPath(request.id), testId: `open-${request.id}` },
        ...(actionsOf(phaseOf(request)).secondary === 'reject'
          ? [
              'separator' as const,
              { id: 'reject', label: t('supplier.requests.action.reject'), icon: XCircle, danger: true, onSelect: () => askReject(request.id), disabled: suspended || busy, testId: `reject-${request.id}` },
            ]
          : []),
      ],
      rowHref: (request) => requestPath(request.id),
      detail: { drawerKind: REQUEST_DRAWER_KIND },
      rowTone: (request) => {
        const phase = phaseOf(request);
        if (phase === 'toAnswer') return 'urgent';
        return phase === 'paid' || phase === 'rejected' || phase === 'cancelled' ? 'done' : undefined;
      },
      csv: false,
      // With the sidebar open (from `lg`) five columns and an action do not fit under 1280 px: cards until then.
      cardsUntil: 'xl',
      empty: {
        icon: Inbox,
        title: t('supplier.requests.empty.title'),
        description: t('supplier.requests.empty.description'),
        action: { label: t('supplier.requests.empty.availability'), href: '/app/supplier/availability' },
        secondaryAction: { label: t('supplier.requests.empty.services'), href: '/app/supplier/services/new' },
      },
      noResults: { title: t('supplier.requests.noResults.title'), description: t('supplier.requests.noResults.description') },
      countLabel: (count) => t('supplier.requests.list.count', { count }),
    });
  }, [t, suspended, busy, take, complete, askReject]);
}
