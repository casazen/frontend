import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { Button } from '@/components/ui/button';
import { ACCOUNT_BILLING_PATH } from '@/lib/billing-routes';
import { cn } from '@/lib/utils';
import { useCreateOrgInvitation, useOrgInvitations, useOrgMembers, useOrgRoles } from '@/queries/use-org-team';
import type { OrgInvitationLanguage, OrgInvitationSent } from '@/types/org-team.types';
import { ACCOUNT_PEOPLE_PATH } from '../../account/account-home-model';
import { problemCodeOf, SEAT_LIMIT_CODE } from '../team-errors';
import { assignableRoles } from '../team-roles';
import { usePickerProperties } from '../team-properties';
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
import { ReviewStep, RoleStep, WhereStep, WhoStep } from './invite-steps';

/** The language of the emails the person starts from: the one of the interface. */
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const create = useCreateOrgInvitation();
  const members = useOrgMembers(true, { fresh: true });
  const invitations = useOrgInvitations({ fresh: true });
  const roles = useOrgRoles();
  const { properties, isError: propertiesFailed } = usePickerProperties();
  // The last seat is contended: a refusal for it keeps the answers (the wizard stays on its last step) and shows the way to the plan.
  const [seatLimitHit, setSeatLimitHit] = useState(false);

  // The checks of the steps know who is in the team and who is already invited, and which roles this person may give.
  const memberData = members.data?.items;
  const invitationData = invitations.data;
  const roleData = roles.data?.roles;
  const schemas = useMemo(
    () =>
      inviteStepSchemas(
        knownEmails(Array.isArray(memberData) ? memberData : undefined, Array.isArray(invitationData) ? invitationData : undefined),
        roleData ? assignableRoles(roleData).map((role) => role.role) : undefined,
      ),
    [memberData, invitationData, roleData],
  );

  // `?property=` needs the properties to know the area of the one it names: the wizard opens when they are there (or failed).
  const waitingForProperties = searchParams.has('property') && properties === undefined && !propertiesFailed;
  const defaults = useMemo(
    () => inviteDefaults(searchParams, interfaceLanguage(i18n.language), properties),
    [searchParams, i18n.language, properties],
  );
  if (waitingForProperties) return <LoadingScreen message={t('team.invite.loading')} className="h-auto flex-1" />;

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
      render: () => <RoleStep />,
    },
    {
      id: 'where',
      label: t('team.invite.steps.where.label'),
      title: t('team.invite.steps.where.title'),
      purpose: t('team.invite.steps.where.purpose'),
      schema: schemas.where,
      render: () => <WhereStep />,
    },
    {
      id: 'review',
      label: t('team.invite.steps.review.label'),
      title: t('team.invite.steps.review.title'),
      purpose: t('team.invite.steps.review.purpose'),
      render: () => <ReviewStep />,
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
          return await create.mutateAsync(toInvitationRequest(values, properties));
        } catch (error) {
          setSeatLimitHit(problemCodeOf(error) === SEAT_LIMIT_CODE);
          throw error;
        }
      }}
      // An address that asks for something (`?role=accountant`) is not given the answers of an older visit instead.
      draft={{ exclude: INVITE_DRAFT_EXCLUDE, accept: () => !defaults.prefilled }}
      onExit={() => navigate(ACCOUNT_PEOPLE_PATH)}
      renderDone={({ result, values }) => <InviteDone sent={result} values={values} />}
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
