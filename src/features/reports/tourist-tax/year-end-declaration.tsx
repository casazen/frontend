import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import { PlainSection } from '@/components/shared/calm';
import { Badge } from '@/components/ui/badge';
import { ReportTableFrame } from '@/features/reports/overview/performance-table';
import type { TouristTaxDeclaration, TouristTaxDeclarationComune, TouristTaxReasonCount } from '@/types';
import { exemptionReasonLabel, hasYearEndCurrency, stayReasonLabel, yearEndMoney } from './tourist-tax-year-end-model';
import { YearEndRead } from './year-end-read';
import { FIGURE, HEAD, STATUS_TONES, STICKY } from './year-end-table-style';

/** The row the server gives to a caller who may not read the reasons of the exemptions (art. 9 GDPR): the page tells it with its own sentence and never works a reason out. */
const RESTRICTED_REASON = 'restricted';

interface ReasonListProps {
  counts: readonly TouristTaxReasonCount[];
  label: (reason: string) => string;
  counted: 'stays' | 'guests';
  testId: string;
}

function ReasonList({ counts, label, counted, testId }: ReasonListProps) {
  const { t } = useTranslation();
  if (counts.length === 0) return <p className="text-foreground/70">{t('reports.touristTax.yearEnd.declaration.details.none')}</p>;

  return (
    <ul role="list" className="space-y-1" data-testid={testId}>
      {counts.map((count) => {
        const parts =
          counted === 'stays'
            ? [t('reports.touristTax.yearEnd.declaration.counts.stays', { count: count.stays })]
            : [
                t('reports.touristTax.yearEnd.declaration.counts.guests', { count: count.guests }),
                t('reports.touristTax.yearEnd.declaration.counts.stays', { count: count.stays }),
                t('reports.touristTax.yearEnd.declaration.counts.guestNights', { count: count.guestNights }),
              ];
        return (
          <li key={count.reason} className="break-words" data-testid={count.reason === RESTRICTED_REASON ? 'year-end-exemption-restricted' : `${testId}-item`}>
            <span className="font-medium">{label(count.reason)}</span> <span className="text-foreground/70">{parts.join(' · ')}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ComuneDetails({ comune }: { comune: TouristTaxDeclarationComune }) {
  const { t } = useTranslation();
  return (
    <dl className="grid gap-x-8 gap-y-3 pb-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="font-medium">{t('reports.touristTax.yearEnd.declaration.details.taxedStays')}</dt>
        <dd className="tabular-nums" data-testid="year-end-declaration-taxed">
          {comune.taxedStays}
        </dd>
      </div>
      <div>
        <dt className="font-medium">{t('reports.touristTax.yearEnd.declaration.details.staysWithoutAmount')}</dt>
        <dd>
          <ReasonList counts={comune.staysWithoutAmount} counted="stays" label={(reason) => stayReasonLabel(reason, t)} testId="year-end-declaration-without-amount" />
        </dd>
      </div>
      <div>
        <dt className="font-medium">{t('reports.touristTax.yearEnd.declaration.details.exemptions')}</dt>
        <dd>
          <ReasonList counts={comune.exemptions} counted="guests" label={(reason) => exemptionReasonLabel(reason, t)} testId="year-end-declaration-exemptions" />
        </dd>
      </div>
    </dl>
  );
}

interface FiguresProps {
  year: number;
  declaration: TouristTaxDeclaration;
}

function DeclarationFigures({ year, declaration }: FiguresProps) {
  const { t, i18n } = useTranslation();
  const { comuni, total, currency } = declaration;
  const money = (cents: number | null) => (cents === null ? '—' : yearEndMoney(cents, currency, i18n.language));
  const incomplete = (
    <span className="mt-0.5 block text-xs font-normal text-foreground/70" data-testid="year-end-declaration-incomplete">
      {t('reports.touristTax.incomplete')}
    </span>
  );

  if (comuni.length === 0) {
    return (
      <p className="text-sm text-foreground/70" data-testid="year-end-declaration-empty">
        {t('reports.touristTax.yearEnd.declaration.empty', { year })}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ReportTableFrame caption={t('reports.touristTax.yearEnd.declaration.caption', { year })} testId="year-end-declaration-table">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={`${STICKY} ${HEAD} text-left`}>
              {t('reports.touristTax.columns.comune')}
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
              {t('reports.touristTax.columns.owed')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.touristTax.columns.paid')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.touristTax.columns.balance')}
            </th>
            <th scope="col" className={`${HEAD} text-left`}>
              {t('reports.touristTax.columns.status')}
            </th>
          </tr>
        </thead>

        {comuni.map((comune) => {
          const { summary } = comune;
          return (
            <tbody key={summary.comune} className="border-b border-border" data-testid="year-end-declaration-comune">
              <tr data-testid="year-end-declaration-row">
                <th scope="row" className={`${STICKY} px-3 py-2 text-left align-top font-medium`}>
                  <span className="break-words">{summary.comune}</span>
                </th>
                <td className={FIGURE}>{summary.stays}</td>
                <td className={FIGURE}>{summary.nights}</td>
                <td className={FIGURE}>{summary.guests}</td>
                <td className={FIGURE}>
                  <div className="font-medium">{money(summary.owedCents)}</div>
                  {summary.staysWithoutAmount > 0 ? incomplete : null}
                </td>
                <td className={FIGURE}>{money(summary.paidCents)}</td>
                <td className={FIGURE}>{money(summary.balanceCents)}</td>
                <td className="px-3 py-2 align-top">
                  {summary.status ? (
                    <Badge variant={STATUS_TONES[summary.status]} data-testid="year-end-declaration-status">
                      {t(`reports.touristTax.status.${summary.status}`)}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
              <tr data-testid="year-end-declaration-details">
                <td colSpan={8} className="px-3 pb-1 pt-0">
                  <div className="sticky left-0 w-[min(100%,calc(100vw-3rem))]">
                    <ComuneDetails comune={comune} />
                  </div>
                </td>
              </tr>
            </tbody>
          );
        })}

        <tfoot>
          <tr className="border-t-2 border-border" data-testid="year-end-declaration-total">
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
            <td />
          </tr>
        </tfoot>
      </ReportTableFrame>
      {hasYearEndCurrency(currency) ? null : (
        <p className="text-sm text-foreground/70" data-testid="year-end-declaration-currency-missing">
          {t('reports.touristTax.yearEnd.figures.currencyMissing')}
        </p>
      )}
    </div>
  );
}

interface DeclarationSectionProps {
  year: number;
  query: UseQueryResult<TouristTaxDeclaration>;
}

export function DeclarationSection({ year, query }: DeclarationSectionProps) {
  const { t } = useTranslation();
  return (
    <PlainSection title={t('reports.touristTax.yearEnd.declaration.title', { year })} aria-busy={query.isFetching} data-testid="year-end-declaration-data">
      <YearEndRead query={query} id="year-end-declaration-data">
        {(declaration) => <DeclarationFigures year={year} declaration={declaration} />}
      </YearEndRead>
    </PlainSection>
  );
}
