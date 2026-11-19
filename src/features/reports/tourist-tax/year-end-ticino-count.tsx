import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ReportTableFrame } from '@/features/reports/overview/performance-table';
import { formatStayDate } from '@/lib/stay-dates';
import type { TicinoPropertyCount, TicinoYearlyCount } from '@/types';
import { hasYearEndCurrency, yearEndAmount } from './tourist-tax-year-end-model';
import { YearEndRead } from './year-end-read';
import { FIGURE, HEAD, STICKY } from './year-end-table-style';

/** Where the properties are listed and edited: where the Swiss municipality of a house is completed. */
const PROPERTIES_PATH = '/app/short-rent/properties';

/** The stays of a group and, under them, its nights: the two numbers the count of Ticino is made of. */
function StaysAndNights({ stays, nights }: { stays: number; nights: number }) {
  const { t } = useTranslation();
  return (
    <td className={FIGURE}>
      <div>{stays}</div>
      <div className="text-xs text-foreground/70">{t('reports.touristTax.yearEnd.ticino.nights', { count: nights })}</div>
    </td>
  );
}

function PropertyCell({ property }: { property: TicinoPropertyCount }) {
  const { t } = useTranslation();
  const place = [property.address, property.city].filter(Boolean).join(', ');
  return (
    <th scope="row" className={`${STICKY} px-3 py-2 text-left align-top font-normal`}>
      <span className="break-words font-medium">{property.propertyName}</span>
      {place ? <span className="block break-words text-xs text-foreground/70">{place}</span> : null}
      {/* A property in Switzerland whose canton is not known may be in Ticino: it is in the count and marked, so the count never looks complete when it is not. */}
      {property.cantonUnknown ? (
        <Badge variant="warning" className="mt-1" data-testid="year-end-ticino-canton-unknown">
          {t('reports.touristTax.yearEnd.ticino.unknown.marker')}
        </Badge>
      ) : null}
    </th>
  );
}

interface FiguresProps {
  year: number;
  count: TicinoYearlyCount;
}

/**
 * The yearly count of the nights in Ticino as the server gives it (the data of the file of the same name, nothing recomputed): for each property the stays and nights of the year, those whose document carries a tourist tax,
 * those whose document has none and those with no document yet (told apart, never counted as untaxed), and the tourist tax of the documents in the currency of the property. The day the count is due is the server's. A property
 * in Switzerland whose canton is not known is in it, marked, and the page says how many they are (the server's count) and where it is fixed: the count never looks complete when it is not.
 */
function TicinoFigures({ year, count }: FiguresProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { properties, cantonUnknownCount, dueDate } = count;

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground/70" data-testid="year-end-ticino-due">
        {t('reports.touristTax.yearEnd.ticino.due', { date: formatStayDate(dueDate, locale) || dueDate })}
      </p>

      {cantonUnknownCount > 0 ? (
        <Alert
          variant="warning"
          data-testid="year-end-ticino-unknown"
          action={
            <Link to={PROPERTIES_PATH} className="text-sm font-medium text-primary underline underline-offset-4" data-testid="year-end-ticino-unknown-link">
              {t('reports.touristTax.yearEnd.ticino.openProperties')}
            </Link>
          }
        >
          {t('reports.touristTax.yearEnd.ticino.unknown.note', { count: cantonUnknownCount })}
        </Alert>
      ) : null}

      {properties.length === 0 ? (
        // Said in words: no property in Ticino (and none of unknown canton) has nothing to count.
        <p className="text-sm text-foreground/70" data-testid="year-end-ticino-empty">
          {t('reports.touristTax.yearEnd.ticino.empty', { year })}
        </p>
      ) : (
        <>
          <ReportTableFrame caption={t('reports.touristTax.yearEnd.ticino.caption', { year })} testId="year-end-ticino-table">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={`${STICKY} ${HEAD} text-left`}>
                  {t('reports.touristTax.yearEnd.ticino.columns.property')}
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  {t('reports.touristTax.columns.stays')}
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  {t('reports.touristTax.yearEnd.ticino.columns.taxed')}
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  {t('reports.touristTax.yearEnd.ticino.columns.untaxed')}
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  {t('reports.touristTax.yearEnd.ticino.columns.withoutDocument')}
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  {t('reports.touristTax.yearEnd.ticino.columns.touristTax')}
                </th>
              </tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr key={property.propertyId} className="border-b border-border" data-testid="year-end-ticino-row">
                  <PropertyCell property={property} />
                  <StaysAndNights stays={property.stays} nights={property.nights} />
                  <StaysAndNights stays={property.taxedStays} nights={property.taxedNights} />
                  <StaysAndNights stays={property.untaxedStays} nights={property.untaxedNights} />
                  <StaysAndNights stays={property.staysWithoutDocument} nights={property.nightsWithoutDocument} />
                  <td className={FIGURE} data-testid="year-end-ticino-tax">
                    {yearEndAmount(property.touristTax, property.currency, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </ReportTableFrame>
          <p className="text-sm text-foreground/70">{t('reports.touristTax.yearEnd.ticino.legend')}</p>
          {properties.every((property) => hasYearEndCurrency(property.currency)) ? null : (
            <p className="text-sm text-foreground/70" data-testid="year-end-ticino-currency-missing">
              {t('reports.touristTax.yearEnd.ticino.currencyMissing')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface TicinoSectionProps {
  year: number;
  query: UseQueryResult<TicinoYearlyCount>;
}

/** The yearly count of the nights in Ticino, on screen: what the third file of the page holds (E18/F01/US02/T03, NF-117), due to the tourist board by 5 January of the next year. Nothing is filed by CasaZen. */
export function TicinoSection({ year, query }: TicinoSectionProps) {
  const { t } = useTranslation();
  return (
    <PlainSection title={t('reports.touristTax.yearEnd.ticino.title', { year })} aria-busy={query.isFetching} data-testid="year-end-ticino-data">
      <YearEndRead query={query} id="year-end-ticino-data">
        {(count) => <TicinoFigures year={year} count={count} />}
      </YearEndRead>
    </PlainSection>
  );
}
