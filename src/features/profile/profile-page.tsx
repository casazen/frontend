import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ProfileInfo } from './components/profile-info';
import { OperatorTypeSection } from './components/operator-type-section';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAuth } from '@/hooks/use-auth';
import { useMe } from '@/queries/use-users';
import { getUserRoles } from '@/lib/auth-roles';

export function ProfilePage() {
  const { isLoading, user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useMe();

  if (isLoading || profileLoading || !user) {
    return <LoadingScreen />;
  }

  const roles = getUserRoles(user);
  const displayRole = roles.includes('Admin')
    ? 'Admin'
    : roles[0] ?? profile?.role ?? 'User';
  const displayName =
    user.name ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
    undefined;

  const profileUser = {
    ...user,
    name: displayName,
    email: user.email || profile?.email,
    role: displayRole,
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto">
        <PageHeader
          title="My Profile"
          description="View and manage your account information"
        />

        <ProfileInfo user={profileUser} />
        <OperatorTypeSection />
      </div>
    </AppShell>
  );
}
