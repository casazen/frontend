import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useVerificationMetrics } from '@/queries/verification';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import { percentOf } from './verification-model';

/** One figure of the card: its number big, its words under it. */
function Figure({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums" data-testid={testId}>
        {value}
      </dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

/**
 * The monitoring of the identity verifications (NF-51): how many passed on their own, how many went to a person and how many did not pass, and
 * the share of the concluded verifications that an operator concluded. A quiet summary above the queue, which stays the main block of the page.
 * The figures of the last 30 days for the properties the operator reaches; a figure that could not be read is said, never shown as a zero.
 */
export function VerificationMetricsCard() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, refetch, isFetching } = useVerificationMetrics();
  const day = (value: string) => {
    const stay = parseStayDate(value);
    return stay ? formatStayDate(stay, i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }) : value;
  };

  return (
    <Card data-testid="verification-metrics">
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold leading-none tracking-tight">{t('verification.metrics.title')}</h2>
        {data && (
          <CardDescription>{t('verification.metrics.period', { from: day(data.from), to: day(data.to) })}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-muted-foreground" role="status" data-testid="verification-metrics-loading">
            {t('verification.metrics.loading')}
          </p>
        )}
        {isError && !data && (
          <div className="flex flex-wrap items-center gap-3" data-testid="verification-metrics-error">
            <p className="text-sm text-muted-foreground" role="status">
              {t('verification.metrics.unavailable')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              {t('verification.metrics.retry')}
            </Button>
          </div>
        )}
        {data && (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label={t('verification.metrics.ok')} value={String(data.ok)} testId="verification-metric-ok" />
            <Figure label={t('verification.metrics.review')} value={String(data.review)} testId="verification-metric-review" />
            <Figure label={t('verification.metrics.notOk')} value={String(data.notOk)} testId="verification-metric-not-ok" />
            <Figure
              label={t('verification.metrics.operatorShare')}
              value={percentOf(data.operatorShare, i18n.language)}
              hint={t('verification.metrics.operatorDecisions', { count: data.operatorDecisions })}
              testId="verification-metric-operator-share"
            />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
