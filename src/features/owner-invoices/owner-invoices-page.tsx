import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AgencyAccessRefused, AgencyFinanceGate } from '@/components/finance/agency-finance-gate';
import { PageHeader } from '@/components/layout/page-header';
import { PlainSection } from '@/components/shared/calm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { SkeletonCard } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useDownloadOwnerInvoicePdf, useOwnerInvoices } from '@/queries/use-owner-invoices';
import { useOwnerNames } from '@/queries/use-owner-accounting';
import type { OwnerInvoiceListItem } from '@/types';
import { OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import { OWNER_CLOSE_PATH, messageOf, parsePeriod, periodParam, shiftPeriod, shortId, statementPath } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { InvoiceSettlement } from './invoice-settlement';
import { isDraft, isIssued } from './owner-invoice-model';
import { hasNoCurrency, useInvoiceMoney } from './use-invoice-money';

/** The months the filter of the period offers, counting back from the current one: older invoices are still in the list, under «Tutti i mesi». */
const MONTHS_OFFERED = 24;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * «Fatture ai proprietari» of the Amministrazione (E13/F02/US01/T03, NF-114): every invoice the agency made out to its owners from their statements, drafts and issued ones, newest month
 * first, with its number, owner, total in its own currency, state and PDF, and the filters of the month and of the owner (kept in the address, so a link says what it shows). It is behind
 * the flag `ownerInvoicing` (off: no page, no entry in the menu), and behind the agency plan and the role of the owner and the administrators, like the other pages of the agency's money.
 */
export function OwnerInvoicesPage() {
  const { t } = useTranslation();
  return (
    <AgencyFinanceGate testId="owner-invoices-page" title={t('ownerInvoice.page.title')} description={t('ownerInvoice.page.description')} loadingLabel={t('ownerInvoice.page.loading')}>
      <OwnerInvoicesBody />
    </AgencyFinanceGate>
  );
}

function OwnerInvoicesBody() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const today = todayInRome();
  const thisMonth = useMemo(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }), [today]);
  // The address is the filter: whatever it says is what the list shows (a month that is not a month, or an owner that is not an id, is no filter).
  const periodValue = parsePeriod(params.get('period'), { year: 0, month: 0 });
  const period = periodValue.year === 0 ? undefined : periodParam(periodValue);
  const ownerParam = params.get('owner') ?? '';
  const ownerId = ID.test(ownerParam) ? ownerParam : undefined;

  const owners = useOwnerNames();
  const invoices = useOwnerInvoices({ period, ownerId });
  const pdf = useDownloadOwnerInvoicePdf();
  const header = <PageHeader title={t('ownerInvoice.page.title')} description={t('ownerInvoice.page.description')} crumbs="auto" />;

  const setFilter = (key: 'period' | 'owner', value: string) => {
    const next = new URLSearchParams(params);
    if (value === '') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  let content;
  if (getHttpStatus(invoices.error) === 404) {
    // A 404 is the module being off at the server, whatever the cache still holds: said, never an empty list.
    content = (
      <p className="break-words text-sm text-foreground/70" data-testid="owner-invoices-unavailable">
        {t('ownerInvoice.page.unavailable')}
      </p>
    );
  } else if (invoices.isPending) {
    content = <SkeletonCard lines={4} label={t('ownerInvoice.page.loading')} />;
  } else if (invoices.isError) {
    content = <OwnerAccountingError error={invoices.error} title={t('ownerInvoice.page.loadError')} onRetry={() => void invoices.refetch()} />;
  } else if (invoices.data === null) {
    content = <AgencyAccessRefused />;
  } else {
    const list = invoices.data;
    content =
      list.length === 0 ? (
        <div className="space-y-3" data-testid="owner-invoices-empty">
          <p className="break-words text-sm text-foreground/70">{period || ownerId ? t('ownerInvoice.page.emptyFiltered') : t('ownerInvoice.page.empty')}</p>
          <Button asChild size="sm" variant="outline">
            <Link to={OWNER_CLOSE_PATH}>{t('ownerInvoice.page.emptyAction')}</Link>
          </Button>
        </div>
      ) : (
        <PlainSection title={t('ownerInvoice.page.listTitle')} count={list.length} data-testid="owner-invoices-list">
          {list.some((invoice) => hasNoCurrency(invoice)) ? (
            <p className="break-words text-sm text-foreground/70" data-testid="owner-invoices-currency-missing">
              {t('ownerInvoice.currencyMissing')}
            </p>
          ) : null}
          <ul role="list" className="divide-y divide-border">
            {list.map((invoice) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                downloading={pdf.isPending && pdf.variables?.invoiceId === invoice.id}
                locked={pdf.isPending}
                onPdf={() =>
                  pdf.mutate(
                    { invoiceId: invoice.id, fileName: `fattura-${(invoice.number ?? invoice.id).replace(/[\\/]/g, '-')}.pdf` },
                    { onError: (error) => toast.error(messageOf(error, t)) },
                  )
                }
              />
            ))}
          </ul>
        </PlainSection>
      );
  }

  return (
    <div className="space-y-6" data-testid="owner-invoices-page">
      {header}
      <FilterBar
        period={period ?? ''}
        ownerId={ownerId ?? ''}
        thisMonth={thisMonth}
        owners={owners.data ?? []}
        onPeriod={(value) => setFilter('period', value)}
        onOwner={(value) => setFilter('owner', value)}
      />
      {content}
    </div>
  );
}

interface FilterBarProps {
  period: string;
  ownerId: string;
  thisMonth: { year: number; month: number };
  owners: readonly { id: string; firstName: string; lastName: string }[];
  onPeriod: (value: string) => void;
  onOwner: (value: string) => void;
}

/** The month and the owner the list is narrowed to; «tutti» is no limit. A month or an owner that the address names and the options do not hold is added to them, so the address wins. */
function FilterBar({ period, ownerId, thisMonth, owners, onPeriod, onOwner }: FilterBarProps) {
  const { t } = useTranslation();
  const { month } = useOwnerFormat();
  const months = useMemo(() => Array.from({ length: MONTHS_OFFERED }, (_, index) => periodParam(shiftPeriod(thisMonth, -index))), [thisMonth]);
  const monthOptions = period !== '' && !months.includes(period) ? [period, ...months] : months;
  const ownerOptions = owners.map((owner) => ({ id: owner.id, label: `${owner.firstName} ${owner.lastName}`.trim() || t('ownerAccounting.owner.unnamed', { id: shortId(owner.id) }) }));
  if (ownerId !== '' && !ownerOptions.some((option) => option.id === ownerId)) ownerOptions.unshift({ id: ownerId, label: t('ownerAccounting.owner.unnamed', { id: shortId(ownerId) }) });

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:max-w-2xl" data-testid="owner-invoices-filters">
      <Field label={t('ownerInvoice.page.filterPeriod')}>
        <Select value={period} onChange={(event) => onPeriod(event.target.value)} data-testid="owner-invoices-filter-period">
          <option value="">{t('ownerInvoice.page.allMonths')}</option>
          {monthOptions.map((value) => {
            const parsed = parsePeriod(value, thisMonth);
            return (
              <option key={value} value={value}>
                {month(parsed.year, parsed.month)}
              </option>
            );
          })}
        </Select>
      </Field>
      <Field label={t('ownerInvoice.page.filterOwner')}>
        <Select value={ownerId} onChange={(event) => onOwner(event.target.value)} data-testid="owner-invoices-filter-owner">
          <option value="">{t('ownerInvoice.page.allOwners')}</option>
          {ownerOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

interface InvoiceRowProps {
  invoice: OwnerInvoiceListItem;
  /** This invoice's PDF is being saved. */
  downloading: boolean;
  /** Some PDF is being saved: the others wait for it. */
  locked: boolean;
  onPdf: () => void;
}

/** One invoice: its number (a draft has none yet), owner and month, the total in its own currency, its state and how it is paid, and the PDF of an issued one. */
function InvoiceRow({ invoice, downloading, locked, onPdf }: InvoiceRowProps) {
  const { t } = useTranslation();
  const { month } = useOwnerFormat();
  const money = useInvoiceMoney();
  const owner = invoice.ownerName?.trim() || t('ownerAccounting.owner.unnamed', { id: shortId(invoice.ownerId) });

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between" data-testid="owner-invoice-row" data-status={invoice.status} data-invoice={invoice.id}>
      <div className="min-w-0 space-y-1">
        <h3 className="break-words text-base font-semibold" data-testid="owner-invoice-row-number">
          {invoice.number ? t('ownerInvoice.page.row.number', { number: invoice.number }) : t('ownerInvoice.page.row.draft')}
        </h3>
        <p className="break-words text-sm text-foreground/70" data-testid="owner-invoice-row-owner">
          {t('ownerInvoice.page.row.ownerAndMonth', { owner, month: month(invoice.periodYear, invoice.periodMonth) })}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium tabular-nums" data-testid="owner-invoice-row-total">
            {money(invoice.total, invoice.currency)}
          </span>
          {invoice.creditedInFull ? (
            <Badge variant="outline">{t('ownerInvoice.status.Credited')}</Badge>
          ) : isDraft(invoice) ? (
            <Badge variant="warning">{t('ownerInvoice.status.Draft')}</Badge>
          ) : isIssued(invoice) ? (
            <Badge variant="success">{t('ownerInvoice.status.Issued')}</Badge>
          ) : (
            <Badge variant="outline">{invoice.status}</Badge>
          )}
          <InvoiceSettlement invoice={invoice} />
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 self-start">
        {isIssued(invoice) ? (
          <Button type="button" size="sm" variant="outline" loading={downloading} disabled={locked && !downloading} onClick={onPdf} data-testid="owner-invoice-row-pdf" aria-label={t('ownerInvoice.page.row.pdfLabel', { number: invoice.number ?? '' })}>
            {t('ownerInvoice.panel.pdf')}
          </Button>
        ) : null}
        {invoice.statementVersionId ? (
          <Button asChild size="sm" variant="ghost">
            <Link to={statementPath(invoice.statementVersionId)} data-testid="owner-invoice-row-statement">
              {t('ownerInvoice.page.row.statement')}
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  );
}
