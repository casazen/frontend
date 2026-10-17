import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { PAGE_COLUMNS } from '@/components/layout/page-columns';
import { ProfileInfo } from './components/profile-info';
import { OperatorTypeSection } from './components/operator-type-section';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAuth } from '@/hooks/use-auth';

export function ProfileContentPage() {
  const { t } = useTranslation();
  const { isLoading, user } = useAuth();

  if (isLoading || !user) {
    return <LoadingScreen className="h-auto flex-1" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('profile.title')}
        description={t('profile.description')}
      />

      <div className={PAGE_COLUMNS}>
        <ProfileInfo user={user} />
        <OperatorTypeSection />
      </div>
    </div>
  );
}
