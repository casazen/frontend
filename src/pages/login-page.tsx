import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CasaZenMark } from '@/components/brand/casazen-mark';
import { LogIn } from 'lucide-react';

export function LoginPage() {
  const { isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/app/choose-context', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  return (
    // The brand's warm terracotta tint into its ink tint (the primitives of tokens.css), in place of the generic blue.
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fff7f2] via-[#fbfaf8] to-[#e9f1f0] px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CasaZenMark size={72} className="mx-auto mb-4" />
          {/* "CASAZEN" in the text of the translation, shown as the lowercase wordmark of the logo. */}
          <CardTitle className="text-3xl font-semibold lowercase tracking-[-0.03em] text-[#1f3a3d]">{t('login.brand')}</CardTitle>
          <CardDescription>{t('login.platformDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            {t('login.signInMessage')}
          </p>
          <Button onClick={() => login()} className="w-full" size="lg">
            <LogIn className="mr-2 h-5 w-5" />
            {t('login.signInButton')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
