import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FinanceSectionLinks } from '@/components/finance/finance-section-links';
import { ClipboardCheck, History as HistoryIcon, ScrollText, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { FocusBlock, PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { todayInRome } from '@/lib/stay-dates';
import { useAccountingPolicies, useFiscalProfiles, useOwnerNames, useOwnerOnboardingReadiness } from '@/queries/use-owner-accounting';
import type { OwnerAccountingPolicy, OwnerFiscalProfile, OwnerOnboardingProperty, OwnerOnboardingReason, OwnerOnboardingWarning, OwnershipIssue } from '@/types';
import { FinanceAdminRequired, OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import {
  OWNER_CLOSE_PATH,
  OWNER_ONBOARDING_PATH,
  PROFILE_OPTIONS,
  camelCode,
  closePath,
  defaultPeriod,
  latestProfileStart,
  maskValue,
  ownerReadinessOn,
  parsePeriod,
  shortId,
  startOfPeriod,
  type OwnerReadiness,
  type Period,
} from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { OwnerIssuedDocumentsSection } from './components/issued-documents-export';
import { OwnerAddressSection } from './components/owner-address-form';
import { OwnerIssuerProfileSection } from './components/owner-issuer-profile-form';
import { OwnerMandateSection } from './components/owner-mandate-form';
import { OwnerTaxChecksSection } from './components/owner-tax-checks-section';
import { ApprovePolicyDialog, PolicyDialog } from './components/policy-dialog';
import { ProfileDialog } from './components/profile-dialog';

const FACT_GROUPS = [
  { title: 'identity', fields: ['entityKind', 'legalName'] },
  { title: 'tax', fields: ['taxResidenceCountry', 'legalAddress', 'fiscalCode', 'vatNumber', 'foreignTaxId'] },
  { title: 'payment', fields: ['settlementCurrency', 'bankAccountReference'] },
  { title: 'mandate', fields: ['mandateRole', 'mandateFrom', 'mandateTo'] },
  { title: 'model', fields: ['revenueRecognitionRule', 'expenseCommissionModel', 'workingCapitalRule', 'taxJurisdiction'] },
];

const NEW_POLICY_TEST_ID = 'policy-new';

/** The fields of a profile that identify a person or reach their money: shown masked until a person who may asks for them. */
const SENSITIVE = new Set(['legalName', 'legalAddress', 'fiscalCode', 'vatNumber', 'foreignTaxId', 'bankAccountReference']);

/** The reasons the activation reports that the app has words for (`OwnerReadinessReasons` of the API); another one is shown by its code. */
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

/**
 * «Dati finanziari» of an owner (E06/F05/US02/T01, T04, NF-109, NF-110, ADR-012): the fiscal profile in force with its identifiers, address and bank
 * account masked, the mandate, the settlement currency, how revenue and costs are recognized, the rule set that applies with the approval of the
 * accountant, and what is still missing in the activation, each fact with the place where it is completed. Only who manages the owners' finances
 * receives the values in full, and even they see them masked until they ask: the page never asks for the full IBAN of the registry. The versions of the mandate and the
 * structured billing address of the owner (E13/F02/US01/T01) follow the same rule: they are written only by who manages the owners' finances, and read-only otherwise. While the issuance of fiscal documents is on,
 * the page also has the issuer profile of the owner (E17/F03/US01/T01: who issues the documents of its stays, with its sezionale) and the export for the accountant of the owner of the documents issued in its name
 * (E17/F03/US01/T03); the server says who may change the first and who may download the second. Behind the flag `taxReportingExports` it also has the apartments the owner lets short outside the agency, with the
 * limit of a private person (E18/F02/US01/T01, `OwnerTaxChecksSection`), and the warning «impresa presunta» that the activation gives an owner past it (`OwnerWarnings`).
 */
export function OwnerFinancialProfilePage() {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();
  const { ownerId } = useParams();

  if (!isOrgBillingAdmin(contexts)) {
    return (
      <div className="space-y-6" data-testid="owner-profile-page">
        <PageHeader title={t('ownerProfile.titleGeneric')} crumbs="auto" />
        <FinanceAdminRequired />
      </div>
    );
  }
  return <ProfileBody key={ownerId} ownerId={ownerId ?? ''} />;
}

function ProfileBody({ ownerId }: { ownerId: string }) {
  const { t } = useTranslation();
  const owners = useOwnerNames();
  const profiles = useFiscalProfiles(ownerId);
  const policies = useAccountingPolicies();
  const onboarding = useOwnerOnboardingReadiness();
  const [dialog, setDialog] = useState<'profile' | 'policy' | null>(null);
  const [approving, setApproving] = useState<OwnerAccountingPolicy | null>(null);

  const [params] = useSearchParams();
  const owner = owners.data?.find((candidate) => candidate.id === ownerId);
  const ownerName = owner ? `${owner.firstName} ${owner.lastName}`.trim() : t('ownerAccounting.owner.unnamed', { id: shortId(ownerId) });
  const title = t('ownerProfile.title', { owner: ownerName });
  const today = todayInRome();
  // The month that sent the person here (`?period=2026-10`, from the month-end close), else the month to close: the first profile of an owner starts by default on the first day
  // of it, and the page says when the data does not reach back to it.
  const fromMonth = params.has('period');
  const period = parsePeriod(params.get('period'), defaultPeriod(todayInRome()));
  const backTo = fromMonth ? closePath(period.year, period.month) : OWNER_CLOSE_PATH;

  const profileList = useMemo(() => profiles.data ?? [], [profiles.data]);
  const policyList = useMemo(() => policies.data ?? [], [policies.data]);
  const readiness = useMemo<OwnerReadiness | null>(() => (profiles.data && policies.data ? ownerReadinessOn(profileList, policyList, today) : null), [profiles.data, policies.data, profileList, policyList, today]);
  const current = profileList.find((profile) => profile.validFrom <= today && (profile.validTo === null || profile.validTo >= today)) ?? profileList[0] ?? null;
  const policyOfCurrent = current?.accountingPolicyId ? (policyList.find((policy) => policy.id === current.accountingPolicyId) ?? null) : null;
  // The person who may not see the values in full may not change them either: the first profile of an owner is the one case where the form is offered blind.
  const canEdit = current ? !current.masked : true;

  const newVersion = canEdit && readiness ? { label: t('ownerProfile.newVersion'), onClick: () => setDialog('profile'), testId: 'profile-new-version' } : undefined;

  let content: ReactNode = null;
  if (profiles.isPending || policies.isPending) {
    content = <SkeletonCard lines={5} label={t('ownerProfile.loading')} />;
  } else if (getHttpStatus(profiles.error) === 404) {
    // An owner that does not exist (or that belongs to another organization) is «not found», however the page got here: the way out is the month.
    content = (
      <Alert
        variant="warning"
        title={t('ownerProfile.notFound')}
        action={
          <Button asChild size="sm" variant="outline">
            <Link to={backTo}>{t('ownerAccounting.statement.backToClose')}</Link>
          </Button>
        }
        data-testid="profile-not-found"
      >
        {t('ownerProfile.notFoundBody')}
      </Alert>
    );
  } else if (profiles.isError || policies.isError || !readiness) {
    content = (
      <OwnerAccountingError
        error={profiles.error ?? policies.error}
        title={t('ownerProfile.loadError')}
        onRetry={() => {
          void profiles.refetch();
          void policies.refetch();
        }}
      />
    );
  } else {
    const ownerEntry = onboarding.data?.owners.find((candidate) => candidate.ownerId === ownerId);
    const properties = onboarding.data?.properties ?? [];
    // The data covers the months from `from`: a month before it that sent the person here stays blocked, and nothing on this page can move the data back to it.
    const startsAfterTheMonth = fromMonth && readiness.ready && readiness.from > startOfPeriod(period);
    content = (
      <div className="space-y-8">
        <ReadinessFocus
          readiness={readiness}
          uncovered={startsAfterTheMonth ? period : null}
          canEdit={canEdit}
          backTo={backTo}
          onEdit={() => setDialog('profile')}
          onApprove={setApproving}
          onNewPolicy={() => setDialog('policy')}
        />
        <FinanceSectionLinks label={title} links={[
          ...(current ? [{ id: 'profile-facts', label: t('ownerProfile.facts.title'), icon: Wallet }] : []),
          { id: 'profile-policy', label: t('ownerProfile.policy.title'), icon: ScrollText },
          { id: 'profile-onboarding', label: t('ownerProfile.onboarding.title'), icon: ClipboardCheck },
          ...(profileList.length > 1 ? [{ id: 'profile-history', label: t('ownerProfile.history.title'), icon: HistoryIcon }] : []),
        ]} />
        <OwnerWarnings warnings={ownerEntry?.warnings ?? []} />
        {current?.masked ? (
          <Alert variant="info" data-testid="profile-masked-notice">
            {t('ownerProfile.maskedNotice')}
          </Alert>
        ) : null}
        {current ? <ProfileFacts profile={current} policy={policyOfCurrent} /> : <p className="break-words text-sm text-foreground/70">{t('ownerProfile.noProfile')}</p>}
        <OwnerMandateSection ownerId={ownerId} currency={current?.settlementCurrency ?? null} canManage={canEdit} />
        <OwnerAddressSection ownerId={ownerId} canManage={canEdit} />
        <OwnerIssuerProfileSection ownerId={ownerId} />
        <OwnerTaxChecksSection ownerId={ownerId} canManage={canEdit} />
        <OwnerIssuedDocumentsSection ownerId={ownerId} />
        <PolicyPanel policy={policyOfCurrent} all={policyList} canManage={canEdit} onApprove={setApproving} onNew={() => setDialog('policy')} />
        <OnboardingFacts loaded={onboarding.data !== undefined} available={onboarding.data !== null} reasons={ownerEntry?.reasons ?? []} properties={properties} />
        {profileList.length > 1 ? <History profiles={profileList} policies={policyList} currentId={current?.id} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="owner-profile-page">
      <PageHeader
        title={title}
        description={t('ownerProfile.description')}
        crumbs={[{ label: t('ownerAccounting.title'), to: backTo }, { label: title }]}
        primary={newVersion}
      />
      {content}
      {dialog === 'profile' ? (
        <ProfileDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          ownerId={ownerId}
          from={current && !current.masked ? current : null}
          policies={policyList}
          suggestedFrom={startOfPeriod(period)}
          latestStart={latestProfileStart(profileList)}
        />
      ) : null}
      {dialog === 'policy' ? <PolicyDialog open onOpenChange={(open) => !open && setDialog(null)} /> : null}
      {approving ? <ApprovePolicyDialog policy={approving} onClose={() => setApproving(null)} /> : null}
    </div>
  );
}

interface ReadinessFocusProps {
  readiness: OwnerReadiness;
  /** The month that sent the person here when the data start after it: it stays blocked, and that is what the block says. */
  uncovered: Period | null;
  canEdit: boolean;
  /** Where the way back goes: the month-end close, on the month that sent the person here when there is one. */
  backTo: string;
  onEdit: () => void;
  onApprove: (policy: OwnerAccountingPolicy) => void;
  onNewPolicy: () => void;
}

/**
 * The one highlighted block: whether the owner can be used for the statements and the payouts, and the next step if not. It is judged on today, and says from which day the data
 * holds: a profile that starts today does not cover the months before it. When the month that sent the person here is one of those, the block says so itself, as a warning: a
 * green «pronti» above a yellow «quel mese resta bloccato» said two opposite things (UX round 2026-11).
 */
function ReadinessFocus({ readiness, uncovered, canEdit, backTo, onEdit, onApprove, onNewPolicy }: ReadinessFocusProps) {
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
  const primary = needsApproval && policy
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

/**
 * What the activation says the agency should know about the owner without it stopping the accounting (`warnings` of `GET api/onboarding/owners/readiness`, E18/F01/US03/T01): today `short_let_business_presumed`, the
 * owner lets more apartments than a private person may (the ones the agency manages and the ones it declared outside it), so it is presumed to run a business and its stays get no withholding of the short lets. The
 * suggestion is a business issuer profile, which this page has just below. A warning is never red and never blocks: the statements and the payouts go on. A code this version does not know says so.
 */
function OwnerWarnings({ warnings }: { warnings: readonly OwnerOnboardingWarning[] }) {
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

/** The data is ready, but from a day after the month that sent the person here: that month stays blocked, and the page says so instead of «ready». */
function ProfileFacts({ profile, policy }: { profile: OwnerFiscalProfile; policy: OwnerAccountingPolicy | null }) {
  const { t } = useTranslation();
  const { date } = useOwnerFormat();
  const [reveal, setReveal] = useState(false);

  const optionLabel = (field: 'mandateRole' | 'revenueRecognitionRule' | 'expenseCommissionModel' | 'workingCapitalRule', value: string | null) => {
    if (value === null) return null;
    const known: readonly string[] = PROFILE_OPTIONS[field];
    return known.includes(value) ? t(`ownerProfile.options.${field}.${value}`) : value;
  };
  const sensitive = (field: string, value: string | null): string | null => (SENSITIVE.has(field) && !profile.masked && !reveal ? maskValue(value) : value);

  const rows: [string, string | null][] = [
    ['entityKind', t(`ownerProfile.options.entityKind.${profile.entityKind}`)],
    ['legalName', sensitive('legalName', profile.legalName)],
    ['taxResidenceCountry', profile.taxResidenceCountry],
    ['legalAddress', sensitive('legalAddress', profile.legalAddress)],
    ['fiscalCode', sensitive('fiscalCode', profile.fiscalCode)],
    ['vatNumber', sensitive('vatNumber', profile.vatNumber)],
    ['foreignTaxId', sensitive('foreignTaxId', profile.foreignTaxId)],
    ['settlementCurrency', profile.settlementCurrency],
    ['bankAccountReference', sensitive('bankAccountReference', profile.bankAccountReference)],
    ['mandateRole', optionLabel('mandateRole', profile.mandateRole)],
    ['mandateFrom', profile.mandateFrom ? date(profile.mandateFrom) : null],
    ['mandateTo', profile.mandateTo ? date(profile.mandateTo) : null],
    ['revenueRecognitionRule', optionLabel('revenueRecognitionRule', profile.revenueRecognitionRule)],
    ['expenseCommissionModel', optionLabel('expenseCommissionModel', profile.expenseCommissionModel)],
    ['workingCapitalRule', optionLabel('workingCapitalRule', profile.workingCapitalRule)],
    ['taxJurisdiction', profile.taxJurisdiction],
  ];

  return (
    <PlainSection title={t('ownerProfile.facts.title')} id="profile-facts" className="scroll-mt-24" data-testid="profile-facts">
      <p className="break-words text-sm text-foreground/70">
        {profile.validTo ? t('ownerProfile.facts.validBetween', { from: date(profile.validFrom), to: date(profile.validTo) }) : t('ownerProfile.facts.validFrom', { from: date(profile.validFrom) })}
        {policy ? ` · ${t('ownerProfile.facts.rule', { rule: policy.ruleCode, version: policy.version })}` : ''}
      </p>
      <div className="space-y-6">
        {FACT_GROUPS.map((group) => (
          <section key={group.title} className="space-y-3 border-t border-border pt-5" aria-label={t(`ownerProfile.wizard.steps.${group.title}`)}>
            <h3 className="font-semibold">{t(`ownerProfile.wizard.steps.${group.title}`)}</h3>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2" data-masked={profile.masked}>
              {rows.filter(([field]) => group.fields.includes(field)).map(([field, value]) => (
                <div key={field} className="min-w-0">
                  <dt className="text-sm text-foreground/60">{t(`ownerProfile.fields.${field}`)}</dt>
                  <dd className="mt-1 break-words text-sm font-medium" data-testid={`profile-value-${field}`}>
                    {value === null || value === '' ? <span className="font-normal text-foreground/60">{t('ownerProfile.facts.empty')}</span> : value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      {!profile.masked ? (
        <Button type="button" variant="outline" size="sm" aria-pressed={reveal} onClick={() => setReveal((current) => !current)} data-testid="profile-reveal">
          {reveal ? t('ownerProfile.facts.hide') : t('ownerProfile.facts.reveal')}
        </Button>
      ) : null}
    </PlainSection>
  );
}

interface PolicyPanelProps {
  policy: OwnerAccountingPolicy | null;
  all: readonly OwnerAccountingPolicy[];
  canManage: boolean;
  onApprove: (policy: OwnerAccountingPolicy) => void;
  onNew: () => void;
}

/** The rule set the profile follows and the approval of the accountant: the parameters as data, the source, and who approved it and when. */
function PolicyPanel({ policy, all, canManage, onApprove, onNew }: PolicyPanelProps) {
  const { t } = useTranslation();
  const { date, dateTime, percent } = useOwnerFormat();
  const parameters = policy?.parameters ?? null;
  const newAction = canManage ? { actionLabel: t('ownerProfile.policy.new'), onAction: onNew, actionTestId: NEW_POLICY_TEST_ID } : {};

  return (
    <PlainSection
      id="profile-policy" className="scroll-mt-24"
      title={t('ownerProfile.policy.title')}
      {...newAction}
      data-testid="profile-policy-section"
    >
      {policy ? (
        <div className="space-y-2">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="break-words">{t('ownerProfile.policy.name', { rule: policy.ruleCode, version: policy.version, jurisdiction: policy.jurisdiction })}</span>
            {policy.approved ? <Badge variant="success">{t('ownerProfile.policy.approved')}</Badge> : <Badge variant="warning">{t('ownerProfile.policy.pending')}</Badge>}
          </p>
          <p className="break-words text-sm text-foreground/70" data-testid="policy-approval">
            {policy.approved ? t('ownerProfile.policy.approvedBy', { name: policy.approvedByName ?? '', date: dateTime(policy.approvedAt) }) : t('ownerProfile.policy.waiting')}
          </p>
          <p className="break-words text-sm text-foreground/70">
            {policy.validTo ? t('ownerProfile.facts.validBetween', { from: date(policy.validFrom), to: date(policy.validTo) }) : t('ownerProfile.facts.validFrom', { from: date(policy.validFrom) })}
          </p>
          <p className="break-words text-sm">
            <a href={policy.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">
              {t('ownerProfile.policy.source')}
            </a>
            <span className="text-foreground/70"> · {t('ownerProfile.policy.hash', { hash: policy.sourceSha256.slice(0, 12) })}</span>
          </p>
          {parameters ? (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2" data-testid="policy-parameters">
              <Row label={t('ownerProfile.policy.withholding')} value={parameters.withholdingApplies ? t('ownerProfile.policy.yes') : t('ownerProfile.policy.no')} />
              {parameters.withholdingApplies ? (
                <>
                  <Row label={t('ownerProfile.policy.rate')} value={typeof parameters.withholdingRatePercent === 'number' ? percent(parameters.withholdingRatePercent) : '—'} />
                  <Row label={t('ownerProfile.policy.taxCode')} value={parameters.withholdingTaxCode ?? '—'} />
                  <Row label={t('ownerProfile.policy.components')} value={parameters.grossBaseComponents.join(', ') || '—'} />
                </>
              ) : null}
              <Row label={t('ownerProfile.policy.rounding')} value={parameters.rounding ? t(`ownerProfile.policy.roundingValue.${parameters.rounding}`) : '—'} />
              <Row label={t('ownerProfile.policy.retention')} value={typeof parameters.retentionYears === 'number' ? t('ownerProfile.policy.years', { count: parameters.retentionYears }) : '—'} />
            </dl>
          ) : null}
          {!policy.approved && canManage ? (
            <Button type="button" size="sm" onClick={() => onApprove(policy)} data-testid="policy-approve">
              {t('ownerProfile.policy.approve')}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="break-words text-sm text-foreground/70">{t('ownerProfile.policy.none')}</p>
      )}
      {all.length > 0 ? <p className="text-sm text-foreground/70">{t('ownerProfile.policy.available', { count: all.length })}</p> : null}
    </PlainSection>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-foreground/70">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

interface OnboardingFactsProps {
  /** The activation answered (even to say it is not available). */
  loaded: boolean;
  /** The activation module is on: its readiness exists. */
  available: boolean;
  reasons: readonly OwnerOnboardingReason[];
  /** The properties of the activation: the periods where their shares are wrong. */
  properties: readonly OwnerOnboardingProperty[];
}

/** What the activation still misses on this owner (the registry, the shares, the mandate, the payment data): the facts are completed there, and each says so with a link. */
function OnboardingFacts({ loaded, available, reasons, properties }: OnboardingFactsProps) {
  const { t } = useTranslation();
  const { date } = useOwnerFormat();
  if (!loaded) return null;
  const propertyNames = new Map(properties.map((property) => [property.propertyId, property.name] as const));
  // The shares of the properties this owner is missing something on, by period: where the owner's ownership and its shares are wrong.
  const shareProblems = properties.filter((property) => reasons.some((reason) => reason.propertyId === property.propertyId) && property.issues.length > 0);
  const periodOf = (issue: OwnershipIssue) => (issue.to ? t('ownerProfile.ownership.until', { date: date(issue.to) }) : t('ownerProfile.ownership.onward'));

  return (
    <PlainSection title={t('ownerProfile.onboarding.title')} count={reasons.length} id="profile-onboarding" className="scroll-mt-24" data-testid="profile-onboarding">
      {!available ? (
        <p className="break-words text-sm text-foreground/70">{t('ownerProfile.onboarding.unavailable')}</p>
      ) : reasons.length === 0 ? (
        <p className="break-words text-sm text-foreground/70" data-testid="profile-onboarding-complete">
          {t('ownerProfile.onboarding.complete')}
        </p>
      ) : (
        <div className="space-y-3">
          <ul role="list" className="space-y-2 text-sm" data-testid="profile-onboarding-reasons">
            {reasons.map((reason, index) => (
              <li key={`${reason.dimension}-${reason.code}-${reason.propertyId ?? ''}-${index}`} className="break-words" data-code={reason.code}>
                {(KNOWN_REASONS as readonly string[]).includes(reason.code) ? t(`ownerProfile.reason.${camelCode(reason.code)}`) : t('ownerProfile.reason.other', { code: reason.code })}
                {reason.propertyId && propertyNames.get(reason.propertyId) ? <span className="text-foreground/70"> · {propertyNames.get(reason.propertyId)}</span> : null}
              </li>
            ))}
          </ul>
          {shareProblems.length > 0 ? (
            <div className="space-y-1 text-sm" data-testid="profile-ownership-issues">
              <h3 className="font-semibold">{t('ownerProfile.ownership.title')}</h3>
              <ul role="list" className="space-y-1">
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
        </div>
      )}
    </PlainSection>
  );
}

function History({ profiles, policies, currentId }: { profiles: readonly OwnerFiscalProfile[]; policies: readonly OwnerAccountingPolicy[]; currentId: string | undefined }) {
  const { t } = useTranslation();
  const { date } = useOwnerFormat();

  return (
    <PlainSection title={t('ownerProfile.history.title')} count={profiles.length} id="profile-history" className="scroll-mt-24" data-testid="profile-history">
      <ul role="list" className="divide-y divide-border text-sm">
        {profiles.map((profile) => {
          const policy = policies.find((candidate) => candidate.id === profile.accountingPolicyId);
          return (
            <li key={profile.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="break-words font-medium">
                {profile.validTo ? t('ownerProfile.facts.validBetween', { from: date(profile.validFrom), to: date(profile.validTo) }) : t('ownerProfile.facts.validFrom', { from: date(profile.validFrom) })}
              </span>
              <span className="break-words text-foreground/70">{policy ? t('ownerProfile.facts.rule', { rule: policy.ruleCode, version: policy.version }) : t('ownerProfile.history.noRule')}</span>
              {profile.id === currentId ? <Badge variant="outline">{t('ownerProfile.history.current')}</Badge> : null}
            </li>
          );
        })}
      </ul>
    </PlainSection>
  );
}
