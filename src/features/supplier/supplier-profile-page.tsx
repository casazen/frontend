import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useSupplierActivation, useSupplierHours, useSupplierProfile } from '@/queries/use-supplier';
import { ProfileFocus } from './profile/profile-focus';
import { ProfileForm } from './profile/profile-form';
import { focusHoursSection } from './profile/hours-section';
import { ProfileHours } from './profile/profile-hours';
import { ProfilePayments } from './profile/profile-payments';
import { ProfilePhotos } from './profile/profile-photos';

/**
 * The profile of the supplier (SU-04, restyle SP-16c): where the profile stands and the one thing left to make it fully active
 * (the one highlighted block), then the data of the business, what it does and where, the presentation, the photos and the working
 * hours, each part with its own save and no box around it, and at the end the way to the payments account (SP-16c-b). The same endpoints
 * and rules as before; what has no endpoint yet (notifications, automatic acceptance, the "Verificato" checklist) is not here.
 */
export function SupplierProfilePage() {
  const { t } = useTranslation();
  const { data: profile, isLoading, isError, error, refetch } = useSupplierProfile();
  const activation = useSupplierActivation();
  const hours = useSupplierHours();

  // An API error is not an endless spinner (SU-06, A4-25): say it failed and offer a retry. A refresh that fails under a profile that
  // is already on screen leaves the page as it is: what was typed in it must not be lost.
  if (isError && !profile) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
        <PageHeader title={t('supplier.profileTitle')} description={t('supplier.profileDescription')} crumbs="auto" />
        <ErrorState testId="supplier-profile-error" title={t('supplier.profileLoadError')} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (isLoading || !profile) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6" data-testid="supplier-profile-loading" aria-busy="true">
        <PageHeader title={t('supplier.profileTitle')} crumbs="auto" />
        <SkeletonLine lines={8} label={t('supplier.profileLoading')} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-8" data-testid="supplier-profile-page">
      <PageHeader title={t('supplier.profileTitle')} description={t('supplier.profileDescription')} crumbs="auto" />
      <ProfileFocus
        profile={profile}
        activation={activation.data}
        hoursConfigured={hours.data ? hours.data.days.some((day) => day.bands.length > 0) : undefined}
        settled={!activation.isPending && !hours.isPending}
        onSetHours={focusHoursSection}
      />
      <ProfileForm profile={profile} />
      <ProfilePhotos profile={profile} />
      <ProfileHours />
      <ProfilePayments />
    </div>
  );
}
