import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { PAGE_COLUMNS } from '@/components/layout/page-columns';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { OperatorTypeSection } from '@/features/profile/components/operator-type-section';
import { ProfileInfo } from '@/features/profile/components/profile-info';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { useMe } from '@/queries/use-users';
import { accountRoleLabel } from './account-roles';

export function AccountProfilePage() {
  const { t } = useTranslation();
  const { isLoading, user } = useAuth();
  const { contexts } = useWorkspace();
  const { data: profile, isLoading: profileLoading } = useMe();

  if (isLoading || profileLoading || !user) {
    return <LoadingScreen className="h-auto flex-1" />;
  }

  const roleKey = contexts.find((context) => context.contextKey === 'account')?.roleKey;
  const displayName = user.name || [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || undefined;
  const profileUser = {
    ...user,
    name: displayName,
    email: user.email || profile?.email,
    role: accountRoleLabel(roleKey, t),
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('profile.title')} description={t('profile.description')} />

      <div className={PAGE_COLUMNS}>
        <ProfileInfo user={profileUser} />
        {roleKey === 'org_owner' ? <OperatorTypeSection /> : null}
      </div>
    </div>
  );
}
