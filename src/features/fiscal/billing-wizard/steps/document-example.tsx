import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { SkeletonLine } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { FiscalTaxRule } from '@/types';
import { amountLocale, exampleDocument, plainAmount } from '../billing-wizard-model';

interface DocumentExampleProps {
  rule: FiscalTaxRule | undefined;
  state: 'loading' | 'error' | 'ready';
  currency: string | null;
}

function percentText(percent: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(percent)}%`;
}

/**
 * The example document of the summary (NF-04: an example under what is hard to picture) with the rates in force: the version of the rule and the date it is valid from, the
 * VAT of every type of line, and a test stay (two nights and a cleaning) worked out with those rates, in the currency of the issuer: francs for a Swiss one, euros for an
 * Italian one, never one currency for all. The amounts are those of a test stay, and the note says so; the document of a real booking carries the amounts of the booking. With
 * no rule (no regime yet, or none of the catalog covers it) the example is not made: nothing is shown with a rate that nobody approved.
 */
export function DocumentExample({ rule, state, currency }: DocumentExampleProps) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const locale = amountLocale(i18n.language);
  const money = (amount: number) => (currency ? formatCurrency(amount, currency, locale) : plainAmount(amount, locale));
  const typeName = (lineType: string) => (i18n.exists(`billingWizard.lineTypes.${lineType}`) ? t(`billingWizard.lineTypes.${lineType}`) : lineType);
  const example = exampleDocument(rule);

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-3" data-testid="billing-example">
      <h3 id={headingId} className="text-base font-semibold">
        {t('billingWizard.summary.example.heading')}
      </h3>

      {state === 'loading' ? (
        <SkeletonLine lines={3} lineClassName="h-6" label={t('billingWizard.summary.example.loading')} />
      ) : state === 'error' ? (
        <Alert variant="warning" data-testid="billing-example-error">
          {t('billingWizard.summary.example.loadError')}
        </Alert>
      ) : !rule || !example ? (
        <Alert variant="info" data-testid="billing-example-none">
          {t('billingWizard.summary.example.noRule')}
        </Alert>
      ) : (
        <>
          <p className="text-sm text-foreground/80" data-testid="billing-rule">
            {t('billingWizard.summary.example.rule', { version: rule.version, from: formatDate(rule.validFrom) })}
          </p>

          <dl className="grid min-w-0 gap-x-6 gap-y-1 text-sm sm:grid-cols-2" data-testid="billing-rates">
            {rule.rates.map((rate) => (
              <div key={rate.lineType} className="flex min-w-0 justify-between gap-3 border-b py-1.5">
                <dt className="min-w-0 break-words text-foreground/80">{typeName(rate.lineType)}</dt>
                <dd className="shrink-0 font-medium">
                  {percentText(rate.percent, locale)}
                  {rate.natureCode ? ` (${rate.natureCode})` : ''}
                </dd>
              </div>
            ))}
          </dl>

          <div className="min-w-0 overflow-x-auto rounded-md border bg-background">
            <table className="w-full min-w-[28rem] text-left text-sm" data-testid="billing-example-table">
              <caption className="sr-only">{t('billingWizard.summary.example.caption')}</caption>
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-foreground/70">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    {t('billingWizard.summary.example.columns.line')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {t('billingWizard.summary.example.columns.net')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {t('billingWizard.summary.example.columns.vat')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    {t('billingWizard.summary.example.columns.total')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {example.lines.map((line) => (
                  <tr key={line.lineType}>
                    <th scope="row" className="px-3 py-2 font-medium">
                      {typeName(line.lineType)}
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums">{money(line.net)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {percentText(line.percent, locale)} · {money(line.vat)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(line.gross)}</td>
                  </tr>
                ))}
                {example.stamp > 0 ? (
                  <tr>
                    <th scope="row" className="px-3 py-2 font-medium">
                      {t('billingWizard.summary.example.stamp')}
                    </th>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right tabular-nums">{money(example.stamp)}</td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-semibold">
                  <th scope="row" className="px-3 py-2">
                    {t('billingWizard.summary.example.totalRow')}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{money(example.net)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(example.vat)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" data-testid="billing-example-total">
                    {money(example.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="break-words text-sm text-foreground/70">{t('billingWizard.summary.example.note')}</p>
          {currency === null ? (
            <p className="break-words text-sm text-foreground/70" data-testid="billing-example-no-currency">
              {t('billingWizard.summary.example.noCurrency')}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
