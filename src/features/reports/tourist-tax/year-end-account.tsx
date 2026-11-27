import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import type { YearEndAccountCut } from '@/api/tourist-tax-summary.api';
import { PlainSection } from '@/components/shared/calm';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { ReportTableFrame } from '@/features/reports/overview/performance-table';
import { formatStayDate } from '@/lib/stay-dates';
import type { TouristTaxAgentAccount } from '@/types';
import { accountGroups, accountPeriodLabel, hasYearEndCurrency, YEAR_END_ACCOUNT_CUTS, yearEndAmount, yearEndMoney } from './tourist-tax-year-end-model';
import { YearEndRead } from './year-end-read';
import { FIGURE, HEAD, STICKY } from './year-end-table-style';

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

interface FiguresProps {
  year: number;
  by: YearEndAccountCut;
  account: TouristTaxAgentAccount;
}

/**
 * The account of the agent of the year as the server gives it (the data of the file of the same name, nothing recomputed): for each comune the tax collected and the tax paid to it, month by month or quarter by quarter,
 * then the line of the year, the total the server adds up and every payment of the year. Every amount is written in the currency of the answer, never an assumed one. A period with stays that have no tax recorded says
 * that the tax collected may be incomplete.
 */
function AccountFigures({ year, by, account }: FiguresProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { rows, remittances, total, currency } = account;
  const amount = (value: number) => yearEndAmount(value, currency, locale);
  const money = (cents: number | null) => (cents === null ? '—' : yearEndMoney(cents, currency, locale));
  const date = (day: string) => formatStayDate(day, locale, SHORT_DATE);
  const incomplete = (
    <span className="mt-0.5 block text-xs font-normal text-foreground/70" data-testid="year-end-account-incomplete">
      {t('reports.touristTax.incomplete')}
    </span>
  );

  if (rows.length === 0) {
    // Said in words: a year with no stay in Italy and no payment has no row.
    return (
      <p className="text-sm text-foreground/70" data-testid="year-end-account-empty">
        {t('reports.touristTax.yearEnd.account.empty', { year })}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ReportTableFrame caption={t('reports.touristTax.yearEnd.account.caption', { year, cut: t(`reports.touristTax.yearEnd.account.by.${by}`) })} testId="year-end-account-table">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={`${STICKY} ${HEAD} text-left`}>
              {t('reports.touristTax.yearEnd.account.columns.period')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.touristTax.columns.stays')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.touristTax.yearEnd.columns.nights')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.touristTax.yearEnd.columns.guests')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.touristTax.yearEnd.account.columns.collected')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.touristTax.columns.paid')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.touristTax.columns.balance')}
            </th>
          </tr>
        </thead>

        {accountGroups(rows).map((group) => (
          <tbody key={group.comune} className="border-b border-border" data-testid="year-end-account-comune">
            <tr>
              <th scope="rowgroup" colSpan={7} className="px-3 pb-1 pt-3 text-left font-semibold">
                {/* The name of the comune stays where the first column is while the table scrolls sideways on a phone. */}
                <div className="sticky left-0 w-[min(100%,calc(100vw-3rem))] break-words">{group.comune}</div>
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.period} className={row.isYear ? 'border-t border-border font-semibold' : undefined} data-testid={row.isYear ? 'year-end-account-year-row' : 'year-end-account-row'}>
                <th scope="row" className={`${STICKY} px-3 py-2 text-left align-top ${row.isYear ? 'font-semibold' : 'font-normal'}`}>
                  {accountPeriodLabel(row, locale, t)}
                </th>
                <td className={FIGURE}>{row.stays}</td>
                <td className={FIGURE}>{row.nights}</td>
                <td className={FIGURE}>{row.guests}</td>
                <td className={FIGURE}>
                  <div>{amount(row.collected)}</div>
                  {row.staysWithoutAmount > 0 ? incomplete : null}
                </td>
                <td className={FIGURE}>{amount(row.remitted)}</td>
                <td className={FIGURE}>{amount(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        ))}

        <tfoot>
          <tr className="border-t-2 border-border" data-testid="year-end-account-total">
            <th scope="row" className={`${STICKY} px-3 py-2 text-left align-top font-semibold`}>
              {t('reports.touristTax.total')}
            </th>
            <td className={`${FIGURE} font-semibold`}>{total.stays}</td>
            <td className={`${FIGURE} font-semibold`}>{total.nights}</td>
            <td className={`${FIGURE} font-semibold`}>{total.guests}</td>
            <td className={`${FIGURE} font-semibold`}>
              <div>{money(total.owedCents)}</div>
              {total.staysWithoutAmount > 0 ? incomplete : null}
            </td>
            <td className={`${FIGURE} font-semibold`}>{money(total.paidCents)}</td>
            <td className={`${FIGURE} font-semibold`}>{money(total.balanceCents)}</td>
          </tr>
        </tfoot>
      </ReportTableFrame>
      {hasYearEndCurrency(currency) ? null : (
        <p className="text-sm text-foreground/70" data-testid="year-end-account-currency-missing">
          {t('reports.touristTax.yearEnd.figures.currencyMissing')}
        </p>
      )}

      <div className="space-y-1" data-testid="year-end-account-remittances">
        <h3 className="text-base font-semibold">{t('reports.touristTax.yearEnd.account.remittances.title')}</h3>
        {remittances.length === 0 ? (
          <p className="text-sm text-foreground/70" data-testid="year-end-account-remittances-empty">
            {t('reports.touristTax.yearEnd.account.remittances.empty', { year })}
          </p>
        ) : (
          <ul role="list" className="divide-y divide-border">
            {remittances.map((remittance) => {
              const details = [
                remittance.comune,
                t('reports.touristTax.remittances.period', { from: date(remittance.periodFrom), to: date(remittance.periodTo) }),
                t('reports.touristTax.remittances.paidOn', { date: date(remittance.paidOn) }),
                ...(remittance.reference ? [t('reports.touristTax.remittances.reference', { reference: remittance.reference })] : []),
              ];
              return (
                <li key={remittance.id} className="py-2 text-sm" data-testid="year-end-account-remittance">
                  <p className="font-medium tabular-nums">{money(remittance.amountCents)}</p>
                  <p className="break-words text-foreground/70">{details.join(' · ')}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

interface AccountSectionProps {
  year: number;
  by: YearEndAccountCut;
  onByChange: (by: YearEndAccountCut) => void;
  query: UseQueryResult<TouristTaxAgentAccount>;
}

/**
 * The account of the agent of the year, on screen: what the second file of the page holds (E18/F01/US02/T03, NF-117), cut by month or by quarter. The cut is the one the file below is made in (one choice for both), and it
 * stays on the page whatever the read does, so a person can change it after a failure.
 */
export function AgentAccountSection({ year, by, onByChange, query }: AccountSectionProps) {
  const { t } = useTranslation();
  return (
    <PlainSection title={t('reports.touristTax.yearEnd.account.title', { year })} aria-busy={query.isFetching} data-testid="year-end-account-data">
      <Field label={t('reports.touristTax.yearEnd.account.by.label')} className="w-full sm:w-56">
        <Select value={by} onChange={(event) => onByChange(event.target.value as YearEndAccountCut)} data-testid="year-end-account-by">
          {YEAR_END_ACCOUNT_CUTS.map((cut) => (
            <option key={cut} value={cut}>
              {t(`reports.touristTax.yearEnd.account.by.${cut}`)}
            </option>
          ))}
        </Select>
      </Field>
      <YearEndRead query={query} id="year-end-account-data">
        {(account) => <AccountFigures year={year} by={by} account={account} />}
      </YearEndRead>
    </PlainSection>
  );
}
