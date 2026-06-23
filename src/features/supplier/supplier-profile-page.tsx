import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { ProfileInfo } from '@/features/profile/components/profile-info';
import { useAuth } from '@/hooks/use-auth';
import { useUserRoles } from '@/hooks/use-user-roles';
import { useSupplierProfile } from '@/queries/use-supplier';
import { useMe } from '@/queries/use-users';

export function SupplierProfilePage() {
  const { t } = useTranslation();
  const { isLoading: authLoading, user } = useAuth();
  const roles = useUserRoles();
  const { data: account, isLoading: accountLoading } = useMe();
  const { data: profile, isLoading: profileLoading } = useSupplierProfile();

  if (authLoading || accountLoading || profileLoading || !user || !profile) {
    return <LoadingScreen message={t('supplier.profileLoading')} />;
  }

  const displayName =
    profile.legalName ||
    user.name ||
    [account?.firstName, account?.lastName].filter(Boolean).join(' ') ||
    t('supplier.supplierDefault');
  const displayEmail = profile.email || user.email || account?.email || '—';
  const displayPhone = profile.phone || account?.phoneNumber || '—';
  const displayRole = roles.includes('Supplier') ? 'Supplier' : roles[0] ?? 'Supplier';

  const profileUser = {
    ...user,
    name: displayName,
    email: displayEmail,
    role: displayRole,
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('supplier.profileTitle')} description={t('supplier.profileDescription')} />
      <ProfileInfo user={profileUser} />
      <Card>
        <CardHeader>
          <CardTitle>{t('supplier.professionalProfile')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('supplier.status')}: {profile.status || '—'}</p>
          <p>{t('supplier.companyName')}: {displayName}</p>
          <p>{t('supplier.email')}: {displayEmail}</p>
          <p>{t('supplier.phone')}: {displayPhone}</p>
          <p>{t('supplier.categories')}: {(profile.categories ?? []).join(', ') || '—'}</p>
          <p>{t('supplier.municipalities')}: {(profile.comuni ?? []).join(', ') || '—'}</p>
          {profile.bio ? <p className="pt-2">{profile.bio}</p> : <p className="text-muted-foreground">{t('supplier.bioEmpty')}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
