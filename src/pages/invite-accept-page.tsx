import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BriefcaseBusiness, CalendarClock, Layers, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { ConsentsStep } from '@/features/onboarding/components/consents-step';
import { areaName } from '@/features/team/team-labels';
import { orgRoleLabel } from '@/features/account/account-roles';
import { dayOf } from '@/features/team/team-dates';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supportConfig } from '@/config/support.config';
import { useLoginHandoff } from '@/hooks/use-login-handoff';
import { useAuth } from '@/hooks/use-auth';
import { getProblemMessage } from '@/lib/api-errors';
import {
  acceptFailureOf,
  clearPendingOrgInvite,
  inviteEntryAction,
  lookupFailureOf,
  maskEmail,
  ORG_INVITE_ACCEPT_PATH,
  readOrgInviteToken,
  savePendingOrgInvite,
  type AcceptFailure,
  type InviteEntryButton,
  type UnusableReason,
} from '@/lib/org-invitation';
import { useSeoMeta } from '@/lib/seo-meta';
import { useAcceptOrgInvitation, useOrgInvitationLookup } from '@/queries/use-org-team';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import type { OrgInvitationLookup } from '@/types/org-team.types';
import { InviteAcceptCard } from './invite-accept-card';

/**
 * `Referrer-Policy: no-referrer` for this page: a link that leaves it (the sign-in, the legal documents) says nothing of the page it was
 * on. The secret is out of the address bar by then, but the page never tells where a person came from.
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

function LoadingCard({ message }: { message: string }) {
  return (
    <InviteAcceptCard title={message}>
      <div className="flex justify-center py-2" role="status" aria-label={message}>
        <Loader2 aria-hidden="true" className="size-8 animate-spin text-muted-foreground" />
      </div>
    </InviteAcceptCard>
  );
}

/** A link that does not work, and why when it is known. The only way on is CasaZen itself: a person who already accepted finds it. */
function UnusableCard({ reason }: { reason: UnusableReason }) {
  const { t } = useTranslation();
  useEffect(() => { clearPendingOrgInvite(); }, []);
  return (
    <InviteAcceptCard tone="broken" title={t(`invitation.unusable.${reason}.title`)} description={t(`invitation.unusable.${reason}.description`)}>
      <Button asChild className="w-full" variant="outline">
        <Link to="/" data-testid="invite-accept-home">
          {t('invitation.unusable.goToApp')}
        </Link>
      </Button>
    </InviteAcceptCard>
  );
}

/** What the invitation is for, as the lookup says: the role, the areas, how long it lasts and the address it is for (masked). */
function InviteDetails({ invite }: { invite: OrgInvitationLookup }) {
  const { t, i18n } = useTranslation();
  const rows = [
    { id: 'role', icon: BriefcaseBusiness, label: t('invitation.details.role'), value: orgRoleLabel(invite.role, t) },
    { id: 'areas', icon: Layers, label: t('invitation.details.areas'), value: invite.areas.map((area) => areaName(area, t)).join(', ') },
    { id: 'email', icon: Mail, label: t('invitation.details.email'), value: maskEmail(invite.email) },
    { id: 'expires', icon: CalendarClock, label: t('invitation.details.expires'), value: dayOf(invite.expiresAt, i18n.language) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-4 rounded-lg bg-muted/60 p-3 text-sm sm:p-4" data-testid="invite-accept-details">
      {rows.map(({ id, icon: Icon, label, value }) => (
        <div key={id} className="min-w-0 space-y-1">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon aria-hidden="true" className="size-4 shrink-0" />{label}
          </dt>
          <dd className="break-words font-semibold">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function HandoffNotice({ status }: { status: ReturnType<typeof useLoginHandoff>['status'] }) {
  const { t } = useTranslation();
  if (status === 'idle') return null;
  if (status === 'pending') return <p role="status" className="text-sm">{t('login.redirecting')}</p>;
  return <Alert variant="warning">{t('login.handoffFailed')}</Alert>;
}

/** Not signed in: the page says what the invitation is and offers the way in that AM-D13 decided (`inviteEntryAction`, one place). */
function SignedOutCard({ invite }: { invite: OrgInvitationLookup }) {
  const { t } = useTranslation();
  const handoff = useLoginHandoff();
  const { primary, secondary, hintKey } = inviteEntryAction();
  // Back to this page without the secret: it waits in this tab.
  const enter = (button: InviteEntryButton) => handoff.start({ returnTo: ORG_INVITE_ACCEPT_PATH, authorizationParams: button.authorizationParams });

  return (
    <InviteAcceptCard
      title={t('invitation.joinTitle', { org: invite.orgName })}
      description={t('invitation.joinDescription')}
      summary={<InviteDetails invite={invite} />}
    >
      <h2 className="text-lg font-semibold">{t('invitation.accountStep')}</h2>
      <p className="text-sm text-muted-foreground">{t('invitation.useSameEmail')}</p>
      <HandoffNotice status={handoff.status} />
      <Button className="w-full" size="lg" disabled={handoff.busy} onClick={() => enter(primary)} data-testid={primary.testId}>
        {t(primary.labelKey)}
      </Button>
      {secondary ? (
        <Button className="w-full" variant="outline" disabled={handoff.busy} onClick={() => enter(secondary)} data-testid={secondary.testId}>
          {t(secondary.labelKey)}
        </Button>
      ) : null}
      {hintKey ? <p className="text-sm text-muted-foreground">{t(hintKey)}</p> : null}
    </InviteAcceptCard>
  );
}

/** A refusal of the acceptance that is not «the link does not work» (that one replaces the whole card). */
type Refusal = Exclude<AcceptFailure, { kind: 'unusable' }>;

/** The refusals that no second try changes: the person has to do something else (sign in with another account, ask the support). */
const BLOCKING: readonly Refusal['kind'][] = ['emailMismatch', 'emailNotVerified', 'platformAdmin', 'hasOrganization', 'alreadyMember'];

interface FailureAlertProps {
  failure: Refusal;
  /** What the server said, when it said something worth showing. */
  message: string | undefined;
  invite: OrgInvitationLookup;
  onSwitchAccount: () => void;
  switching: boolean;
}

function FailureAlert({ failure, message, invite, onSwitchAccount, switching }: FailureAlertProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const support = supportConfig.email;

  switch (failure.kind) {
    case 'emailMismatch':
      return (
        <Alert
          variant="warning"
          title={t('invitation.failure.emailMismatch.title')}
          action={
            <Button type="button" size="sm" className="min-h-11" disabled={switching} onClick={onSwitchAccount} data-testid="invite-accept-switch">
              {t('invitation.failure.emailMismatch.action')}
            </Button>
          }
        >
          {t('invitation.failure.emailMismatch.text', { email: maskEmail(invite.email) })}
        </Alert>
      );
    case 'emailNotVerified':
      return (
        <Alert
          variant="warning"
          title={t('invitation.failure.emailNotVerified.title')}
          action={
            <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={switching} onClick={onSwitchAccount}>
              {t('invitation.signInAfterVerification')}
            </Button>
          }
        >
          {t('invitation.failure.emailNotVerified.text')}
        </Alert>
      );
    case 'platformAdmin':
      return (
        <Alert
          variant="warning"
          title={t('invitation.failure.platformAdmin.title')}
          action={
            <Button type="button" size="sm" className="min-h-11" disabled={switching} onClick={onSwitchAccount}>
              {t('invitation.useAnother')}
            </Button>
          }
        >
          {t('invitation.failure.platformAdmin.text')}
        </Alert>
      );
    case 'hasOrganization':
      return (
        <Alert
          variant="warning"
          title={t('invitation.failure.hasOrganization.title')}
          action={
            <>
              <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={switching} onClick={onSwitchAccount}>
                {t('invitation.useAnother')}
              </Button>
              {support ? (
                <Button asChild size="sm" variant="ghost" className="min-h-11">
                  <a href={`mailto:${support}`}>{t('invitation.failure.hasOrganization.support')}</a>
                </Button>
              ) : null}
            </>
          }
        >
          {t('invitation.failure.hasOrganization.text')}
        </Alert>
      );
    case 'alreadyMember':
      return (
        <Alert
          variant="info"
          title={t('invitation.failure.alreadyMember.title')}
          action={
            <Button type="button" size="sm" className="min-h-11" onClick={() => navigate('/', { replace: true })}>
              {t('invitation.unusable.goToApp')}
            </Button>
          }
        >
          {t('invitation.failure.alreadyMember.text')}
        </Alert>
      );
    case 'consents':
      return (
        <Alert
          variant="danger"
          action={
            <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => window.location.reload()}>
              {t('invitation.failure.consents.reload')}
            </Button>
          }
        >
          {message ?? t('invitation.failure.consents.text')}
        </Alert>
      );
    default:
      return <Alert variant="danger">{message ?? t(failure.kind === 'retry' ? 'invitation.failure.retry' : 'invitation.failure.other')}</Alert>;
  }
}

/** Signed in: the four consents again for this org, then «Accetta». Once in, the person goes to the first page of the area it works in. */
function SignedInCard({ token, invite }: { token: string; invite: OrgInvitationLookup }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const handoff = useLoginHandoff();
  const switchAccount = () => handoff.start({ returnTo: ORG_INVITE_ACCEPT_PATH, authorizationParams: { prompt: 'login' } });
  const submitting = useRef(false);
  const accept = useAcceptOrgInvitation();
  const [unusable, setUnusable] = useState<UnusableReason | null>(null);
  const [failed, setFailed] = useState<{ failure: Refusal; message: string | undefined } | null>(null);

  const submit = (consents: OnboardingConsentsPayload) => {
    if (submitting.current) return;
    submitting.current = true;
    setFailed(null);
    accept.mutate(
      { token, consents },
      {
        onSuccess: (joined) => {
          clearPendingOrgInvite();
          toast.success(t('invitation.joined', { org: joined.orgName }), joined.leftEmptyOrg ? { description: t('invitation.leftEmptyOrg') } : undefined);
          // `/` opens the first page of the area the person works in: it reads the areas again, which are the new org's.
          navigate('/', { replace: true });
        },
        onError: (error) => {
          submitting.current = false;
          const failure = acceptFailureOf(error);
          if (failure.kind === 'unusable') setUnusable(failure.reason);
          else setFailed({ failure, message: getProblemMessage(error, t) });
        },
      },
    );
  };

  if (unusable) return <UnusableCard reason={unusable} />;

  const emailMismatch = user?.email && user.email.trim().toLowerCase() !== invite.email.trim().toLowerCase();
  const refusal = failed ?? (emailMismatch ? { failure: { kind: 'emailMismatch' as const }, message: undefined } : null);
  const blocked = refusal !== null && BLOCKING.includes(refusal.failure.kind);
  return (
    <InviteAcceptCard
      title={t('invitation.acceptTitle', { org: invite.orgName })}
      description={user?.email ? t('invitation.signedInAs', { email: user.email }) : undefined}
      summary={<InviteDetails invite={invite} />}
    >
      <h2 className="text-lg font-semibold">{t(blocked ? 'invitation.accountStep' : 'invitation.acceptStep')}</h2>
      <HandoffNotice status={handoff.status} />
      {refusal ? (
        <FailureAlert
          failure={refusal.failure}
          message={refusal.message}
          invite={invite}
          onSwitchAccount={switchAccount}
          switching={handoff.busy}
        />
      ) : null}
      {blocked ? null : (
        <ConsentsStep
          onBack={switchAccount}
          onContinue={submit}
          isLoading={accept.isPending || handoff.busy}
          backLabel={t('invitation.useAnother')}
          continueLabel={t('invitation.accept')}
          hideMarketing
        />
      )}
    </InviteAcceptCard>
  );
}

/**
 * `/invite/accept` (AM-04c): the page of the link in the email that invites a person to work in an org. It is public and outside the
 * onboarding guard: the person has no organization yet, or has an empty one it leaves. It shows what the invitation is for, leads to
 * the sign-in or the sign-up, and — signed in — asks the four consents again and accepts.
 *
 * The secret of the link is read once, taken out of the address bar and kept in this tab only while the person signs in; it goes only
 * in the body of the lookup and of the acceptance. Every link that does not work looks the same to the lookup (410), so the page can
 * only say that it does not work and what to do; the acceptance may say why.
 */
export function InviteAcceptPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  useNoReferrer();
  useSeoMeta({ title: t('invitation.pageTitle'), noindex: true });

  // Read once, when the page opens: the link of the email, or the one kept in this tab while the person signed in.
  const [token, setToken] = useState(() => readOrgInviteToken(searchParams));
  // A second invitation can be opened by client-side navigation in the same tab.
  const incoming = searchParams.has('token') ? readOrgInviteToken(searchParams) : token;
  if (incoming !== token) setToken(incoming);

  // The secret leaves the address bar (and the history entry) as soon as the page has it; it waits in this tab for the sign-in.
  useEffect(() => {
    if (!searchParams.has('token')) return;
    if (token) savePendingOrgInvite(token);
    else clearPendingOrgInvite();
    const rest = new URLSearchParams(searchParams);
    rest.delete('token');
    setSearchParams(rest, { replace: true });
  }, [searchParams, setSearchParams, token]);

  if (token === null) return <UnusableCard reason="invalid" />;
  return <InviteLookup key={token} token={token} />;
}

function InviteLookup({ token }: { token: string }) {
  const { t } = useTranslation();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const lookup = useOrgInvitationLookup(token);
  if (lookup.isPending || authLoading) return <LoadingCard message={t('invitation.loading')} />;

  if (lookup.isError) {
    const failure = lookupFailureOf(lookup.error);
    if (failure === 'invalid') return <UnusableCard reason="invalid" />;
    if (failure === 'unavailable') {
      return (
        <InviteAcceptCard tone="broken" title={t('invitation.unavailable.title')} description={t('invitation.unavailable.description')}>
          <Button asChild variant="outline" className="w-full"><Link to="/login">{t('invitation.unusable.goToApp')}</Link></Button>
        </InviteAcceptCard>
      );
    }
    return (
      <InviteAcceptCard tone="attention" title={t('invitation.errorTitle')}>
        <Alert variant="danger">{getProblemMessage(lookup.error, t) ?? t('invitation.errorGeneric')}</Alert>
        <Button className="w-full" variant="outline" onClick={() => void lookup.refetch()} disabled={lookup.isFetching} data-testid="invite-accept-retry">
          {t('invitation.retry')}
        </Button>
      </InviteAcceptCard>
    );
  }

  return isAuthenticated ? <SignedInCard token={token} invite={lookup.data} /> : <SignedOutCard invite={lookup.data} />;
}
