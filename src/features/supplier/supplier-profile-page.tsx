import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { ProfileInfo } from '@/features/profile/components/profile-info';
import { useAuth } from '@/hooks/use-auth';
import { useUserRoles } from '@/hooks/use-user-roles';
import { useSupplierProfile } from '@/queries/use-supplier';
import { useMe } from '@/queries/use-users';

export function SupplierProfilePage() {
  const { isLoading: authLoading, user } = useAuth();
  const roles = useUserRoles();
  const { data: account, isLoading: accountLoading } = useMe();
  const { data: profile, isLoading: profileLoading } = useSupplierProfile();

  if (authLoading || accountLoading || profileLoading || !user || !profile) {
    return <LoadingScreen message="Caricamento profilo..." />;
  }

  const displayName =
    profile.legalName ||
    user.name ||
    [account?.firstName, account?.lastName].filter(Boolean).join(' ') ||
    'Fornitore';
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
      <PageHeader title="Profilo fornitore" description="Account e dati visibili ai host nel picker" />
      <ProfileInfo user={profileUser} />
      <Card>
        <CardHeader>
          <CardTitle>Profilo professionale</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Stato: {profile.status || '—'}</p>
          <p>Ragione sociale: {displayName}</p>
          <p>Email: {displayEmail}</p>
          <p>Telefono: {displayPhone}</p>
          <p>Categorie: {(profile.categories ?? []).join(', ') || '—'}</p>
          <p>Comuni: {(profile.comuni ?? []).join(', ') || '—'}</p>
          {profile.bio ? <p className="pt-2">{profile.bio}</p> : <p className="text-muted-foreground">Bio non ancora compilata.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
