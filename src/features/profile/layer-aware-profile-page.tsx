import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { LongTermAppShell } from '@/components/layout/long-term-app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAppLayerContext } from '@/hooks/use-app-layer-context';
import { ProfileInfo } from './components/profile-info';
import { useAuth } from '@/hooks/use-auth';

function ProfileContent() {
  const { isLoading, user } = useAuth();
  const { t } = useTranslation();

  if (isLoading || !user) {
    return <LoadingScreen />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t('profile.title')}
        description={t('profile.description')}
      />
      <ProfileInfo user={user} />
    </div>
  );
}

export function LayerAwareProfilePage() {
  const { effectiveLayer } = useAppLayerContext();

  if (effectiveLayer === 'long-term') {
    return (
      <LongTermAppShell>
        <ProfileContent />
      </LongTermAppShell>
    );
  }

  return (
    <AppShell>
      <ProfileContent />
    </AppShell>
  );
}
