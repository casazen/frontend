import { PageHeader } from '@/components/layout/page-header';
import { ProfileInfo } from '@/features/profile/components/profile-info';
import { ApiAccessTokenCard } from '@/features/profile/components/api-access-token-card';
import { OperatorTypeSection } from '@/features/profile/components/operator-type-section';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { useUserRoles } from '@/hooks/use-user-roles';
import { useMe } from '@/queries/use-users';
import { ROLE_ADMIN } from '@/lib/auth-roles';

export function AdminProfilePage() {
  const { t } = useTranslation();
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
        title={t('admin.profile.title')}
        description={t('admin.profile.description')}
      />

      <ProfileInfo user={profileUser} />
      {roles.includes(ROLE_ADMIN) ? <ApiAccessTokenCard /> : null}
      <OperatorTypeSection />
    </div>
  );
}
