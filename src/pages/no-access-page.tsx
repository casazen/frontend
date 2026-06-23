import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

export function NoAccessPage() {
  const { forceReauth } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle>Nessun accesso disponibile</CardTitle>
          <CardDescription>
            Il tuo account non e associato ad alcun workspace operativo. Esci e accedi di nuovo, oppure
            contatta l&apos;amministratore per l&apos;assegnazione dei ruoli.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => forceReauth()}>Accedi di nuovo</Button>
        </CardContent>
      </Card>
    </div>
  );
}
