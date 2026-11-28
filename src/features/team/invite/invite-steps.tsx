import { Link } from 'react-router-dom';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { FormFieldError } from '@/components/shared/form-field-error';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { WizardSummary, type WizardSummaryItem } from '@/components/shared/wizard/wizard-summary';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonLine } from '@/components/ui/skeleton';
import { ACCOUNT_BILLING_PATH } from '@/lib/billing-routes';
import { useOrgMembers, useOrgRoles } from '@/queries/use-org-team';
import type { OrgInvitationLanguage, OrgSeats } from '@/types/org-team.types';
import { ACCOUNT_PEOPLE_PATH } from '../../account/account-home-model';
import { orgRoleLabel } from '../../account/account-roles';
import { AccessPreview } from '../access-preview';
import { AreaPropertyPicker } from '../area-property-picker';
import { RoleCard } from '../role-card';
import { areaName } from '../team-labels';
import { assignableRoles } from '../team-roles';
import { usePickerProperties, type RentalArea } from '../team-properties';
import { ACCOUNT_ROLES_PATH } from '../team-paths';
import { hasFullAccess, inviteScopeOf, type InviteValues } from './invite-model';

export function BackToPeople() {
  const { t } = useTranslation();
  return (
    <Button asChild size="sm" variant="outline" className="min-h-11">
      <Link to={ACCOUNT_PEOPLE_PATH}>{t('team.invite.backToPeople')}</Link>
    </Button>
  );
}

/** The two ways a person is told how many seats are left: a line while there are some, a warning with the way out when there are none. */
function SeatsNote({ seats }: { seats: OrgSeats | undefined }) {
  const { t } = useTranslation();
  if (!seats) return null;

  if (!seats.canInvite) {
    return (
      <Alert
        variant="warning"
        title={t('team.invite.seats.noneTitle')}
        action={
          <Button asChild size="sm" variant="outline" className="min-h-11">
            <Link to={ACCOUNT_BILLING_PATH} data-testid="invite-seats-plan">
              {t('team.invite.seats.plan')}
            </Link>
          </Button>
        }
      >
        {t('team.invite.seats.noneText')}
      </Alert>
    );
  }

  return (
    <p className="flex items-center gap-2 border-t border-border pt-4 text-sm text-foreground/70" data-testid="invite-seats">
      <Users aria-hidden="true" className="size-4 shrink-0" />
      {seats.unlimited ? t('team.invite.seats.unlimited') : t('team.invite.seats.left', { count: seats.available, max: seats.max })}
    </p>
  );
}

export function WhoStep() {
  const { t } = useTranslation();
  const { register, control, formState } = useFormContext<InviteValues>();
  const members = useOrgMembers(true, { fresh: true });

  return (
    <div className="@container space-y-5">
      <div className="grid gap-4 @xl:grid-cols-2">
        <Field label={t('team.invite.who.name')} example={t('team.invite.who.nameExample')} error={formState.errors.name}>
          <Input autoComplete="off" data-testid="invite-name" {...register('name')} />
        </Field>
        <Field label={t('team.invite.who.email')} hint={t('team.invite.who.emailHint')} error={formState.errors.email}>
          <Input type="email" inputMode="email" autoComplete="off" autoCapitalize="off" spellCheck={false} data-testid="invite-email" {...register('email')} />
        </Field>
      </div>
      <div className="space-y-2 rounded-2xl border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium leading-snug">{t('team.invite.who.language')}</p>
        <Controller
          control={control}
          name="language"
          render={({ field }) => (
            <Segmented<OrgInvitationLanguage>
              label={t('team.invite.who.language')}
              value={field.value}
              onValueChange={field.onChange}
              options={[
                { value: 'it', label: t('team.invite.who.languageIt'), testId: 'invite-language-it' },
                { value: 'en', label: t('team.invite.who.languageEn'), testId: 'invite-language-en' },
              ]}
            />
          )}
        />
        <p className="text-sm text-foreground/70">{t('team.invite.who.languageHint')}</p>
      </div>
      <SeatsNote seats={members.data?.seats} />
    </div>
  );
}

export function RoleStep({ availableAreas }: { availableAreas: readonly RentalArea[] }) {
  const { t } = useTranslation();
  const { register, formState } = useFormContext<InviteValues>();
  const roles = useOrgRoles();

  if (roles.isPending) return <SkeletonLine lines={4} />;

  const assignable = assignableRoles(roles.data?.roles);
  if (roles.isError) {
    return (
      <Alert
        variant="danger"
        action={
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void roles.refetch()}>
            {t('team.retry')}
          </Button>
        }
      >
        {t('team.invite.role.loadError')}
      </Alert>
    );
  }

  if (assignable.length === 0) {
    return <Alert variant="warning" action={<BackToPeople />}>{t('team.invite.role.noneAssignable')}</Alert>;
  }

  return (
    <div className="space-y-3">
      <ChoiceGroup legend={t('team.invite.role.legend')} minCardWidth={16}>
        {assignable.map((role) => (
          <RoleCard availableAreas={availableAreas} key={role.role} info={role} data-testid={`invite-role-${role.role}`} {...register('role')} />
        ))}
      </ChoiceGroup>
      <FormFieldError error={formState.errors.role} />
      <Link
        to={ACCOUNT_ROLES_PATH}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary-text underline underline-offset-2"
        data-testid="invite-compare-roles"
      >
        {t('team.invite.role.compare')}
      </Link>
    </div>
  );
}

export function WhereStep({ availableAreas }: { availableAreas: readonly RentalArea[] }) {
  const { control, setValue, formState } = useFormContext<InviteValues>();
  const role = useWatch({ control, name: 'role' });
  const areas = useWatch({ control, name: 'areas' });
  const scope = useWatch({ control, name: 'scope' });
  const propertyIds = useWatch({ control, name: 'propertyIds' });
  const roles = useOrgRoles();
  const { properties, isError, refetch } = usePickerProperties();

  const scopeSupported = roles.data?.roles.find((candidate) => candidate.role === role)?.scopeSupported ?? role === 'Collaborator';
  const touched = { shouldDirty: true, shouldTouch: true } as const;

  return (
    <div className="space-y-3">
      <AreaPropertyPicker
        availableAreas={availableAreas}
        fullAccess={hasFullAccess(role)}
        scopeSupported={scopeSupported}
        areas={areas ?? []}
        onAreasChange={(next) => setValue('areas', next, { ...touched, shouldValidate: true })}
        scope={scope ?? 'All'}
        onScopeChange={(next) => setValue('scope', next, touched)}
        propertyIds={propertyIds ?? []}
        onPropertyIdsChange={(next) => setValue('propertyIds', next, touched)}
        properties={properties}
        propertiesFailed={isError}
        onRetryProperties={refetch}
      />
      <FormFieldError error={formState.errors.areas} />
    </div>
  );
}

export function ReviewStep({ availableAreas }: { availableAreas: readonly RentalArea[] }) {
  const { t } = useTranslation();
  const wizard = useOptionalWizard();
  const { control } = useFormContext<InviteValues>();
  const values = useWatch({ control }) as InviteValues;
  const roles = useOrgRoles();
  const members = useOrgMembers(true, { fresh: true });
  const { properties } = usePickerProperties();

  const { areas, scope, propertyIds } = inviteScopeOf(values, properties, availableAreas);
  const role = roles.data?.roles.find((candidate) => candidate.role === values.role);
  const propertyNames = propertyIds.map((id) => properties?.find((property) => property.id === id)?.name).filter((name): name is string => Boolean(name));
  const seats = members.data?.seats;

  const where = areas.map((area) => areaName(area, t)).join(', ');
  const items: WizardSummaryItem[] = [
    {
      id: 'person',
      label: t('team.invite.review.person'),
      value: (
        <>
          {values.name}
          <span className="block break-words text-sm font-normal text-foreground/70">{values.email}</span>
        </>
      ),
      stepId: 'who',
    },
    { id: 'language', label: t('team.invite.review.language'), value: t(values.language === 'en' ? 'team.invite.who.languageEn' : 'team.invite.who.languageIt'), stepId: 'who' },
    { id: 'role', label: t('team.invite.review.role'), value: orgRoleLabel(values.role, t), stepId: 'role' },
    {
      id: 'where',
      label: t('team.invite.review.where'),
      value: (
        <>
          {where}
          <span className="block break-words text-sm font-normal text-foreground/70">
            {scope === 'All' ? t('team.invite.review.allProperties') : propertyNames.length > 0 ? propertyNames.join(', ') : t('team.invite.review.noProperties')}
          </span>
        </>
      ),
      stepId: 'where',
    },
  ];

  return (
    <div className="space-y-6">
      <WizardSummary items={items} />

      {scope === 'Selected' && propertyNames.length === 0 ? (
        <Alert
          variant="warning"
          title={t('team.invite.review.noPropertiesTitle')}
          action={
            wizard ? (
              <Button asChild size="sm" variant="outline" className="min-h-11">
                <Link to={wizard.hrefFor('where')}>{t('team.invite.review.choosePropertiesCta')}</Link>
              </Button>
            ) : undefined
          }
        >
          {t('team.invite.review.noPropertiesText')}
        </Alert>
      ) : null}

      {seats && !seats.canInvite ? <SeatsNote seats={seats} /> : null}

      <PlainSection title={t('team.preview.titleInvited')}>
        {role ? (
          <AccessPreview role={role} areas={areas} availableAreas={availableAreas} />
        ) : roles.isPending ? (
          <SkeletonLine lines={3} />
        ) : (
          <p className="text-sm text-foreground/70">{t('team.preview.unavailable')}</p>
        )}
      </PlainSection>

      <PlainSection title={t('team.invite.review.receivesTitle')}>
        <ul role="list" className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
          <li>{t('team.invite.review.receivesEmail', { language: t(values.language === 'en' ? 'team.invite.who.languageEn' : 'team.invite.who.languageIt') })}</li>
          <li>{t('team.invite.review.receivesValidity')}</li>
          <li>{t('team.invite.review.receivesAccount')}</li>
        </ul>
      </PlainSection>
    </div>
  );
}
