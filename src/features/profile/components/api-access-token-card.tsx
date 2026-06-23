import { useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { copyTextToClipboard } from '@/lib/utils';

export function ApiAccessTokenCard() {
  const { getAccessToken, refreshAccessToken } = useAuth();
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyToken = async () => {
    setIsCopying(true);
    try {
      let token: string | undefined;
      try {
        token = await getAccessToken();
      } catch {
        token = await refreshAccessToken();
      }

      if (!token) {
        toast.error('Token non disponibile. Effettua di nuovo il login.');
        return;
      }

      await copyTextToClipboard(token);
      toast.success('Token copiato negli appunti');
    } catch {
      toast.error('Impossibile copiare il token');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token API</CardTitle>
        <CardDescription>
          Copia il Bearer token della sessione corrente per testare le API (es. Swagger locale).
          Non condividere il token: contiene i tuoi permessi di accesso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button type="button" variant="outline" onClick={() => void handleCopyToken()} disabled={isCopying}>
          <Copy className="mr-2 h-4 w-4" />
          {isCopying ? 'Copia in corso...' : 'Copia token'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Incolla il token in Authorize (con o senza prefisso <code>Bearer </code>).
        </p>
      </CardContent>
    </Card>
  );
}
