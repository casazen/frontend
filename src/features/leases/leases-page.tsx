import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, FileText, Plus } from 'lucide-react';
import { LONG_RENT_PROPERTIES_PATH, LONG_RENT_PROPERTY_CREATE_PATH } from '@/features/properties/long-rent/paths';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeases } from '@/queries/use-leases';
import { LongRentGuide } from '@/features/onboarding/components/long-rent-guide';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getProblemMessage } from '@/lib/api-errors';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { getLeaseTypeAndRegimeLabel } from '@/lib/i18n-labels';
import type { LeaseSummary } from '@/types';

const START_STEPS = [
  { key: 'property', href: LONG_RENT_PROPERTY_CREATE_PATH },
  { key: 'ape', href: LONG_RENT_PROPERTIES_PATH },
  { key: 'lease', href: '/app/long-rent/leases/new' },
] as const;

/** First visit with no contracts: the three steps, in order, instead of a single "create" button. */
function LongRentStartGuide() {
  const { t } = useTranslation();

  return (
    <ol className="mx-auto grid max-w-2xl gap-3 text-left" data-testid="long-rent-start-guide">
      {START_STEPS.map((step, index) => (
        <li key={step.key} className="flex gap-3 rounded-lg border bg-card p-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {index + 1}
          </span>
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{t(`leases.guide.${step.key}.title`)}</p>
            <p className="text-sm text-muted-foreground">{t(`leases.guide.${step.key}.description`)}</p>
            <Button variant={index === 0 ? 'default' : 'outline'} size="sm" asChild>
              <Link to={step.href}>{t(`leases.guide.${step.key}.cta`)}</Link>
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}

function getPropertyLabel(lease: LeaseSummary): string {
  return lease.property?.name ?? lease.propertyId.slice(0, 8);
}

export function LeasesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: leases, isLoading, isError, error, refetch, isFetching } = useLeases();

  const goToCreate = () => navigate('/app/long-rent/leases/new');

  const header = (
    <PageHeader
      title={t('leases.pageTitle')}
      description={t('leases.pageDescription')}
      action={
        <Button onClick={goToCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('leases.createLease')}
        </Button>
      }
    />
  );

  if (isLoading) {
    return <LoadingScreen message={t('leases.loading')} className="h-auto flex-1" />;
  }

  // A failed load is never shown as "no leases" (A7-27).
  if (isError || !leases) {
    return (
      <div className="space-y-6">
        {header}
        <Card role="alert" data-testid="leases-load-error">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{getProblemMessage(error, t) ?? t('leases.loadError')}</p>
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              {t('leases.retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <LongRentGuide />

      {leases.length === 0 ? (
        <div className="space-y-6">
          <EmptyState
            icon={FileText}
            title={t('leases.emptyTitle')}
            description={t('leases.guide.intro')}
            action={{
              label: t('leases.guide.property.cta'),
              href: LONG_RENT_PROPERTY_CREATE_PATH,
            }}
          />
          <LongRentStartGuide />
        </div>
      ) : (
        <div className="grid gap-4">
          {leases.map((lease) => (
            <Card
              key={lease.id}
              data-testid="lease-card"
              className="cursor-pointer transition-colors hover:bg-muted/40"
              onClick={() => navigate(`/app/long-rent/leases/${lease.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">{getPropertyLabel(lease)}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(lease.startDate)} — {formatDate(lease.endDate)}
                  </p>
                </div>
                <StatusBadge kind="lease" status={lease.status} />
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('leases.rentLabel')}</span>
                  <span className="font-medium">
                    {t('leases.monthlyRentValue', { amount: formatCurrency(lease.monthlyRent) })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('leases.regimeLabel')}</span>
                  <span className="font-medium">{getLeaseTypeAndRegimeLabel(lease, t)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('leases.partiesLabel')}</span>
                  <span className="font-medium">{lease.partyCount}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
