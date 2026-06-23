import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { ProfileInfo } from './components/profile-info';
import { OperatorTypeSection } from './components/operator-type-section';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAuth } from '@/hooks/use-auth';

export function ProfileContentPage() {
  const { t } = useTranslation();
  const { isLoading, user } = useAuth();

  if (isLoading || !user) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title={t('profile.title')}
        description={t('profile.description')}
      />

      <ProfileInfo user={user} />
      <OperatorTypeSection />
    </div>
  );
}
