import { useMemo } from 'react';
import { CalendarDays, CreditCard, Eye, Undo2, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListMenuEntry, ListOption } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { statusLabel } from '@/components/shared/status/status-view';
import { BOOKINGS_PATH } from '@/features/bookings/lib/booking-list-query';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { cn, formatCurrency } from '@/lib/utils';
import type { PaymentListItem } from '@/types';
import { dayInRange, isCollected, isGivenBack, isWaiting, monthRange, paymentPath, previousMonthRange, settledDay, settledTime } from './lib/payment-list';

interface PaymentsListOptions {
  /** Who may enter a booking is offered to start one when there is no payment yet. */
  canCreateBooking: boolean;
}

/**
 * The list of the payments (SR-04c): the unified list in `client` mode, in the words of the host. The API gives all the payments
 * at once (`GET /api/payments`, SR-03: the guest, the property and the code of the booking, the amounts, the status and the method
 * by name) and the list does the searching, the quick filters, the filters and the order itself.
 *
 * Five columns: who and for what (the guest, the booking, the property), when, the method, the state and the amount. The property,
 * the code of the booking and what was given back are there for who asks for them (and for the CSV). The day is the one the
 * payment counts on: when the money came in, else when it was recorded (`ProcessedAt ?? CreatedAt`, in Rome).
 *
 * What the list does not have, it does not make up: the payments to the suppliers, the balances still to be collected and the
 * refunds as lines of their own need data the API does not give yet.
 */
export function usePaymentsList({ canCreateBooking }: PaymentsListOptions) {
  const { t, i18n } = useTranslation();

  return useMemo(() => {
    const language = i18n.language;
    const today = todayInRome();
    const thisYear = today.slice(0, 4);
    const collator = new Intl.Collator(language, { sensitivity: 'base' });

    const day = (value: string) =>
      formatStayDate(value, language, value.startsWith(thisYear) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
    const guest = (payment: PaymentListItem) => payment.guestName || t('compliance.checkout.guestFallback');
    const what = (payment: PaymentListItem) =>
      [payment.bookingCode ? t('payment.list.forBooking', { code: payment.bookingCode }) : '', payment.propertyName].filter(Boolean).join(' · ');
    // A method the app does not know yet (the backend is newer) is shown as it came, not as a key.
    const methodName = (method: string) => (i18n.exists(`payment.method.${method}`) ? t(`payment.method.${method}`) : method);
    const method = (payment: PaymentListItem) => methodName(payment.method);
    const state = (payment: PaymentListItem) => statusLabel('payment', payment.status, 'host', t, i18n);
    const money = (value: number, payment: PaymentListItem) => formatCurrency(value, payment.currency);
    const given = (payment: PaymentListItem) => t('payment.list.refundedAmount', { amount: money(payment.refundedAmount, payment) });

    const propertyOptions = (rows: readonly PaymentListItem[]): ListOption[] => {
      const names = new Map<string, string>();
      for (const row of rows) if (row.propertyId && !names.has(row.propertyId)) names.set(row.propertyId, row.propertyName || row.propertyId);
      return [...names].map(([value, label]) => ({ value, label })).sort((a, b) => collator.compare(a.label, b.label));
    };
    const methodOptions = (rows: readonly PaymentListItem[]): ListOption[] =>
      [...new Set(rows.map((row) => row.method))].map((value) => ({ value, label: methodName(value) })).sort((a, b) => collator.compare(a.label, b.label));

    const amountCell = (payment: PaymentListItem) => (
      <div className="min-w-0">
        {/* What has not arrived yet is quieter: the badge says why, so the amount does not have to. */}
        <span className={cn('whitespace-nowrap font-medium tabular-nums', isWaiting(payment) && 'text-foreground/70')}>{money(payment.amount, payment)}</span>
        {payment.refundedAmount > 0 ? <span className="block whitespace-nowrap text-sm tabular-nums text-foreground/70">{given(payment)}</span> : null}
      </div>
    );

    return defineList<PaymentListItem>({
      key: 'payments',
      title: t('payment.list.title'),
      rowKey: (payment) => payment.id,
      rowLabel: guest,
      columns: [
        {
          id: 'who',
          label: t('payment.list.columns.who'),
          default: true,
          always: true,
          rowHeader: true,
          sort: guest,
          render: (payment, cell) => (
            <div className="min-w-0">
              {cell.open(<span>{guest(payment)}</span>)}
              <span className="mt-0.5 block break-words text-sm text-foreground/70">{what(payment)}</span>
            </div>
          ),
          csv: (payment) => [guest(payment), what(payment)].filter(Boolean).join(' · '),
        },
        {
          id: 'when',
          label: t('payment.list.columns.when'),
          default: true,
          sort: settledTime,
          render: (payment) => <span className="whitespace-nowrap">{day(settledDay(payment))}</span>,
          csv: settledDay,
        },
        { id: 'method', label: t('payment.list.columns.method'), default: true, sort: method, render: method },
        {
          id: 'status',
          label: t('payment.list.columns.status'),
          default: true,
          sort: state,
          render: (payment) => <StatusBadge kind="payment" status={payment.status} />,
          csv: state,
        },
        {
          id: 'amount',
          label: t('payment.list.columns.amount'),
          default: true,
          align: 'end',
          sort: (payment) => payment.amountCents,
          render: amountCell,
          csv: (payment) => payment.amount,
        },
        { id: 'property', label: t('payment.list.columns.property'), sort: (payment) => payment.propertyName, render: (payment) => payment.propertyName || '—' },
        { id: 'code', label: t('payment.list.columns.code'), render: (payment) => <code className="text-sm">{payment.bookingCode}</code>, csv: (payment) => payment.bookingCode },
        {
          id: 'refunded',
          label: t('payment.list.columns.refunded'),
          align: 'end',
          sort: (payment) => payment.refundedAmountCents,
          render: (payment) => (payment.refundedAmount > 0 ? money(payment.refundedAmount, payment) : '—'),
          csv: (payment) => payment.refundedAmount,
        },
      ],
      defaultSort: 'when:desc',

      search: {
        label: t('payment.list.searchLabel'),
        placeholder: t('payment.list.searchPlaceholder'),
        text: (payment) => [guest(payment), payment.bookingCode, payment.propertyName, method(payment), state(payment), payment.description].filter(Boolean).join(' '),
      },
      // A payment in part given back is in two of them: it came in, and a part went back.
      chips: [
        { id: 'all', label: t('payment.list.chips.all') },
        { id: 'toCollect', label: t('payment.list.chips.toCollect'), hint: t('payment.list.chips.toCollectHint'), test: isWaiting },
        { id: 'collected', label: t('payment.list.chips.collected'), hint: t('payment.list.chips.collectedHint'), test: isCollected },
        { id: 'refunded', label: t('payment.list.chips.refunded'), hint: t('payment.list.chips.refundedHint'), test: isGivenBack },
      ],
      defaultChip: 'all',
      filters: [
        {
          id: 'property',
          type: 'select',
          label: t('payment.list.filters.property'),
          allLabel: t('payment.list.filters.allProperties'),
          options: propertyOptions,
          test: (payment, value) => payment.propertyId === value,
        },
        {
          id: 'method',
          type: 'select',
          label: t('payment.list.filters.method'),
          allLabel: t('payment.list.filters.allMethods'),
          options: methodOptions,
          test: (payment, value) => payment.method === value,
        },
        { id: 'date', type: 'date', label: t('payment.list.filters.date'), test: (payment, range) => dayInRange(settledDay(payment), range) },
      ],
      // A view keeps dates as they are: "this month" is worked out when the list is defined.
      views: [
        { id: 'thisMonth', label: t('payment.list.views.thisMonth'), state: { chip: 'all', filters: { date: monthRange(today) } } },
        { id: 'lastMonth', label: t('payment.list.views.lastMonth'), state: { chip: 'all', filters: { date: previousMonthRange(today) } } },
      ],

      menu: (payment) => {
        const entries: ListMenuEntry[] = [{ id: 'details', label: t('payment.list.actions.details'), icon: Eye, href: paymentPath(payment) }];
        if (payment.bookingId) entries.push({ id: 'booking', label: t('payment.list.actions.booking'), icon: CalendarDays, href: `${BOOKINGS_PATH}/${payment.bookingId}` });
        return entries;
      },

      // The amount and the state go together, top right: the card stays low.
      card: (payment) => ({
        title: guest(payment),
        sub: what(payment),
        status: (
          <div className="flex flex-col items-end gap-1 text-right">
            <span className={cn('whitespace-nowrap text-base font-semibold tabular-nums', isWaiting(payment) && 'text-foreground/70')}>{money(payment.amount, payment)}</span>
            <StatusBadge kind="payment" status={payment.status} />
          </div>
        ),
        meta: [
          { icon: CalendarDays, text: day(settledDay(payment)), label: t('payment.list.columns.when') },
          { icon: CreditCard, text: method(payment), label: t('payment.list.columns.method') },
          ...(payment.refundedAmount > 0 ? [{ icon: Undo2, text: given(payment), label: t('payment.list.columns.refunded') }] : []),
        ],
      }),

      rowHref: paymentPath,
      rowTone: (payment) => (payment.status === 'Refunded' || payment.status === 'Canceled' ? 'done' : undefined),
      // With the sidebar open (from `lg`) five columns and the menu do not fit under 1280 px: cards until then.
      cardsUntil: 'xl',
      csv: { fileName: 'pagamenti' },

      empty: {
        icon: Wallet,
        title: t('payment.list.emptyTitle'),
        description: t('payment.list.emptyDescription'),
        action: canCreateBooking ? { label: t('booking.list.newBooking'), href: `${BOOKINGS_PATH}/create` } : undefined,
      },
      noResults: { title: t('payment.list.noResultsTitle'), description: t('payment.list.noResultsDescription') },
      countLabel: (count) => t('payment.list.count', { count }),
    });
  }, [t, i18n, canCreateBooking]);
}
