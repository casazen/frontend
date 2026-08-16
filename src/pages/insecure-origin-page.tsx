import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Auth0 SPA requires a secure origin (https or localhost).
 * Shown when the host console is opened via http://LAN-IP.
 */
export function InsecureOriginPage() {
  const httpsUrl = `https://${window.location.host}${window.location.pathname}${window.location.search}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Origine non sicura</CardTitle>
          <CardDescription>
            Auth0 richiede HTTPS (o localhost). Apri la console host con un URL sicuro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Stai usando <code className="rounded bg-muted px-1">{window.location.origin}</code>, che non
            è un&apos;origine sicura per Web Crypto.
          </p>
          <p>
            Per lo sviluppo in LAN avvia Vite con HTTPS e apri:{' '}
            <a className="font-medium text-primary underline" href={httpsUrl}>
              {httpsUrl}
            </a>
          </p>
          <p>
            I siti di prenotazione pubblica (<code className="rounded bg-muted px-1">/book/...</code>)
            non usano Auth0 e funzionano anche su HTTP.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
