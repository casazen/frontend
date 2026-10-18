import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { Home, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { getProblemMessage, isTransientRequestError } from '@/lib/api-errors';
import {
  acceptHostInviteOnce,
  clearPendingHostInvite,
  hostInvitePath,
  isWellFormedHostInviteToken,
  savePendingHostInvite,
} from '@/lib/host-invite';
import { useHostInviteLookup } from '@/queries/use-host-invites';

/** Where the invited person goes once the invite is bound: the guard of the app sends a new account to the onboarding. */
const AFTER_ACCEPT_PATH = '/';

type UnusableState = 'invalid' | 'expired' | 'revoked' | 'used';

/** The reason a link cannot be used, from the `state` of the lookup (anything unknown counts as invalid). */
function unusableState(state: string | null | undefined): UnusableState {
  switch (state?.toLowerCase()) {
    case 'expired':
      return 'expired';
    case 'revoked':
      return 'revoked';
    case 'used':
      return 'used';
    default:
      return 'invalid';
  }
}

/**
 * `/invito-host/:token`: the page of the link in the email that invites an independent host. It says who invited and
 * leads to the normal signup or login (the invite gives no role); the token waits in the session storage of the tab,
 * and once the person is signed in the invite is accepted exactly once (`POST /host-invites/accept`) and forgotten.
 * Outside the onboarding guard, like the supplier registration, so a new account is never sent to the onboarding before
 * the invite is bound. The token is never logged, tracked or shown; the invited email only masked.
 */
export function HostInvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const wellFormed = isWellFormedHostInviteToken(token);
  return wellFormed ? <InviteFlow token={token} /> : <UnusableInvite reason="invalid" />;
}

function InviteFlow({ token }: { token: string }) {
  const { t } = useTranslation();
  const { isLoading: authLoading, isAuthenticated, login } = useAuth();
  const lookup = useHostInviteLookup(token);
  const valid = lookup.data?.valid === true;

  // A link that is no longer usable leaves nothing behind.
  useEffect(() => {
    if (lookup.data && !lookup.data.valid) clearPendingHostInvite();
  }, [lookup.data]);

  // The token waits for the signup or login (and for the return to this page, which also carries it).
  useEffect(() => {
    if (valid && !isAuthenticated && !authLoading) savePendingHostInvite(token);
  }, [valid, isAuthenticated, authLoading, token]);

  if (lookup.isPending || authLoading) return <LoadingCard message={t('hostInvite.loading')} />;

  if (lookup.isError) {
    // A refusal of the lookup (4xx) says the link does not work; only a failure to reach the server is worth a retry.
    if (isAxiosError(lookup.error) && lookup.error.response && !isTransientRequestError(lookup.error)) {
      return <UnusableInvite reason="invalid" />;
    }
    return (
      <InviteLayout title={t('hostInvite.errorTitle')}>
        <p role="alert" className="text-sm text-destructive">
          {getProblemMessage(lookup.error, t) ?? t('hostInvite.errorGeneric')}
        </p>
        <Button className="w-full" variant="outline" onClick={() => void lookup.refetch()}>
          {t('hostInvite.retry')}
        </Button>
      </InviteLayout>
    );
  }

  const data = lookup.data;
  if (!data.valid) return <UnusableInvite reason={unusableState(data.state)} />;

  if (isAuthenticated) return <AcceptInvite token={token} inviterName={data.inviterName} />;

  const returnTo = hostInvitePath(token);
  const inviter = data.inviterName?.trim();
  return (
    <InviteLayout
      title={inviter ? t('hostInvite.invitedBy', { name: inviter }) : t('hostInvite.invited')}
      description={t('hostInvite.description')}
    >
      {data.maskedEmail && (
        <p className="rounded-md bg-muted p-3 text-sm" data-testid="host-invite-masked-email">
          {t('hostInvite.forEmail', { email: data.maskedEmail })}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{t('hostInvite.useSameEmail')}</p>
      <Button
        className="w-full"
        size="lg"
        onClick={() => login({ returnTo, authorizationParams: { screen_hint: 'signup' } })}
        data-testid="host-invite-signup"
      >
        {t('hostInvite.signup')}
      </Button>
      <Button className="w-full" variant="outline" onClick={() => login({ returnTo })} data-testid="host-invite-login">
        {t('hostInvite.login')}
      </Button>
    </InviteLayout>
  );
}

/** Signed in: binds the invite once, then goes on to the app. */
function AcceptInvite({ token, inviterName }: { token: string; inviterName?: string | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const started = useRef(false);
  const [status, setStatus] = useState<'pending' | 'done' | 'error'>('pending');
  const [error, setError] = useState<unknown>(null);

  const run = () => {
    setStatus('pending');
    void acceptHostInviteOnce(token).then((outcome) => {
      if (outcome.ok) {
        setStatus('done');
      } else {
        setError(outcome.error);
        setStatus('error');
      }
    });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
    // Once per mount: `run` only reads `token`, which is the page's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'pending') return <LoadingCard message={t('hostInvite.accepting')} />;

  if (status === 'done') {
    return (
      <InviteLayout
        title={t('hostInvite.acceptedTitle')}
        description={
          inviterName?.trim() ? t('hostInvite.acceptedWithInviter', { name: inviterName.trim() }) : t('hostInvite.accepted')
        }
        success
      >
        <Button className="w-full" size="lg" onClick={() => navigate(AFTER_ACCEPT_PATH, { replace: true })} data-testid="host-invite-continue">
          {t('hostInvite.continue')}
        </Button>
      </InviteLayout>
    );
  }

  const transient = isTransientRequestError(error);
  return (
    <InviteLayout title={t('hostInvite.acceptErrorTitle')}>
      <p role="alert" className="text-sm text-destructive" data-testid="host-invite-accept-error">
        {getProblemMessage(error, t) ?? t('hostInvite.acceptErrorGeneric')}
      </p>
      {transient && (
        <Button className="w-full" variant="outline" onClick={run}>
          {t('hostInvite.retry')}
        </Button>
      )}
      <Button className="w-full" variant="ghost" onClick={() => navigate(AFTER_ACCEPT_PATH, { replace: true })}>
        {t('hostInvite.continueWithout')}
      </Button>
    </InviteLayout>
  );
}

function UnusableInvite({ reason }: { reason: UnusableState }) {
  const { t } = useTranslation();
  return (
    <InviteLayout title={t(`hostInvite.unusable.${reason}.title`)} description={t(`hostInvite.unusable.${reason}.description`)}>
      <Button className="w-full" variant="outline" asChild>
        <Link to="/login">{t('hostInvite.unusable.login')}</Link>
      </Button>
    </InviteLayout>
  );
}

function LoadingCard({ message }: { message: string }) {
  return (
    <InviteLayout title={message}>
      <div className="flex justify-center py-4" role="status" aria-label={message}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </InviteLayout>
  );
}

function InviteLayout({
  title,
  description,
  success = false,
  children,
}: {
  title: string;
  description?: string;
  success?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4" data-testid="host-invite-page">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div
            className={
              success
                ? 'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700'
                : 'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground'
            }
          >
            {success ? (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <Home className="h-8 w-8" />
            )}
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {children && <CardContent className="space-y-4">{children}</CardContent>}
      </Card>
    </div>
  );
}
