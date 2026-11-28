import { useTranslation } from 'react-i18next';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import type { OwnerInvoice } from '@/types';
import { vatSummaryOf } from './owner-invoice-model';
import { useInvoiceMoney } from './use-invoice-money';

const KNOWN_LINE_TYPES = ['Commission', 'Recharge', 'AdvancedExpense'] as const;

interface InvoiceTotalsProps {
  currency: string;
  taxable: number;
  vat: number;
  stampDuty: number;
  total: number;
}

/** The totals of an invoice as the server stored them, in its currency: the taxable amount, the VAT, the stamp duty when there is one, and the total. */
export function InvoiceTotals({ currency, taxable, vat, stampDuty, total }: InvoiceTotalsProps) {
  const { t } = useTranslation();
  const money = useInvoiceMoney();
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm" data-testid="owner-invoice-totals">
      <dt className="text-foreground/70">{t('ownerInvoice.totals.taxable')}</dt>
      <dd className="text-right tabular-nums">{money(taxable, currency)}</dd>
      <dt className="text-foreground/70">{t('ownerInvoice.totals.vat')}</dt>
      <dd className="text-right tabular-nums">{money(vat, currency)}</dd>
      {stampDuty > 0 ? (
        <>
          <dt className="text-foreground/70">{t('ownerInvoice.totals.stampDuty')}</dt>
          <dd className="text-right tabular-nums">{money(stampDuty, currency)}</dd>
        </>
      ) : null}
      <dt className="font-semibold">{t('ownerInvoice.totals.total')}</dt>
      <dd className="text-right font-semibold tabular-nums" data-testid="owner-invoice-total">
        {money(total, currency)}
      </dd>
    </dl>
  );
}

/**
 * The lines of an invoice with the type of each, the VAT by rate as the server sums it, and the totals: what the panel of a statement shows for the draft it has just made, and what the
 * drawer shows for an invoice read by its id. Every amount is in the currency of the invoice.
 */
export function InvoiceLines({ invoice }: { invoice: OwnerInvoice }) {
  const { t } = useTranslation();
  const money = useInvoiceMoney();
  const { percent } = useOwnerFormat();
  const rows = vatSummaryOf(invoice.lines, invoice.vatAmount);

  return (
    <div className="space-y-3" data-testid="owner-invoice-lines">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <caption className="sr-only">{t('ownerInvoice.lines.caption')}</caption>
          <thead>
            <tr className="border-b border-border text-left text-foreground/70">
              <th scope="col" className="py-2 pr-3 font-medium">{t('ownerInvoice.lines.description')}</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">{t('ownerInvoice.lines.net')}</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">{t('ownerInvoice.lines.rate')}</th>
              <th scope="col" className="py-2 text-right font-medium">{t('ownerInvoice.lines.vat')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.lineNumber} className="border-b border-border last:border-0" data-testid="owner-invoice-line" data-type={line.type}>
                <td className="py-2 pr-3 align-top">
                  <span className="break-words">{line.description}</span>
                  <span className="block text-foreground/70">{(KNOWN_LINE_TYPES as readonly string[]).includes(line.type) ? t(`ownerInvoice.lineType.${line.type}`) : line.type}</span>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right align-top tabular-nums">{money(line.totalPrice, invoice.currency)}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right align-top tabular-nums">{line.vatRatePercent === 0 ? (line.vatNatureCode ?? percent(0)) : percent(line.vatRatePercent)}</td>
                <td className="whitespace-nowrap py-2 text-right align-top tabular-nums">{line.vatAmount === null ? '' : money(line.vatAmount, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul role="list" className="space-y-1 text-sm" data-testid="owner-invoice-vat-rates" aria-label={t('ownerInvoice.vat.title')}>
        {rows.map((row) => (
          <li key={`${row.rate}-${row.nature ?? ''}`} className="break-words" data-rate={row.rate}>
            {row.rate === 0
              ? t('ownerInvoice.vat.outside', { nature: row.nature ? ` (${row.nature})` : '', taxable: money(row.taxable, invoice.currency) })
              : row.tax === null
                ? t('ownerInvoice.vat.rateWithoutTax', { rate: percent(row.rate), taxable: money(row.taxable, invoice.currency) })
                : t('ownerInvoice.vat.rate', { rate: percent(row.rate), taxable: money(row.taxable, invoice.currency), tax: money(row.tax, invoice.currency) })}
          </li>
        ))}
      </ul>
      <InvoiceTotals currency={invoice.currency} taxable={invoice.taxableBase} vat={invoice.vatAmount} stampDuty={invoice.stampDuty} total={invoice.total} />
    </div>
  );
}
