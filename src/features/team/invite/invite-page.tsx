import { useMe } from '@/queries/use-users';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useOrgSettings } from '@/features/settings/organization/use-org-settings';
import { ACCOUNT_BILLING_PATH } from '@/lib/billing-routes';
import { cn } from '@/lib/utils';
import { useCreateOrgInvitation, useOrgInvitations, useOrgMembers, useOrgRoles } from '@/queries/use-org-team';
import type { OrgInvitationLanguage, OrgInvitationSent } from '@/types/org-team.types';
import { ACCOUNT_PEOPLE_PATH } from '../../account/account-home-model';
import { problemCodeOf, SEAT_LIMIT_CODE } from '../team-errors';
import { assignableRoles } from '../team-roles';
import { RENTAL_AREAS, usePickerProperties } from '../team-properties';
import { InviteDone } from './invite-done';
import {
  INVITE_DRAFT_EXCLUDE,
  INVITE_WIZARD_ID,
  inviteDefaults,
  inviteStepSchemas,
  knownEmails,
  toInvitationRequest,
  type InviteValues,
} from './invite-model';
import { BackToPeople, ReviewStep, RoleStep, WhereStep, WhoStep } from './invite-steps';

/** The language of the emails the person starts from when the account has not chosen one (or it cannot be read): the one of the interface. */
function interfaceLanguage(language: string): OrgInvitationLanguage {
  return language.toLowerCase().startsWith('en') ? 'en' : 'it';
}

/** After a refusal for the last seat the way out is one click away: the plan. The refusal itself is told by the wizard. */
function SeatLimitWay() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="invite-seat-limit">
      <Button asChild size="sm" variant="outline" className="min-h-11">
        <Link to={ACCOUNT_BILLING_PATH}>{t('team.invite.seats.plan')}</Link>
      </Button>
    </div>
  );
}

function InviteWizard() {
  const { t, i18n } = useTranslation();
  const { data: profile } = useMe();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assistantInvite = (useLocation().state as { invite?: { name?: unknown; email?: unknown } } | null)?.invite;
  const create = useCreateOrgInvitation();
  const members = useOrgMembers(true, { fresh: true });
  const invitations = useOrgInvitations({ fresh: true });
  const roles = useOrgRoles();
  // The language of the account (AM-08b-b) is the language the emails start with; without it (a refusal, an older backend) the interface's.
  const settings = useOrgSettings(true);
  const { properties, isError: propertiesFailed } = usePickerProperties();
  // The last seat is contended: a refusal for it keeps the answers (the wizard stays on its last step) and shows the way to the plan.
  const [seatLimitHit, setSeatLimitHit] = useState(false);

  // The checks of the steps know who is in the team and who is already invited, and which roles this person may give.
  const memberData = members.data?.items;
  const ownerAreas = Array.isArray(memberData) ? memberData.find((member) => member.role === 'Owner' && member.status === 'Active')?.areas : undefined;
  const availableAreas = useMemo(() => RENTAL_AREAS.filter((area) => ownerAreas?.includes(area)), [ownerAreas]);
  const invitationData = invitations.data;
  const roleData = roles.data?.roles;
  const assignable = useMemo(() => assignableRoles(roleData).map((role) => role.role), [roleData]);
  const schemas = useMemo(
    () =>
      inviteStepSchemas(
        knownEmails(Array.isArray(memberData) ? memberData : undefined, Array.isArray(invitationData) ? invitationData : undefined),
        availableAreas,
        assignable,
      ),
    [memberData, invitationData, assignable, availableAreas],
  );

  // `?property=` needs the properties to know the area of the one it names: the wizard opens when they are there (or failed).
  const waitingForProperties = searchParams.has('property') && properties === undefined && !propertiesFailed;
  // The wizard opens when the language is known (or could not be read), so that its first answer is never changed under the person's hands.
  const waitingForSettings = settings.isPending;
  const accountLanguage = settings.data?.defaultLanguage;
  const defaults = useMemo(
    () => {
      const initial = inviteDefaults(searchParams, accountLanguage ?? interfaceLanguage(i18n.language), properties, availableAreas);
      if (!assistantInvite) return initial;
      const name = typeof assistantInvite.name === 'string' ? assistantInvite.name.slice(0, 100) : '';
      const email = typeof assistantInvite.email === 'string' ? assistantInvite.email.slice(0, 254) : '';
      return { values: { ...initial.values, name, email }, prefilled: true };
    },
    [searchParams, accountLanguage, i18n.language, properties, availableAreas, assistantInvite],
  );
  if (profile?.org?.isAgency === false) {
    return <Alert action={<BackToPeople />}>{t('admin.staffInvite.privateTeam')}</Alert>;
  }
  if (members.isPending || waitingForProperties || waitingForSettings) return <LoadingScreen message={t('team.invite.loading')} className="h-auto flex-1" />;

  if (members.isError) {
    return (
      <Alert variant="danger" action={<>
        <Button type="button" size="sm" className="min-h-11" onClick={() => void members.refetch()}>{t('team.retry')}</Button>
        <BackToPeople />
      </>}>
        {t('team.invite.areasLoadError')}
      </Alert>
    );
  }
  if (!availableAreas.length) {
    return <Alert variant="warning" action={<BackToPeople />}>{t('team.invite.areasUnavailable')}</Alert>;
  }

  const steps: WizardStep<InviteValues>[] = [
    {
      id: 'who',
      label: t('team.invite.steps.who.label'),
      title: t('team.invite.steps.who.title'),
      purpose: t('team.invite.steps.who.purpose'),
      schema: schemas.who,
      render: () => <WhoStep />,
    },
    {
      id: 'role',
      label: t('team.invite.steps.role.label'),
      title: t('team.invite.steps.role.title'),
      purpose: t('team.invite.steps.role.purpose'),
      schema: schemas.role,
      nextDisabled: roles.isError || assignable.length === 0,
      render: () => <RoleStep availableAreas={availableAreas} />,
    },
    {
      id: 'where',
      label: t('team.invite.steps.where.label'),
      title: t('team.invite.steps.where.title'),
      purpose: t('team.invite.steps.where.purpose'),
      schema: schemas.where,
      render: () => <WhereStep availableAreas={availableAreas} />,
    },
    {
      id: 'review',
      label: t('team.invite.steps.review.label'),
      title: t('team.invite.steps.review.title'),
      purpose: t('team.invite.steps.review.purpose'),
      render: () => <ReviewStep availableAreas={availableAreas} />,
    },
  ];

  return (
    <WizardShell<InviteValues, OrgInvitationSent>
      id={INVITE_WIZARD_ID}
      steps={steps}
      defaultValues={defaults.values}
      finishLabel={t('team.invite.finish')}
      finishFailedMessage={t('team.invite.errors.sendFailed')}
      onFinish={async (values) => {
        try {
          return await create.mutateAsync(toInvitationRequest(values, properties, availableAreas));
        } catch (error) {
          setSeatLimitHit(problemCodeOf(error) === SEAT_LIMIT_CODE);
          throw error;
        }
      }}
      // An address that asks for something (`?role=accountant`) is not given the answers of an older visit instead.
      draft={{ exclude: INVITE_DRAFT_EXCLUDE, accept: (draft) => !defaults.prefilled && Array.isArray(draft.values.areas)
        && draft.values.areas.every((area) => availableAreas.includes(area)) }}
      onExit={() => navigate(ACCOUNT_PEOPLE_PATH)}
      renderDone={({ result }) => <InviteDone sent={result} />}
      aboveFooter={seatLimitHit ? <SeatLimitWay /> : null}
      testIds={{
        root: 'invite-wizard',
        back: 'invite-back',
        next: 'invite-next',
        finish: 'invite-finish',
        exit: 'invite-exit',
        finishError: 'invite-finish-error',
      }}
    />
  );
}

/**
 * «Invita un utente» (AM-04c), `/app/account/people/invite`: four steps (who, role, areas and properties, summary with what the
 * person will see) and «Cosa succede ora». The invitation leaves when the last button is pressed, never before. Behind the permission
 * `org.members.manage`, like the whole people area.
 *
 * Name and email are never kept in the draft. `?role=accountant`, `?area=long-rent` and `?property=<id>` start the wizard filled in;
 * `?n=` starts a new one («Invita un altro utente»): the wizard stays done once it is, so the same address would show its
 * confirmation again.
 */
export function InvitePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  return (
    <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="invite-page">
      <PageHeader title={t('team.invite.title')} crumbs="auto" />
      <InviteWizard key={searchParams.get('n') ?? 'first'} />
    </div>
  );
}
