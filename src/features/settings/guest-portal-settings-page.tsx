import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PropertySetupSelection } from '@/features/onboarding/components/guest-portal-setup';

export function GuestPortalSettingsPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  return (
    <AppShell>
      <div className="workspace-page space-y-5">
        <PageHeader title={t('guestPortal.setup.title')} crumbs="auto" />
        <div className="max-w-4xl">
          <PropertySetupSelection initialPropertyId={params.get('propertyId') ?? undefined} />
        </div>
      </div>
    </AppShell>
  );
}
