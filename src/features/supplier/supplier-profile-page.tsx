import { ContactRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ServicePageHeader } from '@/features/supplier/components/service-page-header';
import { PAGE_COLUMNS_WIDE } from '@/components/layout/page-columns';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonLine } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useSupplierActivation, useSupplierProfile } from '@/queries/supplier/use-profile';
import { useSupplierHours } from '@/queries/supplier/use-calendar';
import { ProfileFocus } from './profile/profile-focus';
import { ProfileForm } from './profile/profile-form';
import { focusHoursSection } from './profile/hours-section';
import { ProfileHours } from './profile/profile-hours';
import { ProfilePayments } from './profile/profile-payments';
import { ProfilePhotos } from './profile/profile-photos';

export function SupplierProfilePage() {
  const { t } = useTranslation();
  const { data: profile, isLoading, isError, error, refetch } = useSupplierProfile();
  const activation = useSupplierActivation();
  const hours = useSupplierHours();

  // An API error is not an endless spinner (SU-06, A4-25): say it failed and offer a retry. A refresh that fails under a profile that
  // is already on screen leaves the page as it is: what was typed in it must not be lost.
  if (isError && !profile) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ServicePageHeader icon={ContactRound} title={t('supplier.profileTitle')} description={t('supplier.profileDescription')} crumbs="auto" />
        <ErrorState testId="supplier-profile-error" title={t('supplier.profileLoadError')} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (isLoading || !profile) {
    return (
      <div className="w-full min-w-0 space-y-6" data-testid="supplier-profile-loading" aria-busy="true">
        <ServicePageHeader icon={ContactRound} title={t('supplier.profileTitle')} crumbs="auto" />
        <SkeletonLine lines={8} label={t('supplier.profileLoading')} />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-8" data-testid="supplier-profile-page">
      <ServicePageHeader icon={ContactRound} title={t('supplier.profileTitle')} description={t('supplier.profileDescription')} crumbs="auto" />
      <ProfileFocus
        profile={profile}
        activation={activation.data}
        hoursConfigured={hours.data ? hours.data.days.some((day) => day.bands.length > 0) : undefined}
        settled={!activation.isPending && !hours.isPending}
        onSetHours={focusHoursSection}
      />
      <div className={cn(PAGE_COLUMNS_WIDE, 'gap-8')}>
        <ProfileForm profile={profile} />
        <div className="min-w-0 space-y-8">
          <ProfilePhotos profile={profile} />
          <ProfileHours />
          <ProfilePayments />
        </div>
      </div>
    </div>
  );
}
