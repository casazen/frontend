import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function NoAccessPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle>Nessun accesso disponibile</CardTitle>
          <CardDescription>
            Il tuo account non e associato ad alcun workspace operativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/login', { replace: true })}>Torna al login</Button>
        </CardContent>
      </Card>
    </div>
  );
}
