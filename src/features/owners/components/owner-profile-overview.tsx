import { AlertTriangle, ArrowRight, Building2, CheckCircle2, ClipboardCheck, FileSignature, FileText, IdCard, Info, Landmark, Scale, type LucideIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FocusBlock } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { OwnerAccountingPolicy, OwnerOnboardingProperty, OwnerOnboardingReason, OwnerOnboardingWarning, OwnershipIssue } from '@/types';
import { OWNER_ONBOARDING_PATH, camelCode, type OwnerReadiness, type Period } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { completedSteps, tabSearch, type PathTab, type StepState } from '../owner-profile-model';
import { IconTile, OwnerCard, QuietNote, StateChip } from './owner-ui';

const KNOWN_REASONS = [
  'legal_name_missing',
  'entity_kind_missing',
  'ownership_missing',
  'shares_gap',
  'shares_shortfall',
  'shares_excess',
  'owner_overlap',
  'mandate_missing',
  'mandate_document_missing',
  'mandate_outside_ownership',
  'tax_residence_missing',
  'fiscal_id_missing',
  'fiscal_code_invalid',
  'vat_number_invalid',
  'billing_address_incomplete',
  'iban_missing',
  'iban_invalid',
  'bic_missing',
  'bic_invalid',
  'settlement_currency_missing',
  'email_missing',
  'email_invalid',
  'registry_not_ready',
  'ownership_not_ready',
] as const;

const STEP_ICON: Record<PathTab, LucideIcon> = {
  identity: IdCard,
  payments: Landmark,
  mandate: FileSignature,
  documents: FileText,
  rule: Scale,
};

interface ReadinessFocusProps {
  readiness: OwnerReadiness;
  uncovered: Period | null;
  canEdit: boolean;
  backTo: string;
  onEdit: () => void;
  onApprove: (policy: OwnerAccountingPolicy) => void;
  onNewPolicy: () => void;
}

export function ReadinessFocus({ readiness, uncovered, canEdit, backTo, onEdit, onApprove, onNewPolicy }: ReadinessFocusProps) {
  const { t } = useTranslation();
  const { date, month } = useOwnerFormat();

  if (readiness.ready && uncovered) {
    return (
      <FocusBlock
        tone="warning"
        kicker={t('ownerProfile.focus.kicker')}
        title={t('ownerProfile.monthNotCovered.title', { period: month(uncovered.year, uncovered.month) })}
        body={t('ownerProfile.monthNotCovered.body', { from: date(readiness.from) })}
        primary={{ label: t('ownerProfile.focus.back'), href: backTo, testId: 'profile-focus-back' }}
        data-testid="profile-focus"
        data-month-not-covered="true"
      />
    );
  }

  if (readiness.ready) {
    return (
      <FocusBlock
        tone="success"
        kicker={t('ownerProfile.focus.kicker')}
        title={t('ownerProfile.focus.ready.title', { from: date(readiness.from) })}
        body={t('ownerProfile.focus.ready.body', { rule: readiness.policy.ruleCode, version: readiness.policy.version, jurisdiction: readiness.policy.jurisdiction, approver: readiness.policy.approvedByName ?? '' })}
        primary={{ label: t('ownerProfile.focus.back'), href: backTo, testId: 'profile-focus-back' }}
        data-testid="profile-focus"
      />
    );
  }

  const reason = readiness.reason;
  const needsApproval = reason === 'policy_not_approved' && readiness.policy !== null && canEdit;
  const needsPolicy = reason === 'policy_missing' && canEdit;
  const policy = readiness.policy;
  const primary =
    needsApproval && policy
      ? { label: t('ownerProfile.focus.approve'), onClick: () => onApprove(policy), testId: 'profile-focus-approve' }
      : needsPolicy
        ? { label: t('ownerProfile.focus.newPolicy'), onClick: onNewPolicy, testId: 'profile-focus-new-policy' }
        : canEdit
          ? { label: t('ownerProfile.focus.complete'), onClick: onEdit, testId: 'profile-focus-complete' }
          : { label: t('ownerProfile.focus.back'), href: backTo, testId: 'profile-focus-back' };

  return (
    <FocusBlock
      tone="warning"
      kicker={t('ownerProfile.focus.kicker')}
      title={t(`ownerProfile.focus.blocked.${reason}.title`)}
      body={
        reason === 'profile_incomplete'
          ? t('ownerProfile.focus.blocked.profile_incomplete.body', { fields: readiness.gaps.map((gap) => t(`ownerProfile.fields.${gap}`)).join(', ') })
          : t(`ownerProfile.focus.blocked.${reason}.body`)
      }
      who={t('ownerProfile.focus.who')}
      primary={primary}
      data-testid="profile-focus"
    />
  );
}

export function OwnerWarnings({ warnings }: { warnings: readonly OwnerOnboardingWarning[] }) {
  const { t } = useTranslation();
  if (warnings.length === 0) return null;
  return (
    <div className="space-y-2" data-testid="profile-warnings">
      {warnings.map((warning) => (
        <Alert
          key={warning.code}
          variant="warning"
          title={warning.code === 'short_let_business_presumed' ? t('ownerProfile.warning.shortLetBusinessPresumed.title') : t('ownerProfile.warning.other.title')}
          data-testid="profile-warning"
          data-code={warning.code}
        >
          {warning.code === 'short_let_business_presumed'
            ? t('ownerProfile.warning.shortLetBusinessPresumed.body', { managed: warning.managedUnits, external: warning.externalUnits, max: warning.maxUnits })
            : t('ownerProfile.warning.other.body', { code: warning.code })}
          {warning.suggestion === 'issuer_profile' ? ` ${t('ownerProfile.warning.suggestion.issuerProfile')}` : ''}
        </Alert>
      ))}
    </div>
  );
}

export interface PathStep {
  tab: PathTab;
  state: StepState;
  value: string;
  detail: string | null;
}

interface StepCardProps extends PathStep {
  number: number;
  search: string;
}

function StepCard({ tab, number, state, value, detail, search }: StepCardProps) {
  const { t } = useTranslation();
  return (
    <Link
      to={{ search }}
      replace
      data-testid={`owner-step-${tab}`}
      data-state={state}
      className="flex h-full min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 outline-hidden transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <IconTile icon={STEP_ICON[tab]} />
        <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-foreground/60">{t('ownerProfile.path.step', { number })}</p>
        {state === 'done' ? <StateChip tone="success">{t(`ownerProfile.path.status.${tab}.done`)}</StateChip> : null}
        {state === 'todo' ? <StateChip tone="warning">{t(`ownerProfile.path.status.${tab}.todo`)}</StateChip> : null}
      </div>
      <div className="min-w-0">
        <h3 className="break-words text-base font-semibold">{t(`ownerProfile.tabs.${tab}`)}</h3>
        <p className="mt-1 break-words text-sm font-medium">{value}</p>
        {detail ? <p className="mt-0.5 break-words text-sm text-foreground/70">{detail}</p> : null}
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary-text">
        {t('ownerProfile.path.open')}
        <ArrowRight aria-hidden="true" className="size-4" />
      </span>
    </Link>
  );
}

export function PathSection({ steps }: { steps: readonly PathStep[] }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const { done, total } = completedSteps(steps.map((step) => step.state));
  const progress = t('ownerProfile.path.progress', { done, total });
  return (
    <section aria-labelledby="owner-path-title" className="space-y-3" data-testid="owner-path">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="owner-path-title" className="text-lg font-semibold">
          {t('ownerProfile.path.title')}
        </h2>
        <p className="text-sm tabular-nums text-foreground/70" data-testid="owner-path-progress">
          {progress}
        </p>
      </div>
      <Progress size="sm" value={total === 0 ? 0 : (done / total) * 100} tone={done === total && total > 0 ? 'success' : 'default'} label={t('ownerProfile.path.progressLabel')} valueText={progress} />
      <ol role="list" className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2 sm:[&>li:last-child:nth-child(odd)]:col-span-2">
        {steps.map((step, index) => (
          <li key={step.tab} className="min-w-0">
            <StepCard {...step} number={index + 1} search={tabSearch(params, step.tab)} />
          </li>
        ))}
      </ol>
    </section>
  );
}

interface ActivationCheckProps {
  loaded: boolean;
  available: boolean;
  reasons: readonly OwnerOnboardingReason[];
  properties: readonly OwnerOnboardingProperty[];
}

export function ActivationCheck({ loaded, available, reasons, properties }: ActivationCheckProps) {
  const { t } = useTranslation();
  const { date } = useOwnerFormat();
  if (!loaded) return null;
  const propertyNames = new Map(properties.map((property) => [property.propertyId, property.name] as const));
  const shareProblems = properties.filter((property) => reasons.some((reason) => reason.propertyId === property.propertyId) && property.issues.length > 0);
  const periodOf = (issue: OwnershipIssue) => (issue.to ? t('ownerProfile.ownership.until', { date: date(issue.to) }) : t('ownerProfile.ownership.onward'));
  const chip =
    !available ? null : reasons.length === 0 ? (
      <StateChip tone="success">{t('ownerProfile.onboarding.allClear')}</StateChip>
    ) : (
      <StateChip tone="warning">{t('ownerProfile.onboarding.toFix', { count: reasons.length })}</StateChip>
    );

  return (
    <OwnerCard icon={ClipboardCheck} title={t('ownerProfile.onboarding.title')} chip={chip} id="profile-onboarding" data-testid="profile-onboarding">
      {!available ? (
        <QuietNote icon={Info}>{t('ownerProfile.onboarding.unavailable')}</QuietNote>
      ) : reasons.length === 0 ? (
        <QuietNote icon={CheckCircle2} data-testid="profile-onboarding-complete">
          {t('ownerProfile.onboarding.complete')}
        </QuietNote>
      ) : (
        <>
          <ul role="list" className="divide-y divide-border rounded-lg border border-border" data-testid="profile-onboarding-reasons">
            {reasons.map((reason, index) => {
              const property = reason.propertyId ? propertyNames.get(reason.propertyId) : undefined;
              return (
                <li key={`${reason.dimension}-${reason.code}-${reason.propertyId ?? ''}-${index}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2.5 text-sm" data-code={reason.code}>
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                  <span className="min-w-0 flex-1 break-words">
                    {(KNOWN_REASONS as readonly string[]).includes(reason.code) ? t(`ownerProfile.reason.${camelCode(reason.code)}`) : t('ownerProfile.reason.other', { code: reason.code })}
                  </span>
                  {property ? (
                    <span className="inline-flex min-w-0 items-center gap-1 break-words text-foreground/70">
                      <Building2 aria-hidden="true" className="size-4 shrink-0" />
                      {property}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {shareProblems.length > 0 ? (
            <div className="space-y-2 text-sm" data-testid="profile-ownership-issues">
              <h3 className="font-semibold">{t('ownerProfile.ownership.title')}</h3>
              <ul role="list" className="space-y-1.5">
                {shareProblems.flatMap((property) =>
                  property.issues.map((issue, index) => (
                    <li key={`${property.propertyId}-${index}`} className="break-words" data-kind={issue.kind}>
                      <span className="font-medium">{property.name}: </span>
                      {t(`ownerProfile.ownership.${issue.kind}`, { from: date(issue.from), until: periodOf(issue), percent: issue.totalPercent })}
                    </li>
                  )),
                )}
              </ul>
            </div>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link to={OWNER_ONBOARDING_PATH} data-testid="profile-onboarding-link">
              {t('ownerProfile.onboarding.completeAction')}
            </Link>
          </Button>
        </>
      )}
    </OwnerCard>
  );
}
