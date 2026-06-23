import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerSupplier } from '@/services/supplier-api';
import { Home, Loader2 } from 'lucide-react';

export function SupplierRegisterPage() {
  const [searchParams] = useSearchParams();
  const { loginWithRedirect } = useAuth0();

  const inviteToken = searchParams.get('inviteToken') ?? '';
  const emailFromUrl = searchParams.get('email') ?? '';
  const comuneFromUrl = searchParams.get('comune') ?? '';

  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!legalName.trim() || !phone.trim()) {
      setError('Compila tutti i campi obbligatori.');
      return;
    }

    setSubmitting(true);
    try {
      await registerSupplier({
        email: emailFromUrl,
        legalName: legalName.trim(),
        phone: phone.trim(),
        comuneCode: comuneFromUrl,
        inviteToken: inviteToken || undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Errore durante la registrazione. Riprova.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoToAuth0() {
    void loginWithRedirect({
      authorizationParams: {
        screen_hint: 'signup',
        login_hint: emailFromUrl,
      },
    });
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <CardTitle className="text-2xl">Registrazione completata</CardTitle>
            <CardDescription>
              Il tuo profilo fornitore è stato creato. Ora crea il tuo account per accedere alla piattaforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGoToAuth0} className="w-full" size="lg">
              Crea il tuo account
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Dopo aver creato l'account, potrai accedere alla console fornitore e alla web app.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Home className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Registrazione Fornitore</CardTitle>
          <CardDescription>
            Sei stato invitato su CasaZen. Compila il form per registrarti.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={emailFromUrl}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comune">Comune</Label>
              <Input
                id="comune"
                value={comuneFromUrl}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="legalName">Nome attività / Ragione sociale *</Label>
              <Input
                id="legalName"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Es. Impresa di Pulizie Rossi"
                required
                maxLength={300}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefono *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Es. +39 123 456 7890"
                required
                maxLength={50}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Registrazione in corso...
                </>
              ) : (
                'Completa la registrazione'
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Hai già un account?{' '}
            <Link to="/login" className="text-primary underline">
              Accedi
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
