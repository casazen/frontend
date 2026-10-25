import { LeaseDocumentsPanel } from './components/lease-documents-panel';
import { useId, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ChevronDown, FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
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
import { LeaseDataTab } from './components/lease-data-tab';
import { LeaseDeadlinesTab } from './components/lease-deadlines-tab';
import { LeaseHistory } from './components/lease-history';
import { LeaseNowBlock } from './components/lease-now-block';
import { LeaseSigningPanel } from './components/lease-signing-panel';
import { RentSchedulePanel } from './components/rent-schedule-panel';
import { LeaseGuide } from './guide/lease-guide';
import { leasePropertyLine, leaseRentText } from './lib/lease-list-format';
import { useCfDeliveredContract } from './lib/cf-import';
import { describeLeaseStep } from './lib/lease-next-step';
import { DEFAULT_LEASE_TAB, isPartnerDraft, leaseTabOf, type LeaseTab } from './lib/lease-sheet';
import { useLeaseActions } from './lifecycle/use-lease-actions';
import { CfImportPanel } from './components/cf-import-panel';
import { PartnerDraftNotice } from './components/partner-draft-notice';
import { ContinueDraftNotice } from './components/continue-draft-notice';

const LEASES_PATH = '/app/long-rent/leases';

/** The tenants by name ("Giulia Verdi e Acme Srl"), or what stands in their place while there is none. */
function leaseTitle(lease: LeaseDetail, language: string, t: TFunction): string {
  const names = (lease.parties ?? [])
    .filter((party) => party.role === 'Tenant')
    .map((party) => `${party.firstName} ${party.lastName}`.trim())
    .filter(Boolean);
  if (names.length === 0) return t('leaseList.tenant.missing');
  return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(names);
}

/** Under the title: "Casa Trastevere · Roma · Canone libero (4+4) · 950,00 €/mese". */
function leasePurpose(lease: LeaseDetail, t: TFunction): string {
  const type = lease.contractType ? getLeaseContractTypeLabel(lease.contractType, t) : getFiscalRegimeLabel(lease.fiscalRegime, t);
  return [leasePropertyLine(lease, t), type, leaseRentText(lease, t)].join(' · ');
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

/**
 * The sheet of a lease (LR-03): who it is with and where, the state that explains itself, the one thing to do now, then five tabs
 * (Guida, Dati, Documenti, Pagamenti, Scadenze: `?tab=`) and the history of the lease beside them. The sheet opens on the guide
 * (LR-GUIDE-1): what to do about the contract, with the advice for its type and moment and the tools to decide; `Dati` is only the data.
 * The panels of the signature, the registration, the Questura communication and the rent are the ones that existed, moved here.
 * What can be done to the lease while it lives (delete the draft, record a notice, end it early…) is in the menu «⋯» of the header
 * and opens from the address too (`?azione=`, LR-10).
 */
function LeaseSheet({ lease, nextStep, stage }: { lease: LeaseDetail; nextStep: LeaseNextStep | null; stage: LeaseStage | undefined }) {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  // A concordato draft made for the partner: the contract comes from ConcordatoFacile, not from the signature panel of CasaZen. Its
  // notice is its one voice, so the step of the server is not laid over it.
  const partnerDraft = isPartnerDraft(lease);
  // The contract the partner delivered, uploaded to that draft (CF-IMPORT): the notice that waited for it gives way to the one that
  // goes on (where the reading stands and «Completa e importa il contratto»), which is then the one voice of the draft, and the way
  // in to the partner's service (the practice is done) is not offered any more. Null for any lease that is not that draft.
  const cfContract = useCfDeliveredContract(lease);
  const step = partnerDraft || cfContract ? null : nextStep;
  // The sheet opens on the guide; the button of «Cosa devi fare ora» leads to the tab where its step is done (an address with `?tab=`
  // is always obeyed, the old names of the tabs too).
  const tab = leaseTabOf(searchParams.get('tab'), DEFAULT_LEASE_TAB);
  const [explainOpen, setExplainOpen] = useState(false);
  const explainId = useId();

  const parties = lease.parties ?? [];
  const showQuestura = lease.hasExtraEUTenant || parties.some((party) => party.role === 'Tenant' && party.isExtraEU);
  // «Cosa devi fare ora» (LR-03b): the step the server says the lease waits for (`nextStep`, read from its row in the list of leases) is
  // the one colored block of the page, under the header. No step, no block: a lease the list has no step for is the sheet it was. A step
  // that is there says what the draft notice says, so it gives way to it (one voice, not two); the guide does not repeat it either.
  const now = step ? describeLeaseStep(lease.id, step, { t, language: i18n.language, today: todayInRome() }) : null;

  const tabs: TabItem<LeaseTab>[] = [
    { value: 'guida', label: t('leaseGuide.tab'), testId: 'lease-tab-guida' },
    { value: 'dati', label: t('leaseSheet.tabs.data'), testId: 'lease-tab-dati' },
    { value: 'documenti', label: t('leaseSheet.tabs.documents'), testId: 'lease-tab-documenti' },
    { value: 'pagamenti', label: t('leaseSheet.tabs.payments'), testId: 'lease-tab-pagamenti' },
    { value: 'scadenze', label: t('leaseSheet.tabs.deadlines'), testId: 'lease-tab-scadenze' },
  ];

  const title = leaseTitle(lease, i18n.language, t);
  const actions = useLeaseActions(lease, { tenant: title, property: lease.property?.name ?? t('leaseList.property.unknown') });

  return (
    <div className="min-w-0 space-y-6" data-testid="lease-sheet">
      <PageHeader
        crumbs="auto"
        title={title}
        description={leasePurpose(lease, t)}
        action={<StatusToggle status={lease.status} open={explainOpen} controls={explainId} onToggle={() => setExplainOpen((open) => !open)} />}
        secondary={actions.menu}
      />

      {explainOpen ? (
        <div id={explainId} data-testid="lease-status-explainer" className="border-s-2 border-border ps-4">
          <StatusExplainer kind="lease" status={lease.status} />
        </div>
      ) : null}

      {now ? <LeaseNowBlock step={now} /> : null}

      {cfContract ? <CfImportPanel leaseId={lease.id} reading={cfContract} /> : partnerDraft ? <PartnerDraftNotice leaseId={lease.id} /> : null}
      {lease.status === 'Draft' && !partnerDraft && !cfContract && !now ? <ContinueDraftNotice leaseId={lease.id} /> : null}

      {/* One column under 780 px of room (measured on this box, not on the screen: the menu takes part of it). */}
      <div className="@container min-w-0">
        <div className="grid gap-8 @min-[780px]:grid-cols-[minmax(0,1fr)_17rem]">
          <Tabs label={t('leaseSheet.tabs.label')} items={tabs} value={tab} defaultValue={DEFAULT_LEASE_TAB}>
            {tab === 'guida' && <LeaseGuide lease={lease} stage={stage} stepCode={step?.code ?? null} />}
            {tab === 'dati' && <LeaseDataTab lease={lease} onRequestErasure={actions.requestErasure} />}
            {tab === 'documenti' && <div className="space-y-6"><LeaseDocumentsPanel leaseId={lease.id} />{partnerDraft ? null : <LeaseSigningPanel lease={lease} />}</div>}
            {tab === 'pagamenti' && <RentSchedulePanel leaseId={lease.id} leaseStatus={lease.status} term={{ startDate: lease.startDate, endDate: lease.endDate }} />}
            {tab === 'scadenze' && <LeaseDeadlinesTab lease={lease} showQuestura={showQuestura} />}
          </Tabs>
          <LeaseHistory leaseId={lease.id} events={lease.events ?? []} />
        </div>
      </div>

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
        <BackLink to={LEASES_PATH} label={t('nav.leases')} className="md:inline-flex" />
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
          action={{ label: t('leases.backToList'), href: LEASES_PATH }}
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
