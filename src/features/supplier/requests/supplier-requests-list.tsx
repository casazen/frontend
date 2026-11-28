import { useMemo } from 'react';
import { BellRing, Check, CheckCircle2, ExternalLink, FileText, Inbox, MapPin, MessageSquare, Pencil, Phone, Undo2, Wallet, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import { parseDateRange, type ListState } from '@/components/shared/list-view/list-state';
import type { ListMenuEntry, ListOption, ListRowAction, ListSwipeAction } from '@/components/shared/list-view/list-types';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import type { SupplierServiceRequest } from '@/types/service-request';
import type { SupplierInboxCounts, SupplierInboxParams, SupplierInboxSource, SupplierInboxTab, SupplierInboxWhen } from '@/types/supplier';
import { isInquiry } from '../inquiry/inquiry-model';
import { PriceCell, RequestWho, WhenCell, WhereCell } from './request-cells';
import { isBackup, mapHref, phaseOf, REQUEST_DRAWER_KIND, requestPath, requestTitle, requestWhen, telHref } from './request-model';
import { RequestStateBadge } from './request-parts';
import { requestStateText } from './request-state';
import type { RequestActions } from './use-request-actions';

export const CHIP_ALL = 'tutte';
const CHIP_TO_ANSWER: SupplierInboxTab = 'da-rispondere';
const MAX_SEARCH_LENGTH = 60;

/**
 * Where the list opens when the address names no tab: on the requests to answer if there are any, else on the first tab that has something
 * (the jobs, what waits for the customer, what is left to collect, the archive), so that it never opens on an empty tab while the supplier
 * has work elsewhere. With nothing anywhere, or the numbers not yet known, on the requests to answer.
 */
export function startChipOf(counts: SupplierInboxCounts | undefined): SupplierInboxTab {
  if (!counts) return CHIP_TO_ANSWER;
  const tabs: [SupplierInboxTab, number][] = [
    [CHIP_TO_ANSWER, counts.toAnswer],
    ['programmate', counts.scheduled],
    ['in-attesa', counts.awaitingCustomer],
    ['da-incassare', counts.toCollect],
    ['archivio', counts.archive],
  ];
  return tabs.find(([, count]) => count > 0)?.[0] ?? CHIP_TO_ANSWER;
}

export function inboxParamsOf(state: ListState, pageSize: number, clientId?: string): SupplierInboxParams {
  const query = state.q.trim();
  const period = state.filters.period ? parseDateRange(state.filters.period) : {};
  const when = state.filters.when as SupplierInboxWhen | undefined;
  const { service, comune } = state.filters;
  const source = state.filters.source as SupplierInboxSource | undefined;
  return {
    ...(state.chip === CHIP_ALL ? { status: 'all' as const } : { tab: state.chip as SupplierInboxTab }),
    ...(query.length >= 2 ? { q: query.slice(0, MAX_SEARCH_LENGTH) } : {}),
    ...(service ? { service } : {}),
    ...(comune ? { comune } : {}),
    ...(source ? { source } : {}),
    ...(when ? { when } : {}),
    ...(period.from ? { from: period.from } : {}),
    ...(period.to ? { to: period.to } : {}),
    ...(clientId ? { clientId } : {}),
    page: state.page,
    pageSize,
  };
}

export interface RequestsListOptions {
  startChip: SupplierInboxTab;
  services: readonly ListOption[];
  comuni: readonly ListOption[];
}

/**
 * The list of the requests of the supplier (UI-14, `server` mode): the server picks the requests of a tab, searches and pages them,
 * so the list has no column to sort by. The one thing to do about a row is by phase (accept a new one, complete a taken one, remind the
 * payer of a finished one) and the rest is in "⋯"; the row itself opens the drawer (UI-15), whose page is one link away. The names of the
 * actions keep the `data-testid`s of the old inbox (`take-<id>`, `complete-<id>`, `reject-<id>`, `open-<id>`). A request the supplier has as
 * a backup (SP-BKP) says «Accetta come riserva» (`accept-backup-<id>`) while the primary supplier has its hour, and the usual «Accetta» when
 * the job is free; a backup that said yes has nothing to do but wait.
 *
 * On a phone a card is pulled to the left for its one action and to the right for the request itself, and both are in the menu of the card
 * and on it as a button: the gesture is never the only way. What the design asks of a row and the console cannot do yet ("Avvia", "Proponi un
 * altro orario": SP-08c-b/c) is not made up: the page of the request is one tap away.
 */
export function useSupplierRequestsList(actions: RequestActions, options: RequestsListOptions) {
  const { t, i18n } = useTranslation();
  const { flags } = useFeatureFlags();
  const onlinePayments = isFeatureEnabled(flags, 'supplierOnlinePayments');
  const { suspended, busy, take, acceptBackup, complete, askReject, askQuote, askWithdrawQuote, remindPayment, askRecordPayment } = actions;
  const { startChip, services, comuni } = options;

  return useMemo(() => {
    const locale = i18n.language;
    const primaryAction = (request: SupplierServiceRequest): ListRowAction | null => {
      const phase = phaseOf(request);
      if (isInquiry(request)) {
        return phase === 'toAnswer'
          ? { id: 'answer', label: t('supplier.inquiry.action.answer'), icon: MessageSquare, href: requestPath(request.id), testId: `answer-${request.id}` }
          : null;
      }
      if (phase === 'toAnswer' || phase === 'backupActive') {
        return { id: 'take', label: t('supplier.requests.action.take'), icon: Check, onSelect: () => take(request.id), disabled: suspended || busy, testId: `take-${request.id}` };
      }
      if (phase === 'backupWaiting') {
        return {
          id: 'accept-backup',
          label: t('supplier.requests.action.acceptBackup'),
          icon: Check,
          onSelect: () => acceptBackup(request.id),
          disabled: suspended || busy,
          testId: `accept-backup-${request.id}`,
        };
      }
      if (phase === 'scheduled' || phase === 'inProgress') {
        return { id: 'complete', label: t('supplier.requests.action.completeShort'), icon: CheckCircle2, onSelect: () => complete(request.id), disabled: suspended || busy, testId: `complete-${request.id}` };
      }
      if (phase === 'completed' && onlinePayments && request.payment?.canRequest) {
        return { id: 'remind-payment', label: t('supplier.requests.action.remindPayment'), icon: BellRing, onSelect: () => remindPayment(request.id), disabled: suspended || busy, testId: `remind-payment-${request.id}` };
      }
      return null;
    };

    const toSwipe = (action: ListRowAction | null, tone: ListSwipeAction['tone']): ListSwipeAction | null =>
      action && !action.disabled ? { id: action.id, label: action.label, icon: action.icon, tone, href: action.href, onSelect: action.onSelect } : null;

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
          render: (request, cell) => (
            <>
              {cell.open(requestTitle(request, t))}
              <RequestWho request={request} />
            </>
          ),
          csv: (request) => [requestTitle(request, t), request.clientName, request.propertyName].filter(Boolean).join(' · '),
        },
        {
          id: 'when',
          label: t('supplier.requests.list.columns.when'),
          default: true,
          priority: 2,
          render: (request) => <WhenCell request={request} />,
          csv: (request) => {
            const when = requestWhen(request, locale);
            return [when.day, when.time].filter(Boolean).join(' ');
          },
        },
        {
          id: 'where',
          label: t('supplier.requests.list.columns.where'),
          default: true,
          priority: 3,
          render: (request) => <WhereCell request={request} />,
          csv: (request) => (request.postalCode ? `${request.city} (${request.postalCode})` : request.city),
        },
        {
          id: 'state',
          label: t('supplier.requests.list.columns.state'),
          default: true,
          cardStatus: true,
          render: (request) => <RequestStateBadge request={request} />,
          csv: (request) => requestStateText(request, t, i18n),
        },
        {
          id: 'price',
          label: t('supplier.requests.list.columns.price'),
          default: true,
          align: 'end',
          priority: 4,
          render: (request) => <PriceCell request={request} />,
          csv: (request) => {
            const cents = phaseOf(request) === 'quotePending' && request.quote ? request.quote.totalCents : request.price?.amountCents;
            return cents === null || cents === undefined ? '' : cents / 100;
          },
        },
        {
          id: 'source',
          label: t('supplier.requests.list.columns.source'),
          render: (request) => (request.source === 'showcase' ? t('supplier.requests.facts.fromShowcase') : t('supplier.requests.facts.fromHost')),
        },
      ],
      search: { label: t('supplier.requests.list.search'), placeholder: t('supplier.requests.list.searchPlaceholder') },
      chips: [
        { id: CHIP_TO_ANSWER, label: t('supplier.requests.chips.toAnswer'), hint: t('supplier.requests.chips.toAnswerHint'), urgent: true },
        { id: 'in-attesa', label: t('supplier.requests.chips.awaiting'), hint: t('supplier.requests.chips.awaitingHint'), counted: true },
        { id: 'programmate', label: t('supplier.requests.chips.scheduled'), hint: t('supplier.requests.chips.scheduledHint'), counted: true },
        { id: 'da-incassare', label: t('supplier.requests.chips.toCollect'), hint: t('supplier.requests.chips.toCollectHint'), counted: true },
        { id: 'archivio', label: t('supplier.requests.chips.archive'), hint: t('supplier.requests.chips.archiveHint'), counted: true },
        { id: CHIP_ALL, label: t('supplier.requests.chips.all') },
      ],
      defaultChip: startChip,
      allChip: CHIP_ALL,
      filters: [
        // The choices of these two arrive from other requests: a list of rows is a function, so that an address that names a service the
        // list does not know yet is not dropped before the choices have arrived.
        {
          id: 'service',
          label: t('supplier.requests.filters.service'),
          type: 'select',
          allLabel: t('supplier.requests.filters.serviceAll'),
          options: () => services,
        },
        {
          id: 'comune',
          label: t('supplier.requests.filters.comune'),
          type: 'select',
          allLabel: t('supplier.requests.filters.comuneAll'),
          options: () => comuni,
        },
        {
          id: 'source',
          label: t('supplier.requests.filters.source'),
          type: 'select',
          allLabel: t('supplier.requests.filters.sourceAll'),
          options: [
            { value: 'casazen', label: t('supplier.requests.facts.fromHost') },
            { value: 'showcase', label: t('supplier.requests.facts.fromShowcase') },
          ],
        },
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
      menu: (request) => {
        const phase = phaseOf(request);
        const entries: ListMenuEntry[] = [{ id: 'open-page', label: t('supplier.requests.action.openPage'), icon: ExternalLink, href: requestPath(request.id), testId: `open-${request.id}` }];

        const map = phase === 'scheduled' || phase === 'inProgress' ? mapHref(request) : null;
        if (map) entries.push({ id: 'map', label: t('supplier.requests.action.map'), icon: MapPin, href: map, external: true, testId: `map-${request.id}` });
        const phone = request.contactDisclosed && (phase === 'scheduled' || phase === 'inProgress' || phase === 'completed') ? request.hostContact?.phone?.trim() : undefined;
        if (phone) entries.push({ id: 'call', label: t('supplier.requests.action.call'), icon: Phone, href: telHref(phone), testId: `call-${request.id}` });

        if (phase === 'toAnswer') {
          if (!isInquiry(request)) {
            entries.push(
              { id: 'quote', label: t('supplier.requests.action.quote'), icon: FileText, onSelect: () => askQuote(request), disabled: suspended || busy, testId: `quote-${request.id}` },
              'separator',
            );
          }
          entries.push({ id: 'reject', label: t('supplier.requests.action.reject'), icon: XCircle, danger: true, onSelect: () => askReject(request.id), disabled: suspended || busy, testId: `reject-${request.id}` });
        }
        if (isBackup(request)) {
          entries.push({ id: 'reject', label: t('supplier.requests.action.reject'), icon: XCircle, danger: true, onSelect: () => askReject(request.id), disabled: suspended || busy, testId: `reject-${request.id}` });
        }
        if (phase === 'quotePending' && !isInquiry(request)) {
          entries.push(
            { id: 'edit-quote', label: t('supplier.requests.action.editQuote'), icon: Pencil, onSelect: () => askQuote(request), disabled: suspended || busy, testId: `edit-quote-${request.id}` },
            { id: 'withdraw-quote', label: t('supplier.requests.action.withdrawQuote'), icon: Undo2, onSelect: () => askWithdrawQuote(request.id), disabled: suspended || busy, testId: `withdraw-quote-${request.id}` },
          );
        }
        if (phase === 'completed' && request.payment?.canRecordOffline) {
          entries.push({
            id: 'record-payment',
            label: t('supplier.requests.action.recordPayment'),
            icon: Wallet,
            onSelect: () => askRecordPayment(request),
            disabled: suspended || busy,
            testId: `record-payment-${request.id}`,
          });
        }
        return entries;
      },
      swipe: (request) => {
        const left = toSwipe(primaryAction(request), 'success');
        const right: ListSwipeAction = { id: 'open-page', label: t('supplier.requests.action.details'), icon: ExternalLink, tone: 'neutral', href: requestPath(request.id) };
        return { ...(left ? { left } : {}), right };
      },
      rowHref: (request) => requestPath(request.id),
      detail: { drawerKind: REQUEST_DRAWER_KIND },
      rowTone: (request) => {
        const phase = phaseOf(request);
        if (phase === 'toAnswer' || phase === 'backupActive') return 'urgent';
        return phase === 'paid' || phase === 'rejected' || phase === 'cancelled' ? 'done' : undefined;
      },
      csv: { fileName: 'richieste' },
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
  }, [
    t,
    i18n,
    suspended,
    busy,
    take,
    acceptBackup,
    complete,
    askReject,
    askQuote,
    askWithdrawQuote,
    remindPayment,
    askRecordPayment,
    onlinePayments,
    startChip,
    services,
    comuni,
  ]);
}
