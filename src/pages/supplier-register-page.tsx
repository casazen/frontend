import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { registerSupplier } from '@/services/supplier-api';
import { Home, Loader2 } from 'lucide-react';

export function SupplierRegisterPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

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
      setError(t('supplier.register.errorFields'));
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
          : t('supplier.register.errorGeneric');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoToAuth0() {
    login({
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
            <CardTitle className="text-2xl">{t('supplier.register.successTitle')}</CardTitle>
            <CardDescription>
              {t('supplier.register.successDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGoToAuth0} className="w-full" size="lg">
              {t('supplier.register.createAccount')}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t('supplier.register.afterAccount')}
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
          <CardTitle className="text-2xl">{t('supplier.register.title')}</CardTitle>
          <CardDescription>
            {t('supplier.register.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('supplier.register.email')}</Label>
              <Input
                id="email"
                type="email"
                value={emailFromUrl}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comune">{t('supplier.register.comune')}</Label>
              <Input
                id="comune"
                value={comuneFromUrl}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="legalName">{t('supplier.register.legalName')}</Label>
              <Input
                id="legalName"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder={t('supplier.register.legalNamePlaceholder')}
                required
                maxLength={300}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('supplier.register.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('supplier.register.phonePlaceholder')}
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
                  {t('supplier.register.registering')}
                </>
              ) : (
                t('supplier.register.complete')
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t('supplier.register.existingAccount')}{' '}
            <Link to="/login" className="text-primary underline">
              {t('supplier.register.login')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
