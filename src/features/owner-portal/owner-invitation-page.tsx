import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supportConfig } from '@/config/support.config';
import { useAuth } from '@/hooks/use-auth';
import {
  claimsArePublished,
  clearOwnerInvitationToken,
  normalizeOwnerInvitationToken,
  OWNER_INVITATION_APP_STATE_KEY,
  OWNER_INVITATION_PATH,
  OWNER_PORTAL_HOME_PATH,
  ownerInvitationFailureOf,
  peekOwnerInvitationToken,
  stashOwnerInvitationToken,
  type OwnerInvitationFailure,
  type OwnerInvitationUnusable,
} from '@/lib/owner-invitation';
import { useSeoMeta } from '@/lib/seo-meta';
import { InviteAcceptCard } from '@/pages/invite-accept-card';
import { useAcceptOwnerInvitation } from '@/queries/use-owner-onboarding';
import type { OwnerInvitationAccepted } from '@/types/owner-onboarding.types';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 w-full whitespace-normal py-2 text-center leading-tight';

/**
 * `Referrer-Policy: no-referrer` for this page: a link that leaves it (the sign-in, the support address) says nothing of the page it was on. The secret is out
 * of the address bar by then, but the page never tells where a person came from.
 */
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
      <div className="flex justify-center py-2" role="status" aria-label={title} data-testid="owner-invitation-waiting">
        <Loader2 aria-hidden="true" className="size-8 animate-spin text-muted-foreground motion-reduce:animate-none" />
      </div>
    </InviteAcceptCard>
  );
}

/** A link that does not work, and why when the server said. The only way on is CasaZen itself: an owner who already accepted finds the portal there. */
function UnusableCard({ reason }: { reason: OwnerInvitationUnusable }) {
  const { t } = useTranslation();
  return (
    <InviteAcceptCard tone="broken" title={t(`ownerInvitation.unusable.${reason}.title`)} description={t(`ownerInvitation.unusable.${reason}.description`)}>
      <Button asChild className={TOUCH_TARGET} variant="outline">
        <Link to={OWNER_PORTAL_HOME_PATH} data-testid="owner-invitation-portal">
          {t('ownerInvitation.unusable.goToPortal')}
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
      <a href={`mailto:${support}`}>{t('ownerInvitation.support')}</a>
    </Button>
  );
}

interface SignedOutCardProps {
  token: string;
}

/**
 * Not signed in: the page says what the invitation is and offers the sign-up and the sign-in. Back to this page without the secret in the address: it travels in
 * the `appState` of the login, which the SDK gives back after the redirect.
 */
function SignedOutCard({ token }: SignedOutCardProps) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const enter = (signup: boolean) =>
    login({
      returnTo: OWNER_INVITATION_PATH,
      appState: { [OWNER_INVITATION_APP_STATE_KEY]: token },
      authorizationParams: signup ? { screen_hint: 'signup' } : undefined,
    });

  return (
    <InviteAcceptCard title={t('ownerInvitation.invite.title')} description={t('ownerInvitation.invite.description')}>
      <p className="text-sm text-muted-foreground">{t('ownerInvitation.invite.sameEmail')}</p>
      <Button className={TOUCH_TARGET} size="lg" onClick={() => enter(true)} data-testid="owner-invitation-signup">
        {t('ownerInvitation.invite.signup')}
      </Button>
      <Button className={TOUCH_TARGET} variant="outline" onClick={() => enter(false)} data-testid="owner-invitation-login">
        {t('ownerInvitation.invite.login')}
      </Button>
    </InviteAcceptCard>
  );
}

/** What the page shows once the server answered and the invitation is not (yet) in use: every state says what is not done and what to do, never a bare success. */
type Stage = 'opening' | 'claimsPending' | 'tokenPending';

/**
 * `/portale-proprietari/invito` (E10/F03/US05/T01, NF-109, ADR-011-R6, R10): the page of the link in the e-mail that invites a property owner to the owner portal.
 * It sits under the Auth0 boundary and outside the protected route, the onboarding guard and the workspace: the person has no organization, no role and no portal
 * claim yet, and a protected route would put the secret into a return address.
 *
 * The secret of the link is read once, taken out of the address bar at once, kept in memory only while the person signs in (it travels in the `appState` of the
 * Auth0 login) and sent once, in the body of `POST /owner-invitations/accept`, when the person is signed in. The server consumes it idempotently: this page never
 * sends it twice for one attempt. When the claims of the owner portal reached the identity provider the page forgets the secret, asks Auth0 for a new token and
 * replaces the address with the portal. When they did not, it says so, never a success that did not happen, and the secret stays in memory (nowhere else) for a new
 * try: the server hands the claims over again every time the same account accepts the same invitation, so «Riprova» accepts again, and only a portal opened without
 * the claims would be refused. The secret is forgotten when the claims are published, when the link is refused for good and when the person leaves the page. A link
 * that is expired, withdrawn, used by another account or invalid, an account whose e-mail is not the invited one and a portal that is off each have their own
 * CasaZen-branded card.
 */
export function OwnerInvitationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated, login, logout, refreshAccessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  useNoReferrer();
  useSeoMeta({ title: t('ownerInvitation.pageTitle'), noindex: true });

  // Read once, when the page opens: the link of the e-mail, or the one handed over after the sign-in. A link that carries a `token` that is not one does not work,
  // and an older token is not put in its place.
  const [token] = useState(() => (searchParams.has('token') ? normalizeOwnerInvitationToken(searchParams.get('token')) : peekOwnerInvitationToken()));

  // The secret leaves the address bar (and the history entry) as soon as the page has it. It waits in memory for the sign-in.
  useEffect(() => {
    if (!searchParams.has('token')) return;
    if (token) stashOwnerInvitationToken(token);
    const rest = new URLSearchParams(searchParams);
    rest.delete('token');
    setSearchParams(rest, { replace: true });
  }, [searchParams, setSearchParams, token]);

  // `mutateAsync` and not `mutate`: the answer is read from the promise, so it does not depend on the observer of the mutation, which the second run of the effects
  // in development (StrictMode) detaches from a mutation started by the first.
  const { mutateAsync, reset } = useAcceptOwnerInvitation();
  const started = useRef(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [failure, setFailure] = useState<OwnerInvitationFailure | null>(null);

  // True while the invitation is accepted but the claims of the portal did not reach the identity provider: the secret then waits in memory for a new acceptance, and
  // a person who leaves the page (a link, the back button) takes it with them: the link of the e-mail still works and brings it back.
  const waitingForClaims = useRef(false);
  useEffect(
    () => () => {
      if (waitingForClaims.current) clearOwnerInvitationToken();
    },
    [],
  );

  /** A new token from Auth0 (the old one has no owner claims) and the portal in place of this address; a failure of either is told, not hidden. */
  const openPortal = useCallback(async () => {
    setStage('opening');
    try {
      await refreshAccessToken();
    } catch {
      setStage('tokenPending');
      return;
    }
    navigate(OWNER_PORTAL_HOME_PATH, { replace: true });
  }, [navigate, refreshAccessToken]);

  const finish = useCallback(
    (accepted: OwnerInvitationAccepted) => {
      // The variables of the mutation (the secret) are dropped with every answer.
      reset();
      if (!claimsArePublished(accepted.claimsRefresh)) {
        // Accepted, but the portal would refuse the person (no claims in the token): not a success. The server repeats the hand-over of the claims at every acceptance of
        // the same invitation by the same account, so the secret is kept, in memory only, for the «Riprova» that accepts again.
        waitingForClaims.current = true;
        setStage('claimsPending');
        return;
      }
      // Published: the secret is forgotten for good and the portal opens in place of this address.
      waitingForClaims.current = false;
      clearOwnerInvitationToken();
      void openPortal();
    },
    [openPortal, reset],
  );

  const start = useCallback(
    (secret: string) => {
      started.current = true;
      mutateAsync(secret).then(finish, (error: unknown) => {
        reset();
        // A link that does not work, or an account that can never use it, is final: the secret is forgotten. A request worth sending again keeps it.
        const refused = ownerInvitationFailureOf(error);
        if (refused.kind !== 'retry' && refused.kind !== 'other' && refused.kind !== 'emailNotVerified') clearOwnerInvitationToken();
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

  /** A new acceptance with the same secret, only because the person asked: after a failure that is worth trying again and while the claims of the portal are not published. */
  const again = () => {
    if (!token) return;
    setFailure(null);
    setStage(null);
    started.current = false;
    start(token);
  };

  if (authLoading) return <WaitingCard title={t('ownerInvitation.loading')} />;
  if (stage === 'opening') return <WaitingCard title={t('ownerInvitation.opening')} />;

  if (stage === 'claimsPending') {
    // The invitation is accepted but the claims of the portal did not reach the identity provider: the portal would refuse the person, so this is not a success and
    // opening it is no remedy. The remedy is to accept again, which hands the claims over again.
    return (
      <InviteAcceptCard tone="attention" title={t('ownerInvitation.claimsPending.title')} description={t('ownerInvitation.claimsPending.description')}>
        <Button className={TOUCH_TARGET} onClick={again} data-testid="owner-invitation-retry">
          {t('ownerInvitation.retry')}
        </Button>
        <SupportLink />
      </InviteAcceptCard>
    );
  }

  if (stage === 'tokenPending') {
    // The claims are published but a new token could not be asked for: this is not a success either, and asking again is all there is to do.
    return (
      <InviteAcceptCard tone="attention" title={t('ownerInvitation.tokenPending.title')} description={t('ownerInvitation.tokenPending.description')}>
        <Button className={TOUCH_TARGET} onClick={() => void openPortal()} data-testid="owner-invitation-open-portal">
          {t('ownerInvitation.openPortal')}
        </Button>
        <SupportLink />
      </InviteAcceptCard>
    );
  }

  if (token === null) return <UnusableCard reason="invalid" />;
  if (!isAuthenticated) return <SignedOutCard token={token} />;

  // A new sign-in carries the secret again, in the `appState`, because the page is loaded again when the person comes back.
  const signInAgain = () => login({ returnTo: OWNER_INVITATION_PATH, appState: { [OWNER_INVITATION_APP_STATE_KEY]: token } });
  if (failure) return <FailureCard failure={failure} onRetry={again} onSwitchAccount={logout} onNewLogin={signInAgain} />;
  return <WaitingCard title={t('ownerInvitation.accepting')} />;
}

interface FailureCardProps {
  failure: OwnerInvitationFailure;
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
    return <InviteAcceptCard tone="broken" title={t('ownerInvitation.notFound.title')} description={t('ownerInvitation.notFound.description')} />;
  }

  if (failure.kind === 'emailMismatch') {
    return (
      <InviteAcceptCard tone="attention" title={t('ownerInvitation.emailMismatch.title')} description={t('ownerInvitation.emailMismatch.description')}>
        <Button className={TOUCH_TARGET} onClick={onSwitchAccount} data-testid="owner-invitation-switch">
          {t('ownerInvitation.emailMismatch.action')}
        </Button>
        <SupportLink />
      </InviteAcceptCard>
    );
  }

  if (failure.kind === 'emailNotVerified') {
    return (
      <InviteAcceptCard tone="attention" title={t('ownerInvitation.emailNotVerified.title')} description={t('ownerInvitation.emailNotVerified.description')}>
        <Button className={TOUCH_TARGET} onClick={onRetry} data-testid="owner-invitation-retry">
          {t('ownerInvitation.retry')}
        </Button>
        <Button className={TOUCH_TARGET} variant="outline" onClick={onNewLogin}>
          {t('ownerInvitation.emailNotVerified.login')}
        </Button>
      </InviteAcceptCard>
    );
  }

  return (
    <InviteAcceptCard tone="attention" title={t('ownerInvitation.failure.title')}>
      <Alert variant="danger">{t(failure.kind === 'retry' ? 'ownerInvitation.failure.retry' : 'ownerInvitation.failure.other')}</Alert>
      <Button className={TOUCH_TARGET} variant="outline" onClick={onRetry} data-testid="owner-invitation-retry">
        {t('ownerInvitation.retry')}
      </Button>
      <SupportLink />
    </InviteAcceptCard>
  );
}
