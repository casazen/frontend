import { PageHeader } from '@/components/layout/page-header';
import { ProfileInfo } from '@/features/profile/components/profile-info';
import { ApiAccessTokenCard } from '@/features/profile/components/api-access-token-card';
import { OperatorTypeSection } from '@/features/profile/components/operator-type-section';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAuth } from '@/hooks/use-auth';
import { useUserRoles } from '@/hooks/use-user-roles';
import { useMe } from '@/queries/use-users';
import { ROLE_ADMIN } from '@/lib/auth-roles';

export function AdminProfilePage() {
  const { isLoading, user } = useAuth();
  const roles = useUserRoles();
  const { data: profile, isLoading: profileLoading } = useMe();

  if (isLoading || profileLoading || !user) {
    return <LoadingScreen />;
  }

  const displayRole = roles.includes(ROLE_ADMIN)
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
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Profilo utente"
        description="Informazioni account e strumenti per il test API"
      />

      <ProfileInfo user={profileUser} />
      {roles.includes(ROLE_ADMIN) ? <ApiAccessTokenCard /> : null}
      <OperatorTypeSection />
    </div>
  );
}
