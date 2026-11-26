import { LeaseDocumentsPanel } from './components/lease-documents-panel';
import { useId, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { BookOpen, CalendarDays, ChevronDown, ClipboardList, FileText, FolderOpen, Users, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import type { PageHeaderMenuItem } from '@/components/layout/page-header-actions';
import { BackLink } from '@/components/shared/back-link';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { StatusExplainer } from '@/components/shared/status/status-explainer';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { useLease, useLeaseListStage, useLeaseNextStep } from '@/queries/use-leases';
import { getHttpStatus } from '@/lib/api-errors';
import { getFiscalRegimeLabel, getLeaseContractTypeLabel } from '@/lib/i18n-labels';
import { todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { LeaseDetail, LeaseNextStep, LeaseStage, LeaseStatus } from '@/types';
import { LeaseTenantsTab } from './components/lease-tenants-tab';
import { LONG_RENT_PROPERTIES_PATH, longRentPropertyPath } from '@/features/properties/long-rent/paths';
import { LeaseDataTab } from './components/lease-data-tab';
import { LeaseDeadlinesTab } from './components/lease-deadlines-tab';
import { LeaseFiles } from './components/lease-files';
import { LeaseHistory } from './components/lease-history';
import { LeaseNowBlock } from './components/lease-now-block';
import { LeaseSigningPanel } from './components/lease-signing-panel';
import { useLeaseSheetMenu } from './components/use-lease-sheet-menu';
import { RentSchedulePanel } from './components/rent-schedule-panel';
import { LeaseGuide } from './guide/lease-guide';
import { leasePropertyLine, leaseRentText, leaseTermText } from './lib/lease-list-format';
import { useCfCompletion } from './lib/cf-completion';
import { useCfDeliveredContract } from './lib/cf-import';
import { describeLeaseStep } from './lib/lease-next-step';
import { DEFAULT_LEASE_TAB, isServiceDraft, leaseTabOf, type LeaseTab } from './lib/lease-sheet';
import { LEASE_OPERATION_PARAM, leaseOperationOf } from './operations/operation-ids';
import { useLeaseActions } from './lifecycle/use-lease-actions';
import { CfImportPanel } from './components/cf-import-panel';
import { PartnerDraftNotice } from './components/partner-draft-notice';
import { ContinueDraftNotice } from './components/continue-draft-notice';


/** The tenants by name ("Giulia Verdi e Acme Srl"), or what stands in their place while there is none. */
function leaseTitle(lease: LeaseDetail, language: string, t: TFunction): string {
  const names = (lease.parties ?? [])
    .filter((party) => party.role === 'Tenant')
    .map((party) => `${party.firstName} ${party.lastName}`.trim())
    .filter(Boolean);
  if (names.length === 0) return t('leaseList.tenant.missing');
  return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(names);
}

function LeaseFacts({ lease }: { lease: LeaseDetail }) {
  const { t, i18n } = useTranslation();
  const type = lease.contractType ? getLeaseContractTypeLabel(lease.contractType, t) : getFiscalRegimeLabel(lease.fiscalRegime, t);
  const facts = [
    [t('rent.focus.leaseType'), type],
    [t('leaseList.columns.term'), leaseTermText(lease, t, i18n.language)],
    [t('rent.focus.monthlyRent'), leaseRentText(lease, t)],
  ];
  return (
    <dl data-testid="lease-facts" className="grid min-w-0 gap-2 sm:grid-cols-3">
      {facts.map(([label, value]) => (
        <div key={label} className="flex min-w-0 items-baseline justify-between gap-3 rounded-xl border bg-card px-4 py-3 sm:block">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words text-right text-base font-semibold tabular-nums sm:mt-1 sm:text-left">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The state of the lease: a badge that is also the button that explains it. */
function StatusToggle({ status, open, controls, onToggle }: { status: LeaseStatus; open: boolean; controls: string; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      onClick={onToggle}
      data-testid="lease-status-toggle"
      className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-full outline-hidden ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:min-h-0"
    >
      <StatusBadge kind="lease" status={status} size="lg" />
      <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
      <span className="sr-only">{t('leaseSheet.status.explain')}</span>
    </button>
  );
}

/** Contract details are the landing section; the guide and the history open on demand. */
function LeaseSheet({ lease, nextStep, stage }: { lease: LeaseDetail; nextStep: LeaseNextStep | null; stage: LeaseStage | undefined }) {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  // A concordato draft of the guided service (the one made for it, or one the server marked as its own): the contract comes from the
  // service, not from the signature panel of CasaZen, and no data of it is typed. The card is its one voice, so the step of the server is
  // not laid over it.
  const serviceDraft = isServiceDraft(lease);
  // The contract the service delivered, uploaded to that draft (CF-IMPORT): the card that waited for it gives way to the one that goes on
  // (the practice, where the reading stands and «Completa e importa il contratto»), which is then the one voice of the draft, and the way
  // in to the service (the practice is done) is not offered any more. Null for any lease that is not that draft.
  const cfContract = useCfDeliveredContract(lease);
  // Keeps the lease moving along with its practice: reads the uploaded documents into the draft, imports the contract as signed and declares
  // the registration when the practice and the documents allow it, and asks the sheet to read the lease again when it changed.
  const completion = useCfCompletion(lease);
  const step = serviceDraft || cfContract ? null : nextStep;
  const operation = leaseOperationOf(searchParams.get(LEASE_OPERATION_PARAM));
  const tab = searchParams.get('registrationCheckout') === 'success'
    ? 'scadenze'
    : leaseTabOf(searchParams.get('tab'), operation ? 'guida' : DEFAULT_LEASE_TAB);
  const [explainOpen, setExplainOpen] = useState(false);
  const explainId = useId();

  const parties = lease.parties ?? [];
  const showQuestura = lease.hasExtraEUTenant || parties.some((party) => party.role === 'Tenant' && party.isExtraEU);
  const now = step ? describeLeaseStep(lease.id, step, { t, language: i18n.language, today: todayInRome() }) : null;

  const tabs: TabItem<LeaseTab>[] = [
    { value: 'dati', icon: ClipboardList, label: t('leaseSheet.tabs.data'), testId: 'lease-tab-dati' },
    { value: 'inquilini', icon: Users, label: t('nav.longRentTenants'), testId: 'lease-tab-inquilini' },
    { value: 'documenti', icon: FolderOpen, label: t('leaseSheet.tabs.documents'), testId: 'lease-tab-documenti' },
    { value: 'pagamenti', icon: Wallet, label: t('leaseSheet.tabs.canoni'), testId: 'lease-tab-pagamenti' },
    { value: 'scadenze', icon: CalendarDays, label: t('leaseSheet.tabs.deadlines'), testId: 'lease-tab-scadenze' },
    { value: 'guida', icon: BookOpen, label: t('leaseGuide.tab'), testId: 'lease-tab-guida' },
  ];

  const title = leaseTitle(lease, i18n.language, t);
  const actions = useLeaseActions(lease, { tenant: title, property: lease.property?.name ?? t('leaseList.property.unknown') });
  const links = useLeaseSheetMenu(lease, { serviceDraft });
  // What changes the lease comes after what only takes somewhere, apart; the one that destroys is the last of the menu (LR-10).
  const menu: PageHeaderMenuItem[] = actions.menu.length > 0 ? [...links, { separator: true }, ...actions.menu] : links;

  return (
    <div className="min-w-0 space-y-6" data-testid="lease-sheet">
      <PageHeader
        crumbs={[
          { label: t('nav.properties'), to: LONG_RENT_PROPERTIES_PATH },
          { label: lease.property?.name ?? t('leaseList.property.unknown'), to: `${longRentPropertyPath(lease.propertyId)}?tab=contracts` },
          { label: title },
        ]}
        title={title}
        description={leasePropertyLine(lease, t)}
        action={<StatusToggle status={lease.status} open={explainOpen} controls={explainId} onToggle={() => setExplainOpen((open) => !open)} />}
        secondary={menu}
      />

      {tab === 'dati' && <LeaseFacts lease={lease} />}
      {explainOpen ? (
        <div id={explainId} data-testid="lease-status-explainer" className="border-s-2 border-border ps-4">
          <StatusExplainer kind="lease" status={lease.status} explain={serviceDraft ? t('leaseSheet.status.serviceDraft') : undefined} />
        </div>
      ) : null}

      {(tab === 'dati' || tab === 'guida') && (cfContract ? (
        <CfImportPanel leaseId={lease.id} reading={cfContract} syncState={completion.state} />
      ) : serviceDraft ? (
        <PartnerDraftNotice leaseId={lease.id} syncState={completion.state} />
      ) : null)}
      {(tab === 'dati' || tab === 'guida') && lease.status === 'Draft' && !serviceDraft && !cfContract && !now ? <ContinueDraftNotice leaseId={lease.id} /> : null}

      <Tabs label={t('leaseSheet.tabs.label')} items={tabs} value={tab} defaultValue={DEFAULT_LEASE_TAB} selectTestId="lease-sheet-tabs">
        {tab === 'guida' && (
          <div className="min-w-0 space-y-5">
            {now && <LeaseNowBlock step={now} />}
            <LeaseGuide lease={lease} stage={stage} stepCode={step?.code ?? null} />
          </div>
        )}
        {tab === 'inquilini' && <LeaseTenantsTab lease={lease} onRequestErasure={actions.requestErasure} />}
        {tab === 'dati' && (
          <div className="min-w-0 space-y-5">
            <LeaseDataTab lease={lease} onRequestErasure={actions.requestErasure} />
            <LeaseHistory key={searchParams.get('tab')} leaseId={lease.id} events={lease.events ?? []} initiallyOpen={searchParams.get('tab') === 'cronologia'} />
          </div>
        )}
        {tab === 'documenti' && <div className="space-y-6"><LeaseFiles lease={lease} /><LeaseDocumentsPanel leaseId={lease.id} />{serviceDraft ? null : <LeaseSigningPanel lease={lease} />}</div>}
        {tab === 'pagamenti' && <RentSchedulePanel leaseId={lease.id} leaseStatus={lease.status} term={{ startDate: lease.startDate, endDate: lease.endDate }} />}
        {tab === 'scadenze' && <LeaseDeadlinesTab lease={lease} showQuestura={showQuestura} />}
      </Tabs>

      {actions.dialogs}
    </div>
  );
}

export function LeaseDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: lease, isLoading, isError, error, refetch } = useLease(id!);
  // The step the lease waits for is not in its detail yet: it is read from its row in the list of leases, asked together with the lease.
  const nextStep = useLeaseNextStep(id!);
  // Where it stands on its path comes with the step, from the same row of the same list: the guide knows the moment of the lease when it opens.
  const listStage = useLeaseListStage(id!);

  if (isLoading) {
    return <LoadingScreen message={t('leases.detailLoading')} className="h-auto flex-1" />;
  }

  // Only a 404 means "not found": a 500, a 403 or a network error is a load error with retry (A7-27).
  if (isError && getHttpStatus(error) !== 404) {
    return (
      <div className="min-w-0 space-y-4">
        <BackLink to={LONG_RENT_PROPERTIES_PATH} label={t('nav.properties')} className="md:inline-flex" />
        <ErrorState testId="lease-load-error" title={t('leases.detailLoadError')} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!lease) {
    return (
      <div data-testid="lease-not-found">
        <EmptyState
          icon={FileText}
          title={t('leases.notFound')}
          description={t('leases.notFoundDescription')}
          action={{ label: t('longRentProperties.detail.backToList'), href: LONG_RENT_PROPERTIES_PATH }}
        />
      </div>
    );
  }

  // The block «Cosa devi fare ora» and the guide come from the step and the stage of the list, so the sheet waits for the list to answer
  // (or to fail: then it is the sheet it always was, with no error on the screen). A list that is fresh in the cache answers at once;
  // one that is old, or that an action marked as old (a contract just made or signed in the wizard), would give the step of before, so
  // its new answer is waited for. It is the only wait: once the list has answered, a later reading of it (after an action) never takes
  // the sheet away.
  const stepKnown = nextStep.isFetchedAfterMount || (nextStep.isFetched && !nextStep.isStale);
  if (!stepKnown) {
    return <LoadingScreen message={t('leases.detailLoading')} className="h-auto flex-1" />;
  }

  return <LeaseSheet key={lease.id} lease={lease} nextStep={nextStep.data ?? null} stage={listStage.data} />;
}
