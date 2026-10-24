import { useTranslation } from 'react-i18next';
import { Building2, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { LongRentGuide } from '@/features/onboarding/components/long-rent-guide';
import { LONG_RENT_PROPERTY_CREATE_PATH } from '@/features/properties/long-rent/paths';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { useLongRentDeadlines, useLongRentOverview } from '@/queries/use-long-rent-agenda';
import { useCurrentUser } from '@/queries/use-users';
import type { LongRentOverview } from '@/types';
import { overviewWindow } from '../deadlines/deadlines-model';
import { monthOfDate } from '../lib/rent-register';
import { ContractGroups } from './contract-groups';
import { NowBlock } from './now-block';
import { contractsTotal } from './overview-model';
import { RentNumbers } from './rent-numbers';
import { UpcomingDeadlines } from './upcoming-deadlines';

const LEASE_CREATE_PATH = '/app/long-rent/leases/new';

/** What follows «Adesso», in the order it is read: the leases by group, the rent of the month, the next dates. */
function OverviewBody({ overview, today }: { overview: LongRentOverview; today: string }) {
  const deadlines = useLongRentDeadlines(overviewWindow(today));

  return (
    <div className="space-y-8">
      <NowBlock now={overview.now ?? null} today={today} />
      <ContractGroups leases={overview.leases} />
      <RentNumbers rents={overview.rents} rentMonth={overview.rentMonth} currentMonth={monthOfDate(today)} />
      <UpcomingDeadlines
        deadlines={deadlines.data}
        isError={deadlines.isError}
        onRetry={() => void deadlines.refetch()}
        today={today}
      />
    </div>
  );
}

/**
 * The home of the long-term area (LR-05): «in five seconds I know what to do». One colored block, «Adesso», with the step of
 * the landlord that cannot wait; then, quiet, the leases by group, the rent of the month and the next dates. Every number and
 * every step comes from the server (`GET /long-rent/overview`, `GET /long-rent/deadlines`), the page works none out. With no
 * lease at all it is the guide of the first steps (`LongRentGuide`) and nothing else.
 */
export function LongRentOverviewPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { user } = useCurrentUser();
  const overview = useLongRentOverview();
  const data = overview.data;

  const today = todayInRome();
  const firstName = user?.firstName?.trim();
  const day = formatStayDate(today, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });
  const canCreate = hasPermission('long-rent', 'lease.create');
  const canAddProperty = hasPermission('long-rent', 'property.write');

  return (
    <div className="min-w-0 space-y-6 md:space-y-8" data-testid="long-rent-overview">
      <PageHeader
        title={firstName ? t('longRentOverview.title', { name: firstName }) : t('longRentOverview.titleNoName')}
        description={t('longRentOverview.description', { date: day.charAt(0).toLocaleUpperCase(i18n.language) + day.slice(1) })}
        primary={
          canCreate ? { label: t('longRentOverview.actions.createLease'), icon: Plus, to: LEASE_CREATE_PATH, testId: 'long-rent-overview-new-lease' } : undefined
        }
        secondary={
          canAddProperty ? [{ label: t('longRentOverview.actions.addProperty'), icon: Building2, to: LONG_RENT_PROPERTY_CREATE_PATH }] : undefined
        }
        mobilePrimary="fab"
      />

      {data ? (
        contractsTotal(data.leases) > 0 ? <OverviewBody overview={data} today={today} /> : <LongRentGuide />
      ) : overview.isError ? (
        <ErrorState
          title={t('longRentOverview.loadError')}
          error={overview.error}
          onRetry={() => void overview.refetch()}
          testId="long-rent-overview-error"
        />
      ) : (
        <SkeletonCard lines={4} label={t('longRentOverview.loading')} />
      )}
    </div>
  );
}
