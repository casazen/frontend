import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import { HOME_PERIODS, parseHomePeriod, type HomePeriod } from '../lib/home-period';

interface HomeFilterBarProps {
  properties: ReadonlyArray<{ id: string; name: string }>;
  propertyId: string;
  period: HomePeriod;
  onPropertyChange: (propertyId: string) => void;
  onPeriodChange: (period: HomePeriod) => void;
}

/**
 * Property and period of the Home, always in reach (it stays under the header when the page scrolls). They live in the address
 * (`?propertyId=&period=`), so a filtered Home can be shared and Back brings it back. With one property there is nothing to choose
 * between, so only the period is offered.
 */
export function HomeFilterBar({ properties, propertyId, period, onPropertyChange, onPeriodChange }: HomeFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('dashboard.filter.label')}
      data-testid="home-filter"
      className="sticky top-[var(--header-height,0px)] z-30 -mx-4 flex flex-wrap items-center gap-2 bg-background/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6"
    >
      {properties.length > 1 ? (
        <Select
          size="sm"
          aria-label={t('dashboard.filter.property')}
          data-testid="dashboard-property"
          wrapperClassName="w-full sm:w-60"
          value={propertyId}
          onChange={(event) => onPropertyChange(event.target.value)}
        >
          <option value="">{t('dashboard.filter.allProperties')}</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </Select>
      ) : null}
      <Select
        size="sm"
        aria-label={t('dashboard.filter.period')}
        data-testid="dashboard-period"
        wrapperClassName="w-full sm:w-52"
        value={period}
        onChange={(event) => onPeriodChange(parseHomePeriod(event.target.value))}
      >
        {HOME_PERIODS.map((value) => (
          <option key={value} value={value}>
            {t(`dashboard.period.${value}`)}
          </option>
        ))}
      </Select>
    </div>
  );
}
