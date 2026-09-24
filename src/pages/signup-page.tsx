import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { captureSignupAttribution } from '@/lib/signup-attribution';

/** Auth0 Universal Login parameter that opens the signup screen instead of the login one. */
const SIGNUP_SCREEN = { screen_hint: 'signup' } as const;

/**
 * `/signup` (SE-03, A8-03): the entry point of the CTA of the public pages. It stores the attribution of the visit
 * (UTM parameters, comune, landing page, referrer host) and opens the Auth0 signup screen right away: one click on the
 * CTA, no intermediate login page. An account already signed in goes to its area. The button is the way back in when
 * the visitor returns here (browser Back) or the redirect did not start.
 */
export function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { isLoading, isAuthenticated, login } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    captureSignupAttribution({ pathname, search, origin: window.location.origin });
  }, [pathname, search]);

  useEffect(() => {
    if (isLoading || started.current) return;
    started.current = true;
    if (isAuthenticated) {
      // Existing session: not a new signup (the onboarding guard forgets the attribution).
      navigate('/', { replace: true });
      return;
    }
    login({ authorizationParams: SIGNUP_SCREEN });
  }, [isLoading, isAuthenticated, login, navigate]);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4"
      data-testid="signup-page"
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Home className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">{t('signup.title')}</CardTitle>
          <CardDescription>{t('signup.redirecting')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <Button
            className="w-full"
            size="lg"
            disabled={isLoading}
            onClick={() => login({ authorizationParams: SIGNUP_SCREEN })}
            data-testid="signup-continue"
          >
            <UserPlus className="mr-2 h-5 w-5" />
            {t('signup.continue')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
