import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supportConfig } from '@/config/support.config';
import { useAuth } from '@/hooks/use-auth';
import {
  clearOwnerContactToken,
  normalizeOwnerContactToken,
  OWNER_CONTACT_APP_STATE_KEY,
  OWNER_CONTACT_INVITATION_PATH,
  ownerContactFailureOf,
  peekOwnerContactToken,
  stashOwnerContactToken,
  type OwnerContactFailure,
  type OwnerContactUnusable,
} from '@/lib/owner-contact-invitation';
import { claimsArePublished, OWNER_PORTAL_HOME_PATH } from '@/lib/owner-invitation';
import { useSeoMeta } from '@/lib/seo-meta';
import { InviteAcceptCard } from '@/pages/invite-accept-card';
import { useAcceptOwnerContact } from '@/queries/ownerPortal';
import type { OwnerContactAccepted } from '@/types';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 w-full whitespace-normal py-2 text-center leading-tight';

/** `Referrer-Policy: no-referrer` for this page: a link that leaves it says nothing of the page it was on. */
function useNoReferrer() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

function WaitingCard({ title }: { title: string }) {
  return (
    <InviteAcceptCard title={title}>
      <div className="flex justify-center py-2" role="status" aria-label={title} data-testid="owner-contact-waiting">
        <Loader2 aria-hidden="true" className="size-8 animate-spin text-muted-foreground motion-reduce:animate-none" />
      </div>
    </InviteAcceptCard>
  );
}

/** A link that does not work, and why when the server said. The only way on is CasaZen itself: a contact who already accepted finds the portal there. */
function UnusableCard({ reason }: { reason: OwnerContactUnusable }) {
  const { t } = useTranslation();
  return (
    <InviteAcceptCard tone="broken" title={t(`ownerContactInvitation.unusable.${reason}.title`)} description={t(`ownerContactInvitation.unusable.${reason}.description`)}>
      <Button asChild className={TOUCH_TARGET} variant="outline">
        <Link to={OWNER_PORTAL_HOME_PATH} data-testid="owner-contact-portal">
          {t('ownerContactInvitation.unusable.goToPortal')}
        </Link>
      </Button>
    </InviteAcceptCard>
  );
}

function SupportLink() {
  const { t } = useTranslation();
  const support = supportConfig.email;
  if (!support) return null;
  return (
    <Button asChild variant="ghost" className={TOUCH_TARGET}>
      <a href={`mailto:${support}`}>{t('ownerContactInvitation.support')}</a>
    </Button>
  );
}

/** Not signed in: the page says what the invitation is and offers the sign-up and the sign-in. Back to this page without the secret in the address: it travels in the `appState`. */
function SignedOutCard({ token }: { token: string }) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const enter = (signup: boolean) =>
    login({
      returnTo: OWNER_CONTACT_INVITATION_PATH,
      appState: { [OWNER_CONTACT_APP_STATE_KEY]: token },
      authorizationParams: signup ? { screen_hint: 'signup' } : undefined,
    });

  return (
    <InviteAcceptCard title={t('ownerContactInvitation.invite.title')} description={t('ownerContactInvitation.invite.description')}>
      <p className="text-sm text-muted-foreground">{t('ownerContactInvitation.invite.sameEmail')}</p>
      <Button className={TOUCH_TARGET} size="lg" onClick={() => enter(true)} data-testid="owner-contact-signup">
        {t('ownerContactInvitation.invite.signup')}
      </Button>
      <Button className={TOUCH_TARGET} variant="outline" onClick={() => enter(false)} data-testid="owner-contact-login">
        {t('ownerContactInvitation.invite.login')}
      </Button>
    </InviteAcceptCard>
  );
}

/** What the page shows once the server answered and the invitation is not (yet) in use: every state says what is not done and what to do, never a bare success. */
type Stage = 'opening' | 'claimsPending' | 'tokenPending';

/**
 * `/portale-proprietari/contatto` (E07/F07/US01/T03, NF-111, ADR-011): the page of the link of the e-mail that invites a CONTACT of an owner. It sits under the Auth0 boundary and
 * outside the protected route and the portal shell: the person has no portal claim yet, and a protected route would put the secret into a return address.
 *
 * The secret is read once, taken out of the address bar at once, kept in memory only while the person signs in (it travels in the `appState` of the login) and sent once, in the
 * body of `POST /owner-contacts/accept`, when the person is signed in. The server consumes it idempotently and checks that the account is the invited one with a verified address.
 * When the claims of the portal reached the identity provider the page forgets the secret, asks Auth0 for a new token and opens the portal. When they did not, it says so, never a
 * success that did not happen, and keeps the secret in memory (nowhere else) for a new try. The secret is forgotten when the claims are published, when the link is refused for good and
 * when the person leaves the page.
 */
export function OwnerContactPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated, login, refreshAccessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  useNoReferrer();
  useSeoMeta({ title: t('ownerContactInvitation.pageTitle'), noindex: true });

  // Read once, when the page opens: the link of the e-mail, or the one handed over after the sign-in.
  const [token] = useState(() => (searchParams.has('token') ? normalizeOwnerContactToken(searchParams.get('token')) : peekOwnerContactToken()));

  // The secret leaves the address bar (and the history entry) as soon as the page has it. It waits in memory for the sign-in.
  useEffect(() => {
    if (!searchParams.has('token')) return;
    if (token) stashOwnerContactToken(token);
    const rest = new URLSearchParams(searchParams);
    rest.delete('token');
    setSearchParams(rest, { replace: true });
  }, [searchParams, setSearchParams, token]);

  // `mutateAsync` and not `mutate`: the answer is read from the promise, so it does not depend on the observer of the mutation.
  const { mutateAsync, reset } = useAcceptOwnerContact();
  const started = useRef(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [failure, setFailure] = useState<OwnerContactFailure | null>(null);

  // True while the secret waits in memory on purpose for another try; false once the person has left, so that the answer of a request still on its way keeps no secret.
  const keepsSecret = useRef(false);
  const onPage = useRef(false);
  useEffect(() => {
    onPage.current = true;
    return () => {
      onPage.current = false;
      if (keepsSecret.current) clearOwnerContactToken();
    };
  }, []);

  /** A new token from Auth0 (the old one has no owner claims) and the portal in place of this address; a failure of either is told, not hidden. */
  const openPortal = useCallback(async () => {
    setStage('opening');
    try {
      await refreshAccessToken();
    } catch {
      setStage('tokenPending');
      return;
    }
    void navigate(OWNER_PORTAL_HOME_PATH, { replace: true });
  }, [navigate, refreshAccessToken]);

  const finish = useCallback(
    (accepted: OwnerContactAccepted) => {
      // The variables of the mutation (the secret) are dropped with every answer.
      reset();
      if (!claimsArePublished(accepted.claimsRefresh)) {
        // Accepted, but the portal would refuse the person (no claims in the token): not a success. The secret is kept, in memory only, for the «Riprova» that accepts again.
        keepsSecret.current = onPage.current;
        if (!onPage.current) clearOwnerContactToken();
        setStage('claimsPending');
        return;
      }
      keepsSecret.current = false;
      clearOwnerContactToken();
      void openPortal();
    },
    [openPortal, reset],
  );

  const start = useCallback(
    (secret: string) => {
      started.current = true;
      mutateAsync(secret).then(finish, (error: unknown) => {
        reset();
        // A link that does not work is final: the secret is forgotten. It is kept (in memory, until the person leaves) for a request worth sending again, for an account whose
        // e-mail is not verified yet and for an account that is not the invited one: the link is good, and the person can sign in with the right account and come back with it.
        const refused = ownerContactFailureOf(error);
        const kept = (refused.kind === 'retry' || refused.kind === 'other' || refused.kind === 'emailNotVerified' || refused.kind === 'emailMismatch') && onPage.current;
        if (!kept) clearOwnerContactToken();
        keepsSecret.current = kept;
        setFailure(refused);
      });
    },
    [finish, mutateAsync, reset],
  );

  // Signed in with the secret in hand: accept, once for each attempt (a render, a development remount or a second effect never sends it again).
  useEffect(() => {
    if (authLoading || !isAuthenticated || !token || started.current) return;
    start(token);
  }, [authLoading, isAuthenticated, start, token]);

  /** A new acceptance with the same secret, only because the person asked. */
  const again = () => {
    if (!token) return;
    setFailure(null);
    setStage(null);
    started.current = false;
    start(token);
  };

  if (authLoading) return <WaitingCard title={t('ownerContactInvitation.loading')} />;
  if (stage === 'opening') return <WaitingCard title={t('ownerContactInvitation.opening')} />;

  if (stage === 'claimsPending') {
    return (
      <InviteAcceptCard tone="attention" title={t('ownerContactInvitation.claimsPending.title')} description={t('ownerContactInvitation.claimsPending.description')}>
        <Button className={TOUCH_TARGET} onClick={again} data-testid="owner-contact-retry">
          {t('ownerContactInvitation.retry')}
        </Button>
        <SupportLink />
      </InviteAcceptCard>
    );
  }

  if (stage === 'tokenPending') {
    return (
      <InviteAcceptCard tone="attention" title={t('ownerContactInvitation.tokenPending.title')} description={t('ownerContactInvitation.tokenPending.description')}>
        <Button className={TOUCH_TARGET} onClick={() => void openPortal()} data-testid="owner-contact-open-portal">
          {t('ownerContactInvitation.openPortal')}
        </Button>
        <SupportLink />
      </InviteAcceptCard>
    );
  }

  if (token === null) return <UnusableCard reason="invalid" />;
  if (!isAuthenticated) return <SignedOutCard token={token} />;

  const signInAgain = () => login({ returnTo: OWNER_CONTACT_INVITATION_PATH, appState: { [OWNER_CONTACT_APP_STATE_KEY]: token } });
  const switchAccount = () =>
    login({ returnTo: OWNER_CONTACT_INVITATION_PATH, appState: { [OWNER_CONTACT_APP_STATE_KEY]: token }, authorizationParams: { prompt: 'login' } });
  if (failure) return <FailureCard failure={failure} onRetry={again} onSwitchAccount={switchAccount} onNewLogin={signInAgain} />;
  return <WaitingCard title={t('ownerContactInvitation.accepting')} />;
}

interface FailureCardProps {
  failure: OwnerContactFailure;
  onRetry: () => void;
  onSwitchAccount: () => void;
  onNewLogin: () => void;
}

/** The refusal of the acceptance, by what the person has to do about it. */
function FailureCard({ failure, onRetry, onSwitchAccount, onNewLogin }: FailureCardProps) {
  const { t } = useTranslation();

  if (failure.kind === 'unusable') return <UnusableCard reason={failure.reason} />;

  if (failure.kind === 'notFound') {
    // The owner portal is off: the page is «not found», never an error that invites to try again.
    return <InviteAcceptCard tone="broken" title={t('ownerContactInvitation.notFound.title')} description={t('ownerContactInvitation.notFound.description')} />;
  }

  if (failure.kind === 'emailMismatch') {
    return (
      <InviteAcceptCard tone="attention" title={t('ownerContactInvitation.emailMismatch.title')} description={t('ownerContactInvitation.emailMismatch.description')}>
        <Button className={TOUCH_TARGET} onClick={onSwitchAccount} data-testid="owner-contact-switch">
          {t('ownerContactInvitation.emailMismatch.action')}
        </Button>
        <SupportLink />
      </InviteAcceptCard>
    );
  }

  if (failure.kind === 'emailNotVerified') {
    return (
      <InviteAcceptCard tone="attention" title={t('ownerContactInvitation.emailNotVerified.title')} description={t('ownerContactInvitation.emailNotVerified.description')}>
        <Button className={TOUCH_TARGET} onClick={onRetry} data-testid="owner-contact-retry">
          {t('ownerContactInvitation.retry')}
        </Button>
        <Button className={TOUCH_TARGET} variant="outline" onClick={onNewLogin}>
          {t('ownerContactInvitation.emailNotVerified.login')}
        </Button>
      </InviteAcceptCard>
    );
  }

  return (
    <InviteAcceptCard tone="attention" title={t('ownerContactInvitation.failure.title')}>
      <Alert variant="danger">{t(failure.kind === 'retry' ? 'ownerContactInvitation.failure.retry' : 'ownerContactInvitation.failure.other')}</Alert>
      <Button className={TOUCH_TARGET} variant="outline" onClick={onRetry} data-testid="owner-contact-retry">
        {t('ownerContactInvitation.retry')}
      </Button>
      <SupportLink />
    </InviteAcceptCard>
  );
}
