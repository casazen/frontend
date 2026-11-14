import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatStayDate } from '@/lib/stay-dates';
import type { OwnerPortalStatementLine, OwnerPortalStatementSection, OwnerPortalStatementTotals, OwnerPortalTouristTax } from '@/types';
import { BALANCE_KEYS, currencyCode, formatMoney, shownTotals, touristTaxTotals } from './owner-statement-model';
import { StatusPill, TOUCH } from './portal-parts';

const DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** The days of a stay («10 nov 2026 - 14 nov 2026»), or nothing when one of the two is not a day. */
function stayDays(checkIn: string | null | undefined, checkOut: string | null | undefined, locale: string): string {
  const from = checkIn ? formatStayDate(checkIn, locale, DAY) : '';
  const to = checkOut ? formatStayDate(checkOut, locale, DAY) : '';
  return from && to ? `${from} - ${to}` : '';
}

/** The share of the owner written the way the language of the person writes a number («33,33»). */
function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

/** A name and its amount on one row: the name may go to the next line, the amount never breaks. */
function AmountRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-1.5">
      <dt className="min-w-0 break-words text-muted-foreground">{label}</dt>
      <dd className="shrink-0 whitespace-nowrap font-medium tabular-nums" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

/**
 * The net of the period, the one figure a statement is read for. In the currency of the statement: the symbol and the order of the number and the symbol come from the data
 * and from the language, never from the code.
 */
export function StatementNet({ net, currency }: { net: number; currency: string }) {
  const { t, i18n } = useTranslation();
  return (
    <div>
      <p className="text-sm text-muted-foreground">{t('ownerPortal.accounting.totals.net')}</p>
      <p className="text-2xl font-semibold tabular-nums text-[#1f3a3d]" data-testid="owner-statement-net">
        {formatMoney(net, currency, i18n.language)}
      </p>
    </div>
  );
}

/** What the net is made of: the totals of the statement in a list of names and amounts (no table to scroll sideways). */
export function StatementTotalsList({ totals, currency }: { totals: OwnerPortalStatementTotals; currency: string }) {
  const { t, i18n } = useTranslation();
  return (
    <dl className="divide-y text-sm" data-testid="owner-statement-totals">
      {shownTotals(totals).map((key) => (
        <AmountRow key={key} label={t(`ownerPortal.accounting.totals.${key}`)} value={formatMoney(totals[key], currency, i18n.language)} testId={`owner-statement-total-${key}`} />
      ))}
    </dl>
  );
}

/** The balance the months before left, what was paid between the agency and the owner, and what the agency owes at the end of the month. */
export function StatementBalances({ totals, currency }: { totals: OwnerPortalStatementTotals; currency: string }) {
  const { t, i18n } = useTranslation();
  return (
    <dl className="divide-y text-sm" data-testid="owner-statement-balances">
      {BALANCE_KEYS.map((key) => (
        <AmountRow key={key} label={t(`ownerPortal.accounting.totals.${key}`)} value={formatMoney(totals[key], currency, i18n.language)} testId={`owner-statement-total-${key}`} />
      ))}
    </dl>
  );
}

/** A sentence under the figures: said when something about them is missing (the currency), so that a figure is never read as more than it is. */
export function MoneyNote({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground" data-testid={testId}>
      {children}
    </p>
  );
}

interface PdfButtonProps {
  label: string;
  /** What the button does for a screen reader that reads the buttons of a page one after the other: which document it is for. */
  ariaLabel: string;
  onClick: () => void;
  /** Some download of the page is on its way: every button waits for it. */
  disabled: boolean;
  /** This is the download that is on its way. */
  loading: boolean;
  variant?: 'default' | 'outline';
  testId?: string;
}

/** The button that downloads a PDF of the portal: at least 44 px, one download at a time (the others wait for the one that works). */
export function PdfButton({ label, ariaLabel, onClick, disabled, loading, variant = 'outline', testId }: PdfButtonProps) {
  return (
    <Button type="button" variant={variant} className={TOUCH} disabled={disabled} loading={loading} onClick={onClick} aria-label={ariaLabel} data-testid={testId}>
      <Download aria-hidden="true" className="h-4 w-4" />
      {label}
    </Button>
  );
}

function StatementLineRow({ line, currency, sectionLabel }: { line: OwnerPortalStatementLine; currency: string; sectionLabel: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const description = line.description?.trim();
  const property = line.property?.trim();
  const title = description || property || sectionLabel;
  // The words that tell a line apart: the day or the days of the stay, the property (when it is not the title), the sales channel, the booking code, what it is for and the share of the owner.
  const details = [
    stayDays(line.checkIn, line.checkOut, locale) || formatStayDate(line.date, locale, DAY),
    description ? property : null,
    line.channel,
    line.bookingCode ? t('ownerPortal.accounting.line.bookingCode', { code: line.bookingCode }) : null,
    line.kind === 'cleaning' ? t('ownerPortal.accounting.line.kind.cleaning') : null,
    line.kind === 'linen' ? t('ownerPortal.accounting.line.kind.linen') : null,
    line.sharePercent > 0 && line.sharePercent < 100 ? t('ownerPortal.accounting.line.share', { percent: formatPercent(line.sharePercent, locale) }) : null,
  ].filter(Boolean);
  return (
    <li className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4" data-testid="owner-statement-line">
      <div className="min-w-0 space-y-1">
        <p className="break-words text-sm font-medium">{title}</p>
        <p className="break-words text-sm text-muted-foreground">{details.join(' · ')}</p>
        {line.reversal ? <StatusPill tone="neutral">{t('ownerPortal.accounting.line.reversal')}</StatusPill> : null}
        {line.channelFeeRechargedByAgency ? <p className="text-sm text-muted-foreground">{t('ownerPortal.accounting.line.rechargedByAgency')}</p> : null}
      </div>
      <p className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums sm:text-right">{formatMoney(line.amount, currency, locale)}</p>
    </li>
  );
}

/** One part of the statement as its PDF has it: the name, the sum of its lines and the lines, by day. */
export function StatementSectionBlock({ section, currency }: { section: OwnerPortalStatementSection; currency: string }) {
  const { t, i18n } = useTranslation();
  const headingId = `owner-statement-section-${section.section}`;
  const label = t(`ownerPortal.accounting.sections.${section.section}`);
  return (
    <section aria-labelledby={headingId} className="space-y-2" data-testid={headingId}>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <h3 id={headingId} className="min-w-0 break-words text-base font-semibold">
          {label}
        </h3>
        <p className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{formatMoney(section.total, currency, i18n.language)}</p>
      </div>
      <ul className="divide-y rounded-md border bg-card px-3">
        {section.lines.map((line) => (
          <StatementLineRow key={line.id} line={line} currency={currency} sectionLabel={label} />
        ))}
      </ul>
    </section>
  );
}

/**
 * The tourist tax of the stays of the statement: for information, outside the net. Each stay carries the currency the tax was collected in (its amount is written in that one,
 * not in the one of the statement), and a sum never mixes two currencies.
 */
export function TouristTaxBox({ rows }: { rows: readonly OwnerPortalTouristTax[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const totals = touristTaxTotals(rows);
  return (
    <section aria-labelledby="owner-tourist-tax-title" className="space-y-3 rounded-md border bg-card p-4" data-testid="owner-tourist-tax">
      <div className="space-y-1">
        <h2 id="owner-tourist-tax-title" className="text-lg font-semibold text-[#1f3a3d]">
          {t('ownerPortal.accounting.touristTax.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('ownerPortal.accounting.touristTax.description')}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm" data-testid="owner-tourist-tax-empty">
          {t('ownerPortal.accounting.touristTax.empty')}
        </p>
      ) : (
        <>
          <ul className="divide-y">
            {rows.map((row, index) => {
              const details = [
                stayDays(row.checkIn, row.checkOut, locale),
                row.channel,
                row.bookingCode ? t('ownerPortal.accounting.line.bookingCode', { code: row.bookingCode }) : null,
              ].filter(Boolean);
              return (
                <li key={`${row.bookingCode ?? ''}-${row.checkIn}-${index}`} className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4" data-testid="owner-tourist-tax-row">
                  <div className="min-w-0 space-y-0.5">
                    {row.property ? <p className="break-words text-sm font-medium">{row.property}</p> : null}
                    <p className="break-words text-sm text-muted-foreground">{details.join(' · ')}</p>
                  </div>
                  <p className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums sm:text-right">{formatMoney(row.amount, row.currency, locale)}</p>
                </li>
              );
            })}
          </ul>
          <dl className="divide-y border-t text-sm">
            {totals.map((total) => (
              <AmountRow key={total.currency ?? 'none'} label={t('ownerPortal.accounting.touristTax.total')} value={formatMoney(total.total, total.currency, locale)} testId="owner-tourist-tax-total" />
            ))}
          </dl>
          {rows.some((row) => !currencyCode(row.currency)) ? (
            <MoneyNote testId="owner-tourist-tax-currency-missing">{t('ownerPortal.accounting.touristTax.currencyMissing')}</MoneyNote>
          ) : null}
        </>
      )}
    </section>
  );
}
