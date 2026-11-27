import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ownerPortalApi } from '@/api/ownerPortal.api';
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
import { useNoReferrer } from '@/hooks/use-no-referrer';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 w-full whitespace-normal py-2 text-center leading-tight';
const PORTAL_LOGIN_RETURN = `${OWNER_INVITATION_PATH}?resume=portal`;

function WaitingCard({ title }: { title: string }) {
  return (
    <InviteAcceptCard title={title}>
      <div className="flex justify-center py-2" role="status" aria-label={title} data-testid="owner-invitation-waiting">
        <Loader2 aria-hidden="true" className="size-8 animate-spin text-muted-foreground motion-reduce:animate-none" />
      </div>
    </InviteAcceptCard>
  );
}

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

type Stage = 'opening' | 'claimsPending' | 'tokenPending';

/**
 * `/portale-proprietari/invito` (E10/F03/US05/T01, NF-109, ADR-011-R6, R10): the page of the link in the e-mail that invites a property owner to the owner portal.
 * It sits under the Auth0 boundary and outside the protected route, the onboarding guard and the workspace: the person has no organization, no role and no portal
 * claim yet, and a protected route would put the secret into a return address.
 *
 * The secret of the link is read once, taken out of the address bar at once, kept in memory only while the person signs in (it travels in the `appState` of the
 * Auth0 login) and sent once, in the body of `POST /owner-invitations/accept`, when the person is signed in. The server consumes it idempotently: this page never
 * sends it twice for one attempt. When the claims reach the identity provider, the page forgets the secret and obtains a fresh Auth0 session. It replaces
 * the address with the portal only after the API confirms access. If publishing the claims fails, the secret stays in memory (nowhere else) for a new
 * try: the server hands the claims over again every time the same account accepts the same invitation, so «Riprova» accepts again, and only a portal opened without
 * the claims would be refused. The secret is forgotten when the claims are published, when the link is refused for good and when the person leaves the page. A link
 * that is expired, withdrawn, used by another account or invalid, an account whose e-mail is not the invited one and a portal that is off each have their own
 * CasaZen-branded card.
 */
export function OwnerInvitationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated, login, refreshAccessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  useNoReferrer();
  useSeoMeta({ title: t('ownerInvitation.pageTitle'), noindex: true });

  const [token] = useState(() => (searchParams.has('token') ? normalizeOwnerInvitationToken(searchParams.get('token')) : peekOwnerInvitationToken()));
  const [resumingPortal] = useState(() => !searchParams.has('token') && searchParams.get('resume') === 'portal');

  useEffect(() => {
    if (!searchParams.has('token')) return;
    if (token) stashOwnerInvitationToken(token);
    const rest = new URLSearchParams(searchParams);
    rest.delete('token');
    setSearchParams(rest, { replace: true });
  }, [searchParams, setSearchParams, token]);

  const { mutateAsync, reset } = useAcceptOwnerInvitation();
  const started = useRef(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [failure, setFailure] = useState<OwnerInvitationFailure | null>(null);

  const keepsSecret = useRef(false);
  // And false once the person has left, so that the answer of a request still on its way does not keep a secret for somebody who is gone.
  const onPage = useRef(false);
  useEffect(() => {
    onPage.current = true;
    return () => {
      onPage.current = false;
      if (keepsSecret.current) clearOwnerInvitationToken();
    };
  }, []);

  const openPortal = useCallback((afterLogin = false) => {
    const refresh = afterLogin ? Promise.resolve() : refreshAccessToken();
    return refresh.then(() => {
      if (onPage.current) return ownerPortalApi.checkAccess();
    }).then(
      () => {
        if (onPage.current) navigate(OWNER_PORTAL_HOME_PATH, { replace: true });
      },
      () => {
        if (!onPage.current) return;
        if (!afterLogin) {
          login({ returnTo: PORTAL_LOGIN_RETURN });
          return;
        }
        setStage('tokenPending');
      },
    );
  }, [login, navigate, refreshAccessToken]);

  const finish = useCallback(
    (accepted: OwnerInvitationAccepted) => {
      reset();
      if (!claimsArePublished(accepted.claimsRefresh)) {
        // Accepted, but the portal would refuse the person (no claims in the token): not a success. The server repeats the hand-over of the claims at every acceptance of
        // the same invitation by the same account, so the secret is kept, in memory only, for the «Riprova» that accepts again (unless the person has left meanwhile).
        keepsSecret.current = onPage.current;
        if (!onPage.current) clearOwnerInvitationToken();
        setStage('claimsPending');
        return;
      }
      keepsSecret.current = false;
      clearOwnerInvitationToken();
      if (onPage.current) {
        setStage('opening');
        void openPortal();
      }
    },
    [openPortal, reset],
  );

  const start = useCallback(
    (secret: string) => {
      started.current = true;
      mutateAsync(secret).then(finish, (error: unknown) => {
        reset();
        const refused = ownerInvitationFailureOf(error);
        const kept = (refused.kind === 'retry' || refused.kind === 'other' || refused.kind === 'emailNotVerified' || refused.kind === 'emailMismatch') && onPage.current;
        if (!kept) clearOwnerInvitationToken();
        keepsSecret.current = kept;
        setFailure(refused);
      });
    },
    [finish, mutateAsync, reset],
  );

  // Signed in with the secret in hand: accept, once for each attempt (a render, a development remount or a second effect never sends it again).
  useEffect(() => {
    if (authLoading || !isAuthenticated || started.current) return;
    if (resumingPortal) {
      started.current = true;
      void openPortal(true);
    } else if (token) {
      start(token);
    }
  }, [authLoading, isAuthenticated, openPortal, resumingPortal, start, token]);

  /** A new acceptance with the same secret, only because the person asked: after a failure that is worth trying again and while the claims of the portal are not published. */
  const again = () => {
    if (!token) return;
    setFailure(null);
    setStage(null);
    started.current = false;
    start(token);
  };

  if (authLoading || stage === 'opening') return <WaitingCard title={t('ownerInvitation.opening')} />;

  if (stage === 'claimsPending') {
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
    return (
      <InviteAcceptCard tone="attention" title={t('ownerInvitation.tokenPending.title')} description={t('ownerInvitation.tokenPending.description')}>
        <Button className={TOUCH_TARGET} onClick={() => login({ returnTo: PORTAL_LOGIN_RETURN, authorizationParams: { prompt: 'login' } })} data-testid="owner-invitation-open-portal">
          {t('ownerInvitation.openPortal')}
        </Button>
        <SupportLink />
      </InviteAcceptCard>
    );
  }

  if (resumingPortal) {
    if (isAuthenticated) return <WaitingCard title={t('ownerInvitation.opening')} />;
    return (
      <InviteAcceptCard title={t('ownerInvitation.opening')}>
        <Button className={TOUCH_TARGET} onClick={() => login({ returnTo: PORTAL_LOGIN_RETURN })}>
          {t('ownerInvitation.invite.login')}
        </Button>
      </InviteAcceptCard>
    );
  }

  if (token === null) return <UnusableCard reason="invalid" />;
  if (!isAuthenticated) return <SignedOutCard token={token} />;

  // A new sign-in carries the secret again, in the `appState`, because the page is loaded again when the person comes back.
  const signInAgain = () => login({ returnTo: OWNER_INVITATION_PATH, appState: { [OWNER_INVITATION_APP_STATE_KEY]: token } });
  const switchAccount = () =>
    login({ returnTo: OWNER_INVITATION_PATH, appState: { [OWNER_INVITATION_APP_STATE_KEY]: token }, authorizationParams: { prompt: 'login' } });
  if (failure) return <FailureCard failure={failure} onRetry={again} onSwitchAccount={switchAccount} onNewLogin={signInAgain} />;
  return <WaitingCard title={t('ownerInvitation.opening')} />;
}

interface FailureCardProps {
  failure: OwnerInvitationFailure;
  onRetry: () => void;
  onSwitchAccount: () => void;
  onNewLogin: () => void;
}

function FailureCard({ failure, onRetry, onSwitchAccount, onNewLogin }: FailureCardProps) {
  const { t } = useTranslation();

  if (failure.kind === 'unusable') return <UnusableCard reason={failure.reason} />;

  if (failure.kind === 'notFound') {
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
