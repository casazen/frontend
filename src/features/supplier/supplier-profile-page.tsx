import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useSupplierProfile } from '@/queries/use-supplier';

export function SupplierProfilePage() {
  const { data: profile, isLoading } = useSupplierProfile();

  if (isLoading || !profile) {
    return <LoadingScreen message="Caricamento profilo..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profilo fornitore" description="Dati visibili ai host nel picker" />
      <Card>
        <CardHeader>
          <CardTitle>{profile.legalName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Stato: {profile.status}</p>
          <p>Email: {profile.email}</p>
          <p>Telefono: {profile.phone}</p>
          <p>Categorie: {(profile.categories ?? []).join(', ') || '—'}</p>
          <p>Comuni: {(profile.comuni ?? []).join(', ') || '—'}</p>
          {profile.bio ? <p className="pt-2">{profile.bio}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
