import { AlertCircle, ArrowDown, CalendarDays, CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatStayDate } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { RentInstallment } from '@/types';
import { installmentAnchor, rentBreakdown } from '../lib/rent-breakdown';

export function RentFocus({ installments }: { installments: RentInstallment[] }) {
  const { t, i18n } = useTranslation();
  if (!installments.length) return null;

  // Keep the ledger in server order. Choose the oldest exception before the next outstanding due date.
  const byDueDate = [...installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const open = byDueDate.filter((row) => row.status === 'Scheduled' || row.status === 'Failed');
  const attention = open.filter((row) => row.isOverdue || row.status === 'Failed');
  const processing = byDueDate.filter((row) => row.status === 'Processing');
  const row = attention[0] ?? open[0] ?? processing[0];
  const Icon = attention.length ? AlertCircle : row ? CalendarDays : CircleCheck;
  const heading = attention.length ? t('rent.focus.attention', { count: attention.length })
    : row?.status === 'Processing' ? t('rent.focus.processing') : row ? t('rent.focus.next') : t('rent.focus.closed');

  return (
    <section aria-label={heading} data-testid="rent-focus" className="min-w-0 space-y-3 rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
      <h3 className="flex items-start gap-2 text-base font-semibold">
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary-text" />{heading}
      </h3>
      {row && (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t('rent.composition.residual')}</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(rentBreakdown(row).residual, row.currency, i18n.language)}</p>
            <p className="break-words text-sm text-muted-foreground">
              {t('rent.focus.due', { date: formatStayDate(row.dueDate, i18n.language) })}
              {' · '}{t(`rent.status.${row.status}`)}
              {row.isOverdue ? ` · ${t('rent.overdue')}` : ''}
            </p>
          </div>
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold text-primary-text underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
            href={`#${encodeURIComponent(installmentAnchor(row.id))}`}
            data-testid="rent-focus-link"
          >
            {t('rent.focus.open')}<ArrowDown aria-hidden="true" className="size-4" />
          </a>
        </div>
      )}
    </section>
  );
}
