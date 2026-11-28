import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, FileChartColumn, FileSignature, FileText, IdCard, Landmark, Scale, UserRound, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { todayInRome } from '@/lib/stay-dates';
import { useAccountingPolicies, useFiscalProfiles, useOwnerMandates, useOwnerNames, useOwnerOnboardingReadiness } from '@/queries/use-owner-accounting';
import { useOwnerIssuerProfile } from '@/queries/use-owner-issuer-profile';
import type { OwnerAccountingPolicy } from '@/types';
import { FinanceAdminRequired, OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import {
  OWNER_CLOSE_PATH,
  closePath,
  defaultPeriod,
  latestProfileStart,
  ownerReadinessOn,
  parsePeriod,
  shortId,
  startOfPeriod,
  type OwnerReadiness,
} from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { ActivationCheck, OwnerWarnings, PathSection, ReadinessFocus, type PathStep } from './components/owner-profile-overview';
import { DocumentsPanel, IdentityPanel, MandatePanel, PaymentsPanel, ReportsPanel, RulePanel } from './components/owner-profile-panels';
import { StateChip } from './components/owner-ui';
import { ApprovePolicyDialog, PolicyDialog } from './components/policy-dialog';
import { ProfileDialog } from './components/profile-dialog';
import { useStepSummaries } from './components/use-step-summaries';
import {
  PATH_TABS,
  documentsState,
  identityState,
  mandateState,
  parseTab,
  paymentsState,
  ruleState,
  type OwnerTab,
  type PathTab,
  type StepState,
} from './owner-profile-model';

const TAB_ICON: Record<OwnerTab, LucideIcon> = {
  overview: ClipboardCheck,
  identity: IdCard,
  payments: Landmark,
  mandate: FileSignature,
  documents: FileText,
  rule: Scale,
  reports: FileChartColumn,
};

type Dialog = { kind: 'profile'; step: number } | { kind: 'policy' } | null;

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
  const { date } = useOwnerFormat();
  const { flags } = useFeatureFlags();
  const documentsEnabled = isFeatureEnabled(flags, 'fiscalDocumentIssuance');
  const owners = useOwnerNames();
  const profiles = useFiscalProfiles(ownerId);
  const policies = useAccountingPolicies();
  const onboarding = useOwnerOnboardingReadiness();
  const mandates = useOwnerMandates(ownerId);
  const issuer = useOwnerIssuerProfile(ownerId, documentsEnabled);
  const summaries = useStepSummaries();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [approving, setApproving] = useState<OwnerAccountingPolicy | null>(null);
  const [revealed, setRevealed] = useState(false);

  const [params] = useSearchParams();
  const owner = owners.data?.find((candidate) => candidate.id === ownerId);
  const ownerName = owner ? `${owner.firstName} ${owner.lastName}`.trim() : t('ownerAccounting.owner.unnamed', { id: shortId(ownerId) });
  const title = t('ownerProfile.title', { owner: ownerName });
  const today = todayInRome();
  const fromMonth = params.has('period');
  const period = parsePeriod(params.get('period'), defaultPeriod(todayInRome()));
  const backTo = fromMonth ? closePath(period.year, period.month) : OWNER_CLOSE_PATH;

  const profileList = useMemo(() => profiles.data ?? [], [profiles.data]);
  const policyList = useMemo(() => policies.data ?? [], [policies.data]);
  const readiness = useMemo<OwnerReadiness | null>(() => (profiles.data && policies.data ? ownerReadinessOn(profileList, policyList, today) : null), [profiles.data, policies.data, profileList, policyList, today]);
  const current = profileList.find((profile) => profile.validFrom <= today && (profile.validTo === null || profile.validTo >= today)) ?? profileList[0] ?? null;
  const policyOfCurrent = current?.accountingPolicyId ? (policyList.find((policy) => policy.id === current.accountingPolicyId) ?? null) : null;
  const canEdit = current ? !current.masked : true;
  const startsAfterTheMonth = fromMonth && readiness !== null && readiness.ready && readiness.from > startOfPeriod(period);

  const openProfile = (step: number) => setDialog({ kind: 'profile', step });
  const newVersion = canEdit && readiness ? { label: t('ownerProfile.newVersion'), onClick: () => openProfile(0), testId: 'profile-new-version' } : undefined;

  const description = current
    ? current.validTo
      ? t('ownerProfile.summary.inForceBetween', { from: date(current.validFrom), to: date(current.validTo) })
      : t('ownerProfile.summary.inForce', { from: date(current.validFrom) })
    : t('ownerProfile.descriptionShort');
  const status =
    readiness === null ? undefined : readiness.ready ? (
      startsAfterTheMonth ? (
        <StateChip tone="warning" data-testid="profile-status">{t('ownerProfile.status.notCovered')}</StateChip>
      ) : (
        <StateChip tone="success" data-testid="profile-status">{t('ownerProfile.status.ready', { from: date(readiness.from) })}</StateChip>
      )
    ) : (
      <StateChip tone="warning" data-testid="profile-status">{t('ownerProfile.status.todo')}</StateChip>
    );

  let content: ReactNode = null;
  if (profiles.isPending || policies.isPending) {
    content = <SkeletonCard lines={5} label={t('ownerProfile.loading')} />;
  } else if (getHttpStatus(profiles.error) === 404) {
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
    const states: Record<PathTab, StepState> = {
      identity: identityState(readiness),
      payments: paymentsState(readiness),
      mandate: mandateState(mandates.data, today),
      documents: documentsEnabled ? documentsState(issuer.data) : 'unknown',
      rule: ruleState(readiness),
    };
    const pathTabs = PATH_TABS.filter((tab) => tab !== 'documents' || documentsEnabled);
    const available: OwnerTab[] = ['overview', ...pathTabs, 'reports'];
    const tab = parseTab(params.get('tab'), available);
    const stepInputs = { profile: current, policy: policyOfCurrent, mandates: mandates.data, issuer: issuer.data, today };
    const pathSteps: PathStep[] = pathTabs.map((pathTab) => ({ tab: pathTab, state: states[pathTab], ...summaries[pathTab](stepInputs) }));
    const tabs: TabItem<OwnerTab>[] = available.map((value) => {
      const state = value === 'overview' || value === 'reports' ? 'unknown' : states[value];
      return {
        value,
        icon: TAB_ICON[value],
        label: t(`ownerProfile.tabs.${value}`),
        testId: `owner-tab-${value}`,
        state: state === 'unknown' ? undefined : { tone: state === 'done' ? 'success' : 'warning', label: t(`ownerProfile.tabs.${state}`) },
      };
    });

    let panel: ReactNode;
    switch (tab) {
      case 'identity':
        panel = <IdentityPanel profile={current} canEdit={canEdit} revealed={revealed} onToggleReveal={() => setRevealed((value) => !value)} onEdit={openProfile} />;
        break;
      case 'payments':
        panel = <PaymentsPanel ownerId={ownerId} profile={current} canEdit={canEdit} revealed={revealed} onToggleReveal={() => setRevealed((value) => !value)} onEdit={openProfile} />;
        break;
      case 'mandate':
        panel = <MandatePanel ownerId={ownerId} profile={current} canEdit={canEdit} onEdit={openProfile} />;
        break;
      case 'documents':
        panel = <DocumentsPanel ownerId={ownerId} />;
        break;
      case 'rule':
        panel = (
          <RulePanel
            ownerId={ownerId}
            profile={current}
            policy={policyOfCurrent}
            canEdit={canEdit}
            onEdit={openProfile}
            onApprove={setApproving}
            onNewPolicy={() => setDialog({ kind: 'policy' })}
          />
        );
        break;
      case 'reports':
        panel = <ReportsPanel ownerId={ownerId} profiles={profileList} policies={policyList} currentId={current?.id} documentsEnabled={documentsEnabled} />;
        break;
      default:
        panel = (
          <div className="space-y-6">
            <ReadinessFocus
              readiness={readiness}
              uncovered={startsAfterTheMonth ? period : null}
              canEdit={canEdit}
              backTo={backTo}
              onEdit={() => openProfile(0)}
              onApprove={setApproving}
              onNewPolicy={() => setDialog({ kind: 'policy' })}
            />
            <OwnerWarnings warnings={ownerEntry?.warnings ?? []} />
            <PathSection steps={pathSteps} />
            <ActivationCheck loaded={onboarding.data !== undefined} available={onboarding.data !== null} reasons={ownerEntry?.reasons ?? []} properties={onboarding.data?.properties ?? []} />
          </div>
        );
    }

    content = (
      <Tabs layout="sidebar" label={t('ownerProfile.tabs.label')} items={tabs} defaultValue="overview" value={tab} selectTestId="owner-tabs-select" panelTestId="owner-tab-panel">
        {panel}
      </Tabs>
    );
  }

  return (
    <div className="min-w-0 space-y-6" data-testid="owner-profile-page">
      <PageHeader
        title={title}
        icon={UserRound}
        description={description}
        status={status}
        crumbs={[{ label: t('ownerAccounting.title'), to: backTo }, { label: title }]}
        primary={newVersion}
      />
      {content}
      {dialog?.kind === 'profile' ? (
        <ProfileDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          ownerId={ownerId}
          from={current && !current.masked ? current : null}
          policies={policyList}
          suggestedFrom={startOfPeriod(period)}
          latestStart={latestProfileStart(profileList)}
          startAt={dialog.step}
        />
      ) : null}
      {dialog?.kind === 'policy' ? <PolicyDialog open onOpenChange={(open) => !open && setDialog(null)} /> : null}
      {approving ? <ApprovePolicyDialog policy={approving} onClose={() => setApproving(null)} /> : null}
    </div>
  );
}
