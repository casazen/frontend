import { useMemo, type ReactNode } from 'react';
import { CalendarDays, Euro, Send, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListDefinition, ListMenuEntry } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { rentStatus, statusTextKey } from '@/lib/status-dictionary';
import { todayInRome } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { RentRegisterRow } from '@/types';
import { leaseTenantName } from './lib/lease-list-format';
import {
  isOpenInstallment,
  lastReminderText,
  paymentKey,
  reminderKey,
  rentLeasePath,
  rentPeriodText,
  rentStatusNote,
  shortDay,
} from './lib/rent-register';

/** What a row of the register can ask of the page: the actions that wait for their six seconds, and what each button does. */
export interface RentsListOptions {
  /** May declare a payment and send a reminder (`lease.create`); who may only read the register sees no button. */
  canManage: boolean;
  /** The actions held back for «Annulla» (`reminder:<id>`, `payment:<id>`): the same one is not started twice. */
  held: ReadonlySet<string>;
  onRecord: (row: RentRegisterRow) => void;
  onRemind: (row: RentRegisterRow) => void;
}

/** The line under the state, with what is late in the one color of the row. */
function statusNoteLine(row: RentRegisterRow, t: TFunction, language: string, today: string): ReactNode {
  const note = rentStatusNote(row, t, language, today);
  if (!note) return null;
  return (
    <span className={note.late ? 'mt-0.5 block break-words text-sm font-medium text-danger-foreground' : 'mt-0.5 block break-words text-sm text-foreground/70'}>
      {note.text}
    </span>
  );
}

/**
 * The register of the rents of the month (LR-04b) on the unified list (UI-14), in `server` mode: the quick filters are the states
 * the server counts (`?chip=overdue` asks `GET /long-rent/rents?status=Overdue`) and the page is the server's (`?page=2`); the list
 * shows the rows in the order the API gives them, by due date, and has no search or order of its own.
 *
 * The one thing to do about an installment still to collect is to declare it paid; a reminder is the second one, in the menu of the
 * row, and is offered only when the server says it can go (`canRemind`). Neither starts by itself: both open a window, and the reminder
 * leaves six seconds after the landlord confirms it.
 */
export function buildRentsList(t: TFunction, language: string, options: RentsListOptions): ListDefinition<RentRegisterRow> {
  const today = todayInRome();
  const { canManage, held, onRecord, onRemind } = options;
  const tenantOf = (row: RentRegisterRow) => leaseTenantName(row, t);
  const amountOf = (row: RentRegisterRow) => formatCurrency(row.amount, row.currency);
  const stateOf = (row: RentRegisterRow) => t(statusTextKey('rent', rentStatus(row), 'label'));
  const noteOf = (row: RentRegisterRow) => rentStatusNote(row, t, language, today);

  return defineList<RentRegisterRow>({
    key: 'long-rent-rents',
    title: t('nav.rents'),
    rowKey: (row) => row.id,
    rowLabel: (row) => `${tenantOf(row)} · ${row.propertyName}`,
    columns: [
      {
        id: 'tenant',
        label: t('longRentRents.columns.tenant'),
        default: true,
        always: true,
        rowHeader: true,
        render: (row, cell) => (
          <span className="block min-w-0">
            {cell.open(tenantOf(row))}
            <span className="mt-0.5 block break-words text-sm text-foreground/70">{row.propertyName}</span>
          </span>
        ),
        csv: (row) => `${tenantOf(row)} · ${row.propertyName}`,
      },
      {
        id: 'due',
        label: t('longRentRents.columns.due'),
        default: true,
        render: (row) => (
          <span className="block">
            <span className="block whitespace-nowrap font-medium">{shortDay(row.dueDate, language)}</span>
            <span className="mt-0.5 block break-words text-sm text-foreground/70">{rentPeriodText(row, t, language)}</span>
          </span>
        ),
        csv: (row) => row.dueDate,
      },
      {
        id: 'amount',
        label: t('longRentRents.columns.amount'),
        default: true,
        align: 'end',
        render: (row) => <span className="whitespace-nowrap font-medium">{amountOf(row)}</span>,
        csv: (row) => row.amount,
      },
      {
        id: 'status',
        label: t('longRentRents.columns.status'),
        default: true,
        render: (row) => (
          <span className="flex flex-col items-start">
            <StatusBadge kind="rent" status={rentStatus(row)} />
            {statusNoteLine(row, t, language, today)}
          </span>
        ),
        csv: (row) => [stateOf(row), noteOf(row)?.text].filter(Boolean).join(' · '),
      },
      {
        id: 'reminder',
        label: t('longRentRents.columns.reminder'),
        render: (row) => lastReminderText(row, t, language, today) ?? '—',
        csv: (row) => lastReminderText(row, t, language, today) ?? '',
      },
    ],
    chips: [
      { id: 'all', label: t('longRentRents.chips.all') },
      { id: 'overdue', label: t('longRentRents.chips.overdue'), hint: t('longRentRents.chips.overdueHint'), urgent: true },
      { id: 'pending', label: t('longRentRents.chips.pending'), hint: t('longRentRents.chips.pendingHint') },
      { id: 'paid', label: t('longRentRents.chips.paid'), hint: t('longRentRents.chips.paidHint') },
    ],
    defaultChip: 'all',
    rowHref: (row) => rentLeasePath(row.leaseId),
    // Declaring a payment is what the landlord does here; a row that cannot take one (paid, in flight on Stripe, or a read-only role) leads to its lease.
    primaryAction: (row) =>
      canManage && isOpenInstallment(row.status)
        ? {
            id: 'record',
            label: t('longRentRents.actions.record'),
            icon: Euro,
            onSelect: () => onRecord(row),
            disabled: held.has(paymentKey(row.id)),
            testId: `rent-record-${row.id}`,
          }
        : { id: 'lease', label: t('longRentRents.actions.openLease'), href: rentLeasePath(row.leaseId) },
    menu: (row): readonly ListMenuEntry[] => {
      const entries: ListMenuEntry[] = [];
      if (canManage && row.canRemind) {
        const waiting = held.has(reminderKey(row.id));
        entries.push({
          id: 'remind',
          label: waiting ? t('longRentRents.actions.reminding') : t('longRentRents.actions.remind'),
          icon: Send,
          onSelect: () => onRemind(row),
          disabled: waiting,
          testId: `rent-remind-${row.id}`,
        });
      }
      // The lease is the primary action of the rows that cannot be declared paid; for the others it is here.
      if (canManage && isOpenInstallment(row.status)) {
        entries.push({ id: 'lease', label: t('longRentRents.actions.openLease'), href: rentLeasePath(row.leaseId) });
      }
      return entries;
    },
    rowTone: (row) => (row.isOverdue && isOpenInstallment(row.status) ? 'urgent' : row.status === 'Paid' ? 'done' : undefined),
    card: (row) => {
      const note = noteOf(row);
      return {
        title: tenantOf(row),
        sub: row.propertyName,
        status: <StatusBadge kind="rent" status={rentStatus(row)} />,
        meta: [
          { icon: CalendarDays, label: t('longRentRents.columns.due'), text: shortDay(row.dueDate, language) },
          { icon: Wallet, label: t('longRentRents.columns.amount'), text: amountOf(row) },
        ],
        foot: note ? (
          <p className={note.late ? 'break-words text-sm font-medium text-danger-foreground' : 'break-words text-sm text-foreground/70'}>
            {note.text}
          </p>
        ) : undefined,
      };
    },
    // With the sidebar open (from `lg`) five columns and a button do not fit under 1280 px: cards until then.
    cardsUntil: 'xl',
    csv: { fileName: 'canoni' },
    countLabel: (count) => t('longRentRents.count', { count }),
    empty: {
      icon: Euro,
      title: t('longRentRents.empty.title'),
      description: t('longRentRents.empty.description'),
    },
    noResults: { title: t('longRentRents.noResults.title'), description: t('longRentRents.noResults.description') },
  });
}

/** The register in the words of the person; it follows the language and the actions that wait. */
export function useRentsList(options: RentsListOptions): ListDefinition<RentRegisterRow> {
  const { t, i18n } = useTranslation();
  const { canManage, held, onRecord, onRemind } = options;
  return useMemo(
    () => buildRentsList(t, i18n.language, { canManage, held, onRecord, onRemind }),
    [t, i18n.language, canManage, held, onRecord, onRemind],
  );
}
