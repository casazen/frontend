import { Calculator, CalendarRange, Clock, ExternalLink, Eye, EyeOff, Hash, History as HistoryIcon, IdCard, Info, Landmark, Lock, Pencil, Percent, Plus, Receipt, Scale, ShieldCheck, UserRound, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { OwnerAccountingPolicy, OwnerFiscalProfile } from '@/types';
import { PROFILE_OPTIONS } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { shownValue } from '../owner-profile-model';
import { OwnerIssuedDocumentsSection } from './issued-documents-export';
import { OwnerAddressSection } from './owner-address-form';
import { OwnerIssuerProfileSection } from './owner-issuer-profile-form';
import { OwnerMandateSection } from './owner-mandate-form';
import { OwnerTaxChecksSection } from './owner-tax-checks-section';
import { Fact, FactGrid, Metric, MetricRow, OwnerCard, PanelGrid, QuietNote, StateChip } from './owner-ui';

const NEW_POLICY_TEST_ID = 'policy-new';

type OptionField = 'mandateRole' | 'revenueRecognitionRule' | 'expenseCommissionModel' | 'workingCapitalRule';

function EditButton({ label, step, onEdit }: { label: string; step: number; onEdit: (step: number) => void }) {
  const { t } = useTranslation();
  return (
    <Button type="button" variant="outline" size="sm" aria-label={`${t('ownerProfile.actions.edit')}: ${label}`} onClick={() => onEdit(step)} data-testid={`profile-edit-${step}`}>
      <Pencil aria-hidden="true" className="size-4" />
      {t('ownerProfile.actions.edit')}
    </Button>
  );
}

function NoProfile({ canEdit, onEdit }: { canEdit: boolean; onEdit: (step: number) => void }) {
  const { t } = useTranslation();
  return (
    <OwnerCard icon={IdCard} title={t('ownerProfile.facts.title')} data-testid="profile-empty">
      <p className="break-words text-sm text-foreground/70">{t('ownerProfile.noProfile')}</p>
      {canEdit ? (
        <Button type="button" onClick={() => onEdit(0)} data-testid="profile-empty-complete">
          {t('ownerProfile.focus.complete')}
        </Button>
      ) : null}
    </OwnerCard>
  );
}

function RevealBar({ profile, revealed, onToggle }: { profile: OwnerFiscalProfile; revealed: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  if (profile.masked) {
    return (
      <QuietNote icon={Lock} data-testid="profile-masked-notice">
        {t('ownerProfile.maskedNotice')}
      </QuietNote>
    );
  }
  const Icon = revealed ? EyeOff : Eye;
  return (
    <div className="flex justify-end">
      <Button type="button" variant="ghost" size="sm" aria-pressed={revealed} onClick={onToggle} data-testid="profile-reveal">
        <Icon aria-hidden="true" className="size-4" />
        {revealed ? t('ownerProfile.facts.hide') : t('ownerProfile.facts.reveal')}
      </Button>
    </div>
  );
}

function useOptionLabel() {
  const { t } = useTranslation();
  return (field: OptionField, value: string | null): string | null => {
    if (value === null) return null;
    const known: readonly string[] = PROFILE_OPTIONS[field];
    return known.includes(value) ? t(`ownerProfile.options.${field}.${value}`) : value;
  };
}

interface ProfilePanelProps {
  profile: OwnerFiscalProfile | null;
  canEdit: boolean;
  onEdit: (step: number) => void;
}

interface SensitivePanelProps extends ProfilePanelProps {
  revealed: boolean;
  onToggleReveal: () => void;
}

const isBlank = (value: string | null | undefined): boolean => value === null || value === undefined || value.trim() === '';

function TodoChip() {
  const { t } = useTranslation();
  return <StateChip tone="warning">{t('ownerProfile.status.todo')}</StateChip>;
}

export function IdentityPanel({ profile, canEdit, revealed, onToggleReveal, onEdit }: SensitivePanelProps) {
  const { t } = useTranslation();
  if (!profile) return <NoProfile canEdit={canEdit} onEdit={onEdit} />;
  const shown = (field: string, value: string | null) => shownValue(profile, field, value, revealed);
  const identityTitle = t('ownerProfile.wizard.steps.identity');
  const taxTitle = t('ownerProfile.wizard.steps.tax');
  const noIdentifier = isBlank(profile.fiscalCode) && isBlank(profile.vatNumber) && isBlank(profile.foreignTaxId);
  const identityTodo = isBlank(profile.legalName);
  const taxTodo = isBlank(profile.taxResidenceCountry) || noIdentifier;
  return (
    <div className="space-y-4" data-testid="profile-facts">
      <RevealBar profile={profile} revealed={revealed} onToggle={onToggleReveal} />
      <PanelGrid>
        <OwnerCard
          icon={profile.entityKind === 'LegalEntity' ? Building2 : UserRound}
          title={identityTitle}
          chip={identityTodo ? <TodoChip /> : undefined}
          action={canEdit ? <EditButton label={identityTitle} step={0} onEdit={onEdit} /> : undefined}
        >
          <FactGrid data-masked={profile.masked}>
            <Fact label={t('ownerProfile.fields.entityKind')} value={t(`ownerProfile.options.entityKind.${profile.entityKind}`)} testId="profile-value-entityKind" />
            <Fact label={t('ownerProfile.fields.legalName')} value={shown('legalName', profile.legalName)} testId="profile-value-legalName" required />
          </FactGrid>
        </OwnerCard>
        <OwnerCard icon={IdCard} title={taxTitle} chip={taxTodo ? <TodoChip /> : undefined} action={canEdit ? <EditButton label={taxTitle} step={1} onEdit={onEdit} /> : undefined}>
          <FactGrid>
            <Fact label={t('ownerProfile.fields.taxResidenceCountry')} value={profile.taxResidenceCountry} testId="profile-value-taxResidenceCountry" required />
            <Fact label={t('ownerProfile.fields.legalAddress')} value={shown('legalAddress', profile.legalAddress)} testId="profile-value-legalAddress" />
            <Fact label={t('ownerProfile.fields.fiscalCode')} value={shown('fiscalCode', profile.fiscalCode)} testId="profile-value-fiscalCode" required={noIdentifier} />
            <Fact label={t('ownerProfile.fields.vatNumber')} value={shown('vatNumber', profile.vatNumber)} testId="profile-value-vatNumber" />
            <Fact label={t('ownerProfile.fields.foreignTaxId')} value={shown('foreignTaxId', profile.foreignTaxId)} testId="profile-value-foreignTaxId" />
          </FactGrid>
        </OwnerCard>
      </PanelGrid>
    </div>
  );
}

export function PaymentsPanel({ ownerId, profile, canEdit, revealed, onToggleReveal, onEdit }: SensitivePanelProps & { ownerId: string }) {
  const { t } = useTranslation();
  if (!profile) return <NoProfile canEdit={canEdit} onEdit={onEdit} />;
  const title = t('ownerProfile.wizard.steps.payment');
  const todo = isBlank(profile.settlementCurrency) || isBlank(profile.bankAccountReference);
  return (
    <div className="space-y-4" data-testid="profile-payments">
      <RevealBar profile={profile} revealed={revealed} onToggle={onToggleReveal} />
      <PanelGrid>
        <OwnerCard icon={Landmark} title={title} chip={todo ? <TodoChip /> : undefined} action={canEdit ? <EditButton label={title} step={2} onEdit={onEdit} /> : undefined}>
          <FactGrid data-masked={profile.masked}>
            <Fact label={t('ownerProfile.fields.settlementCurrency')} value={profile.settlementCurrency} testId="profile-value-settlementCurrency" required />
            <Fact
              label={t('ownerProfile.fields.bankAccountReference')}
              value={shownValue(profile, 'bankAccountReference', profile.bankAccountReference, revealed)}
              testId="profile-value-bankAccountReference"
              required
            />
          </FactGrid>
        </OwnerCard>
        <OwnerAddressSection ownerId={ownerId} canManage={canEdit} />
      </PanelGrid>
    </div>
  );
}

export function MandatePanel({ ownerId, profile, canEdit, onEdit }: ProfilePanelProps & { ownerId: string }) {
  const { t } = useTranslation();
  const { date } = useOwnerFormat();
  const optionLabel = useOptionLabel();
  const title = t('ownerProfile.panels.role');
  return (
    <div className="space-y-4" data-testid="profile-mandate">
      <OwnerMandateSection ownerId={ownerId} currency={profile?.settlementCurrency ?? null} canManage={canEdit} />
      {profile ? (
        <OwnerCard icon={ShieldCheck} title={title} action={canEdit ? <EditButton label={title} step={3} onEdit={onEdit} /> : undefined} data-testid="profile-role">
          <FactGrid columns={3}>
            <Fact label={t('ownerProfile.fields.mandateRole')} value={optionLabel('mandateRole', profile.mandateRole)} testId="profile-value-mandateRole" />
            <Fact label={t('ownerProfile.fields.mandateFrom')} value={profile.mandateFrom ? date(profile.mandateFrom) : null} testId="profile-value-mandateFrom" />
            <Fact label={t('ownerProfile.fields.mandateTo')} value={profile.mandateTo ? date(profile.mandateTo) : null} testId="profile-value-mandateTo" />
          </FactGrid>
        </OwnerCard>
      ) : null}
    </div>
  );
}

export function DocumentsPanel({ ownerId }: { ownerId: string }) {
  return (
    <div className="space-y-4" data-testid="profile-documents">
      <OwnerIssuerProfileSection ownerId={ownerId} />
    </div>
  );
}

interface PolicyCardProps {
  policy: OwnerAccountingPolicy | null;
  canManage: boolean;
  onApprove: (policy: OwnerAccountingPolicy) => void;
  onNew: () => void;
}

function PolicyCard({ policy, canManage, onApprove, onNew }: PolicyCardProps) {
  const { t } = useTranslation();
  const { date, dateTime, percent } = useOwnerFormat();
  const parameters = policy?.parameters ?? null;
  const metrics = parameters
    ? [
        { key: 'withholding', icon: Receipt, label: t('ownerProfile.policy.withholding'), value: parameters.withholdingApplies ? t('ownerProfile.policy.yes') : t('ownerProfile.policy.no') },
        ...(parameters.withholdingApplies
          ? [
              { key: 'rate', icon: Percent, label: t('ownerProfile.policy.rate'), value: typeof parameters.withholdingRatePercent === 'number' ? percent(parameters.withholdingRatePercent) : '—' },
              { key: 'taxCode', icon: Hash, label: t('ownerProfile.policy.taxCode'), value: parameters.withholdingTaxCode ?? '—' },
            ]
          : []),
        { key: 'retention', icon: Clock, label: t('ownerProfile.policy.retention'), value: typeof parameters.retentionYears === 'number' ? t('ownerProfile.policy.years', { count: parameters.retentionYears }) : '—' },
      ]
    : [];

  return (
    <OwnerCard
      icon={Scale}
      title={t('ownerProfile.policy.title')}
      id="profile-policy"
      data-testid="profile-policy-section"
      chip={policy ? policy.approved ? <StateChip tone="success">{t('ownerProfile.policy.approved')}</StateChip> : <StateChip tone="warning">{t('ownerProfile.policy.pending')}</StateChip> : null}
      action={
        canManage ? (
          <Button type="button" variant="outline" size="sm" onClick={onNew} data-testid={NEW_POLICY_TEST_ID}>
            <Plus aria-hidden="true" className="size-4" />
            {t('ownerProfile.policy.new')}
          </Button>
        ) : undefined
      }
    >
      {policy ? (
        <>
          <div className="min-w-0">
            <p className="break-words text-base font-semibold">{t('ownerProfile.policy.name', { rule: policy.ruleCode, version: policy.version, jurisdiction: policy.jurisdiction })}</p>
            <p className="mt-1 break-words text-sm text-foreground/70" data-testid="policy-approval">
              {policy.approved ? t('ownerProfile.policy.approvedBy', { name: policy.approvedByName ?? '', date: dateTime(policy.approvedAt) }) : t('ownerProfile.policy.waiting')}
            </p>
          </div>
          {metrics.length > 0 ? (
            <MetricRow columns={Math.min(4, metrics.length) as 1 | 2 | 3 | 4} data-testid="policy-parameters">
              {metrics.map(({ key, ...metric }) => (
                <Metric key={key} {...metric} />
              ))}
            </MetricRow>
          ) : null}
          <FactGrid>
            <Fact label={t('ownerProfile.policy.validity')} value={policy.validTo ? t('ownerProfile.facts.validBetween', { from: date(policy.validFrom), to: date(policy.validTo) }) : t('ownerProfile.facts.validFrom', { from: date(policy.validFrom) })} />
            {parameters ? <Fact label={t('ownerProfile.policy.rounding')} value={parameters.rounding ? t(`ownerProfile.policy.roundingValue.${parameters.rounding}`) : null} /> : null}
            {parameters?.withholdingApplies ? <Fact label={t('ownerProfile.policy.components')} value={parameters.grossBaseComponents.join(', ') || null} /> : null}
            <Fact
              label={t('ownerProfile.policy.source')}
              value={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <a href={policy.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary-text underline underline-offset-4">
                    {t('ownerProfile.policy.openSource')}
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                  <span className="font-normal text-foreground/70">{t('ownerProfile.policy.hash', { hash: policy.sourceSha256.slice(0, 12) })}</span>
                </span>
              }
            />
          </FactGrid>
          {!policy.approved && canManage ? (
            <Button type="button" size="sm" onClick={() => onApprove(policy)} data-testid="policy-approve">
              {t('ownerProfile.policy.approve')}
            </Button>
          ) : null}
        </>
      ) : (
        <p className="break-words text-sm text-foreground/70">{t('ownerProfile.policy.none')}</p>
      )}
    </OwnerCard>
  );
}

interface RulePanelProps extends ProfilePanelProps {
  ownerId: string;
  policy: OwnerAccountingPolicy | null;
  onApprove: (policy: OwnerAccountingPolicy) => void;
  onNewPolicy: () => void;
}

export function RulePanel({ ownerId, profile, policy, canEdit, onEdit, onApprove, onNewPolicy }: RulePanelProps) {
  const { t } = useTranslation();
  const optionLabel = useOptionLabel();
  const modelTitle = t('ownerProfile.wizard.steps.model');
  return (
    <div className="space-y-4" data-testid="profile-rule">
      <PolicyCard policy={policy} canManage={canEdit} onApprove={onApprove} onNew={onNewPolicy} />
      <PanelGrid>
        {profile ? (
          <OwnerCard
            icon={Calculator}
            title={modelTitle}
            chip={isBlank(profile.revenueRecognitionRule) || isBlank(profile.taxJurisdiction) ? <TodoChip /> : undefined}
            action={canEdit ? <EditButton label={modelTitle} step={4} onEdit={onEdit} /> : undefined}
            data-testid="profile-model"
          >
            <FactGrid>
              <Fact label={t('ownerProfile.fields.revenueRecognitionRule')} value={optionLabel('revenueRecognitionRule', profile.revenueRecognitionRule)} testId="profile-value-revenueRecognitionRule" required />
              <Fact label={t('ownerProfile.fields.expenseCommissionModel')} value={optionLabel('expenseCommissionModel', profile.expenseCommissionModel)} testId="profile-value-expenseCommissionModel" />
              <Fact label={t('ownerProfile.fields.workingCapitalRule')} value={optionLabel('workingCapitalRule', profile.workingCapitalRule)} testId="profile-value-workingCapitalRule" />
              <Fact label={t('ownerProfile.fields.taxJurisdiction')} value={profile.taxJurisdiction} testId="profile-value-taxJurisdiction" required />
            </FactGrid>
          </OwnerCard>
        ) : null}
        <OwnerTaxChecksSection ownerId={ownerId} canManage={canEdit} />
      </PanelGrid>
    </div>
  );
}

interface ReportsPanelProps {
  ownerId: string;
  profiles: readonly OwnerFiscalProfile[];
  policies: readonly OwnerAccountingPolicy[];
  currentId: string | undefined;
  documentsEnabled: boolean;
}

export function ReportsPanel({ ownerId, profiles, policies, currentId, documentsEnabled }: ReportsPanelProps) {
  const { t } = useTranslation();
  const { date } = useOwnerFormat();
  return (
    <div className="space-y-4" data-testid="profile-reports">
      {documentsEnabled ? <OwnerIssuedDocumentsSection ownerId={ownerId} /> : null}
      {profiles.length > 0 ? (
        <OwnerCard icon={HistoryIcon} title={t('ownerProfile.history.title')} id="profile-history" data-testid="profile-history">
          <ul role="list" className="divide-y divide-border rounded-lg border border-border text-sm">
            {profiles.map((profile) => {
              const policy = policies.find((candidate) => candidate.id === profile.accountingPolicyId);
              return (
                <li key={profile.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                  <CalendarRange aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
                  <span className="min-w-0 break-words font-medium">
                    {profile.validTo ? t('ownerProfile.facts.validBetween', { from: date(profile.validFrom), to: date(profile.validTo) }) : t('ownerProfile.facts.validFrom', { from: date(profile.validFrom) })}
                  </span>
                  <span className="min-w-0 break-words text-foreground/70">{policy ? t('ownerProfile.facts.rule', { rule: policy.ruleCode, version: policy.version }) : t('ownerProfile.history.noRule')}</span>
                  {profile.id === currentId ? <StateChip tone="success" className="ms-auto">{t('ownerProfile.history.current')}</StateChip> : null}
                </li>
              );
            })}
          </ul>
        </OwnerCard>
      ) : null}
      {!documentsEnabled && profiles.length === 0 ? <QuietNote icon={Info}>{t('ownerProfile.reports.empty')}</QuietNote> : null}
    </div>
  );
}
