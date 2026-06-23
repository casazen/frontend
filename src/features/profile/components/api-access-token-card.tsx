import { useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { env } from '@/config/env.config';

function getSwaggerUrl(): string {
  const apiRoot = env.api.baseUrl.replace(/\/api\/?$/, '');
  return `${apiRoot}/swagger`;
}

export function ApiAccessTokenCard() {
  const { refreshAccessToken } = useAuth();
  const [isCopying, setIsCopying] = useState(false);
  const swaggerUrl = getSwaggerUrl();

  const handleCopyToken = async () => {
    setIsCopying(true);
    try {
      const token = await refreshAccessToken();
      if (!token) {
        toast.error('Token non disponibile. Effettua di nuovo il login.');
        return;
      }
      await navigator.clipboard.writeText(token);
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
        <CardTitle>Token API (Swagger)</CardTitle>
        <CardDescription>
          Copia il Bearer token della sessione corrente per testare le API in Swagger.
          Non condividere il token: contiene i tuoi permessi di accesso.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => void handleCopyToken()} disabled={isCopying}>
          <Copy className="mr-2 h-4 w-4" />
          {isCopying ? 'Copia in corso...' : 'Copia token'}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <a href={swaggerUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Apri Swagger
          </a>
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          In Swagger: Authorize → incolla il token (con o senza prefisso <code>Bearer </code>).
        </p>
      </CardContent>
    </Card>
  );
}
