import { useId, type ChangeEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatStrip, StatTile } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Select } from '@/components/ui/select';
import { SkeletonLine } from '@/components/ui/skeleton';
import { formatWorkDuration } from '@/lib/work-duration';
import { useSupplierOverview } from '@/queries/use-supplier';
import { formatMoney } from '../services/lib/service-money';
import { numbersOf, PERIOD_PARAM, PERIODS, periodOf } from './home-model';

/** What a figure that does not exist says: a dash, never a number made up. */
const NO_VALUE = '—';
const sign = (change: number) => (change > 0 ? '+' : '−');

// On a phone the three numbers scroll sideways, one at a time (the same strip as the Home of Affitti brevi).
const CAROUSEL =
  'max-sm:[&>ul]:flex max-sm:[&>ul]:snap-x max-sm:[&>ul]:snap-mandatory max-sm:[&>ul]:overflow-x-auto max-sm:[&>ul>li]:w-[78%] max-sm:[&>ul>li]:shrink-0 max-sm:[&>ul>li]:snap-start';

/**
 * "I tuoi numeri": three figures in one quiet row, each against the period just before it. The server works the figures and the
 * comparison out; the page only writes them. With no payments through CasaZen the third is "Lavori completati", never "Incassi".
 * The period is in the address (`?periodo=30g`), so a shared link shows the same numbers.
 */
export function NumbersSection() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const titleId = useId();
  const [params, setParams] = useSearchParams();
  const period = periodOf(params.get(PERIOD_PARAM));
  const query = useSupplierOverview(period.value);

  const changePeriod = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = PERIODS.find((candidate) => candidate.value === event.target.value) ?? PERIODS[0];
    setParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        if (next.param) updated.set(PERIOD_PARAM, next.param);
        else updated.delete(PERIOD_PARAM);
        return updated;
      },
      { replace: true },
    );
  };

  const same = t('supplier.home.numbers.deltaSame');
  const delta = (value: string) => t('supplier.home.numbers.delta', { value });

  let content: ReactNode;
  if (query.isLoading) {
    content = <SkeletonLine lines={3} />;
  } else if (query.isError || !query.data?.current || !query.data.previous) {
    content = <ErrorState title={t('supplier.home.numbers.loadError')} error={query.error} onRetry={() => void query.refetch()} testId="supplier-kpis-error" />;
  } else {
    const numbers = numbersOf(query.data);
    if (numbers.quiet) {
      content = (
        <p className="text-sm text-foreground/70" data-testid="supplier-kpis-quiet">
          {t('supplier.home.numbers.quiet')}
        </p>
      );
    } else {
      const { acceptancePoints: points, responseChange: response, thirdChange: third } = numbers;
      content = (
        <StatStrip label={t('supplier.home.numbers.title')} className={CAROUSEL}>
          <StatTile
            data-testid="supplier-kpi-acceptance"
            label={t('supplier.home.numbers.acceptance')}
            value={numbers.acceptancePercent === null ? NO_VALUE : `${numbers.acceptancePercent}%`}
            delta={points === null ? undefined : points === 0 ? same : delta(`${sign(points)}${t('supplier.home.numbers.points', { count: Math.abs(points) })}`)}
          />
          <StatTile
            data-testid="supplier-kpi-response"
            label={t('supplier.home.numbers.response')}
            value={numbers.responseMinutes === null ? NO_VALUE : formatWorkDuration(numbers.responseMinutes, t)}
            delta={
              response === null
                ? undefined
                : response === 0
                  ? same
                  : response < 0
                    ? t('supplier.home.numbers.deltaFaster', { amount: formatWorkDuration(-response, t) })
                    : t('supplier.home.numbers.deltaSlower', { amount: formatWorkDuration(response, t) })
            }
          />
          <StatTile
            data-testid="supplier-kpi-third"
            label={numbers.money ? t('supplier.home.numbers.earnings') : t('supplier.home.numbers.jobs')}
            value={numbers.money ? formatMoney(numbers.third, locale) : numbers.third}
            delta={third === 0 ? same : delta(`${sign(third)}${numbers.money ? formatMoney(Math.abs(third), locale) : Math.abs(third)}`)}
          />
        </StatStrip>
      );
    }
  }

  return (
    <section aria-labelledby={titleId} data-testid="supplier-kpis" className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={titleId} className="min-w-0 break-words text-lg font-semibold">
          {t('supplier.home.numbers.title')}
        </h2>
        <Select
          size="sm"
          aria-label={t('supplier.home.numbers.period')}
          data-testid="supplier-kpi-period"
          wrapperClassName="w-full sm:w-52"
          value={period.value}
          onChange={changePeriod}
        >
          {PERIODS.map((candidate) => (
            <option key={candidate.value} value={candidate.value}>
              {t(candidate.labelKey)}
            </option>
          ))}
        </Select>
      </div>
      {content}
    </section>
  );
}
