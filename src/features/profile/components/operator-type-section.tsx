import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMe } from '@/queries/use-users';
import { RENTAL_TYPE_LABELS } from '@/lib/onboarding';
import type { RentalType } from '@/types';

export function OperatorTypeSection() {
  const { data: profile, isLoading } = useMe();

  const label = profile?.rentalType
    ? RENTAL_TYPE_LABELS[profile.rentalType as RentalType]
    : 'Non configurato';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Tipo di operatore</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link to="/onboarding?mode=edit">Modifica tipo</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Tipo attuale</p>
        <p className="font-medium">{isLoading ? 'Caricamento...' : label}</p>
      </CardContent>
    </Card>
  );
}
