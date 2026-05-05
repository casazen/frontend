import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ProfileInfo } from './components/profile-info';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAuth } from '@/hooks/use-auth';

export function ProfilePage() {
  const { isLoading, user } = useAuth();

  if (isLoading || !user) {
    return <LoadingScreen />;
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto">
        <PageHeader
          title="My Profile"
          description="View and manage your account information"
        />

        <ProfileInfo user={user} />
      </div>
    </AppShell>
  );
}
