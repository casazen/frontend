import { useMemo, type ReactNode } from 'react';
import { AlertCircle, CalendarRange, Euro, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListDefinition, ListOption } from '@/components/shared/list-view/list-types';
import { LONG_RENT_PROPERTY_CREATE_PATH } from '@/features/properties/long-rent/paths';
import {
  getFiscalRegimeLabel,
  getLeaseContractTypeLabel,
  getLeaseStatusLabel,
  getLeaseTaxRegimeLabel,
} from '@/lib/i18n-labels';
import { parseStayDate, todayInRome } from '@/lib/stay-dates';
import { LEASE_CONTRACT_TYPES, LEASE_TAX_REGIMES, type LeaseStage, type LeaseSummary } from '@/types';
import { LeaseListDetail } from './components/lease-list-detail';
import { LeaseNextStepCell, LeaseProgressCell, LeaseStateBadge } from './components/lease-list-cells';
import {
  leaseNextRentText,
  leaseOverdueText,
  leaseProgressText,
  leasePropertyLine,
  leaseRentText,
  leaseTenantName,
  leaseTermText,
} from './lib/lease-list-format';
import { describeLeaseStep, leaseSheetPath } from './lib/lease-next-step';

/** The page of a lease: the row opens its drawer, and the drawer and the button of the row lead here. */
const leasePath = (lease: LeaseSummary) => leaseSheetPath(lease.id);

/** The stages in the order of the path: how the column «Stato» is sorted. */
const STAGE_ORDER: readonly LeaseStage[] = ['Draft', 'DataPending', 'InReview', 'SentForSignature', 'Signed', 'Active', 'Expiring', 'Concluded'];

/** The stages the filter offers: `DataPending` waits for the tenant's own data (phase 2) and the server never sends it. */
const FILTER_STAGES: readonly LeaseStage[] = ['Draft', 'InReview', 'SentForSignature', 'Signed', 'Active', 'Expiring', 'Concluded'];

/** The groups of the quick filters are those the overview counts and links to (`?chip=`): not registered yet, in force, about to end. */
const PREPARING: readonly LeaseStage[] = ['Draft', 'DataPending', 'InReview', 'SentForSignature', 'Signed'];
const SIGNING: readonly LeaseStage[] = ['SentForSignature', 'Signed'];
const ACTIVE: readonly LeaseStage[] = ['Active', 'Expiring'];

const stageIn = (lease: LeaseSummary, stages: readonly LeaseStage[]) => lease.stage !== undefined && stages.includes(lease.stage);

/** What waits for the landlord: a step of theirs that is not the «all good» of the system (priority 9 and over). The server decides both. */
const isToDo = (lease: LeaseSummary) => lease.nextStep?.actor === 'Landlord' && lease.nextStep.priority < 9;

const isLate = (lease: LeaseSummary) => (lease.overdueRentCount ?? 0) > 0;

/** The day the period in force ends (`YYYY-MM-DD`): the end of the first period until the lease renews. */
const periodEnd = (lease: LeaseSummary) => parseStayDate(lease.currentTermEndDate ?? lease.endDate);

/** Whether a day (`YYYY-MM-DD`) is inside a range of days with either end open; a lease without the day is out of any range. */
function dayInRange(day: string, range: { from?: string; to?: string }): boolean {
  if (!day) return false;
  return (range.from === undefined || day >= range.from) && (range.to === undefined || day <= range.to);
}

/**
 * The most urgent first: the lower the priority of the step, the nearer its day. A number the sort compares, built from the two things the
 * server says (`priority`, 0 to 10, and the day it is due); a lease with no step goes last.
 */
function urgencyOf(lease: LeaseSummary): number | null {
  const step = lease.nextStep;
  if (!step) return null;
  const day = parseStayDate(step.dueOn);
  const days = day ? Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000) : 99_999;
  return step.priority * 100_000 + days;
}

/** «Libero 4+4», or the combined regime of an older lease that has no contract type. */
function contractTypeLabel(lease: LeaseSummary, t: TFunction): string {
  return lease.contractType ? getLeaseContractTypeLabel(lease.contractType, t) : getFiscalRegimeLabel(lease.fiscalRegime, t);
}

/** The line under the rent: what is late (the one thing in red), or when the next one is due. */
function rentNote(lease: LeaseSummary, t: TFunction, language: string): ReactNode {
  const overdue = leaseOverdueText(lease, t);
  if (overdue) {
    return (
      <span className="mt-0.5 flex items-start justify-end gap-1 text-sm font-medium text-danger-foreground">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">{overdue}</span>
      </span>
    );
  }
  const next = leaseNextRentText(lease, t, language);
  return next ? <span className="mt-0.5 block break-words text-sm text-foreground/70">{next}</span> : null;
}

/** The rent that is late, in red, on its own line; `null` when none is. */
function lateRentNote(lease: LeaseSummary, t: TFunction): ReactNode {
  const overdue = leaseOverdueText(lease, t);
  return overdue ? (
    <span className="mt-0.5 flex items-start gap-1 text-sm font-medium text-danger-foreground">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{overdue}</span>
    </span>
  ) : null;
}

/** The properties of the leases, once each, for the filter. */
function propertyOptions(rows: readonly LeaseSummary[], t: TFunction): readonly ListOption[] {
  const seen = new Map<string, string>();
  for (const lease of rows) {
    if (!seen.has(lease.propertyId)) seen.set(lease.propertyId, lease.property?.name ?? t('leaseList.property.unknown'));
  }
  return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The list of the long-term leases (LR-02, LR-02b, LR-02c) on the unified list (UI-14), in `client` mode: the server sends the whole
 * list (it is not paginated), so the quick filters, the filters of the drawer, the search and the order are the list's. What is filtered
 * and sorted on is only what the server decides and sends with each row (`stage`, `nextStep`, `progress`, the rent that is late): the
 * list works none of it out from raw fields.
 *
 * Each row says where the lease stands (stage), how far along it is (progress), what it waits for and whose turn it is (next step),
 * and its button does that step. The default order is the most urgent step first, the nearest day first. The quick filters are
 * «Da fare» (a step of the landlord that is not the all-good one), the groups of the overview (`preparing`, `active`, `expiring`, `ended`:
 * its links ask for them), «In firma», and «Con un canone in ritardo»; the two with a number are those that want attention.
 *
 * The saved views, the board by stage and the menu of the row (delete a draft, take back the download, end the lease, ask for an
 * intervention) are not here yet (LR-02d).
 */
export function buildLeaseList(t: TFunction, language: string): ListDefinition<LeaseSummary> {
  const stageOptions: ListOption[] = FILTER_STAGES.map((stage) => ({ value: stage, label: t(`status.leaseStage.${stage}.label`) }));
  const typeOptions: ListOption[] = LEASE_CONTRACT_TYPES.map((type) => ({ value: type, label: getLeaseContractTypeLabel(type, t) }));
  const regimeOptions: ListOption[] = LEASE_TAX_REGIMES.map((regime) => ({ value: regime, label: getLeaseTaxRegimeLabel(regime, t) }));
  const stepOf = (lease: LeaseSummary) =>
    lease.nextStep ? describeLeaseStep(lease.id, lease.nextStep, { t, language, today: todayInRome() }) : null;

  return defineList<LeaseSummary>({
    key: 'leases',
    title: t('nav.leases'),
    rowKey: (lease) => lease.id,
    rowLabel: (lease) => `${leaseTenantName(lease, t)} · ${leasePropertyLine(lease, t)}`,
    columns: [
      {
        id: 'tenant',
        label: t('leaseList.columns.tenant'),
        default: true,
        always: true,
        rowHeader: true,
        sort: (lease) => leaseTenantName(lease, t),
        render: (lease, cell) => (
          <span className="block min-w-0">
            {cell.open(leaseTenantName(lease, t))}
            <span className="mt-0.5 block break-words text-sm text-foreground/70">
              <span>{leasePropertyLine(lease, t)}</span> · <span>{leaseRentText(lease, t)}</span>
            </span>
            {/* A rent that is late is told by the next step of the lease; without one (an answer that has none) it is told here. */}
            {!lease.nextStep ? lateRentNote(lease, t) : null}
          </span>
        ),
        csv: (lease) => `${leaseTenantName(lease, t)} · ${leasePropertyLine(lease, t)}`,
      },
      {
        id: 'status',
        label: t('leaseList.columns.status'),
        default: true,
        sort: (lease) => (lease.stage ? STAGE_ORDER.indexOf(lease.stage) : null),
        render: (lease) => (
          <span className="flex flex-col items-start gap-1">
            <LeaseStateBadge lease={lease} />
            <span className="text-sm text-foreground/70">{contractTypeLabel(lease, t)}</span>
          </span>
        ),
        csv: (lease) => (lease.stage ? t(`status.leaseStage.${lease.stage}.label`) : getLeaseStatusLabel(lease.status, t)),
      },
      {
        id: 'progress',
        label: t('leaseList.columns.progress'),
        default: true,
        sort: (lease) => lease.progress?.percent ?? null,
        render: (lease) => <LeaseProgressCell lease={lease} />,
        csv: (lease) => (lease.progress ? leaseProgressText(lease.progress, t) : ''),
      },
      {
        id: 'next',
        label: t('leaseList.columns.next'),
        default: true,
        sort: urgencyOf,
        render: (lease) => <LeaseNextStepCell lease={lease} />,
        csv: (lease) => stepOf(lease)?.title ?? '',
      },
      {
        id: 'rent',
        label: t('leaseList.columns.rent'),
        align: 'end',
        sort: (lease) => lease.monthlyRent,
        render: (lease) => (
          <span className="block">
            <span className="block whitespace-nowrap font-medium">{leaseRentText(lease, t)}</span>
            {rentNote(lease, t, language)}
          </span>
        ),
        csv: (lease) => lease.monthlyRent,
      },
      {
        id: 'term',
        label: t('leaseList.columns.term'),
        sort: (lease) => periodEnd(lease),
        render: (lease) => leaseTermText(lease, t, language),
        csv: (lease) => leaseTermText(lease, t, language),
      },
      {
        id: 'regime',
        label: t('leaseList.columns.regime'),
        render: (lease) => (lease.taxRegime ? getLeaseTaxRegimeLabel(lease.taxRegime, t) : t('leases.taxRegimeUnknown')),
      },
      { id: 'parties', label: t('leaseList.columns.parties'), align: 'end', sort: (lease) => lease.partyCount, render: (lease) => lease.partyCount },
    ],
    search: {
      label: t('leaseList.search.label'),
      placeholder: t('leaseList.search.placeholder'),
      text: (lease) => [lease.tenantFirstName, lease.tenantLastName, lease.property?.name, lease.property?.city].filter(Boolean).join(' '),
    },
    chips: [
      { id: 'all', label: t('leaseList.chips.all') },
      { id: 'todo', label: t('leaseList.chips.todo'), hint: t('leaseList.chips.todoHint'), urgent: true, test: isToDo },
      { id: 'preparing', label: t('leaseList.chips.preparing'), hint: t('leaseList.chips.preparingHint'), test: (lease) => stageIn(lease, PREPARING) },
      { id: 'signing', label: t('leaseList.chips.signing'), hint: t('leaseList.chips.signingHint'), test: (lease) => stageIn(lease, SIGNING) },
      { id: 'active', label: t('leaseList.chips.active'), hint: t('leaseList.chips.activeHint'), test: (lease) => stageIn(lease, ACTIVE) },
      { id: 'expiring', label: t('leaseList.chips.expiring'), hint: t('leaseList.chips.expiringHint'), test: (lease) => lease.stage === 'Expiring' },
      { id: 'ended', label: t('leaseList.chips.ended'), hint: t('leaseList.chips.endedHint'), test: (lease) => lease.stage === 'Concluded' },
      { id: 'late', label: t('leaseList.chips.late'), hint: t('leaseList.chips.lateHint'), urgent: true, test: isLate },
    ],
    defaultChip: 'all',
    filters: [
      { id: 'stage', type: 'multi', label: t('leaseList.filters.stage'), options: stageOptions, test: (lease, values) => lease.stage !== undefined && values.includes(lease.stage) },
      { id: 'property', type: 'select', label: t('leaseList.filters.property'), options: (rows) => propertyOptions(rows, t), test: (lease, value) => lease.propertyId === value },
      { id: 'type', type: 'multi', label: t('leaseList.filters.type'), options: typeOptions, test: (lease, values) => values.includes(lease.contractType) },
      { id: 'regime', type: 'select', label: t('leaseList.filters.regime'), options: regimeOptions, test: (lease, value) => lease.taxRegime === value },
      { id: 'start', type: 'date', label: t('leaseList.filters.start'), test: (lease, range) => dayInRange(parseStayDate(lease.startDate), range) },
      { id: 'end', type: 'date', label: t('leaseList.filters.end'), test: (lease, range) => dayInRange(periodEnd(lease), range) },
    ],
    defaultSort: 'next:asc',
    // The button does the step the lease waits for; a lease with none just opens.
    primaryAction: (lease) => {
      const view = stepOf(lease);
      return view ? { id: 'next', label: view.action, href: view.to } : { id: 'open', label: t('leaseList.open'), href: leasePath(lease) };
    },
    detail: {
      title: (lease) => leaseTenantName(lease, t),
      description: (lease) => leasePropertyLine(lease, t),
      render: (lease) => <LeaseListDetail lease={lease} />,
      pageHref: leasePath,
    },
    // A rent that is late is the one thing in the list that cannot wait: a bar at the start of its row and the words in its cell.
    rowTone: (lease) => (isLate(lease) ? 'urgent' : undefined),
    card: (lease) => {
      const step = stepOf(lease);
      const overdue = leaseOverdueText(lease, t);
      return {
        title: leaseTenantName(lease, t),
        sub: leasePropertyLine(lease, t),
        status: <LeaseStateBadge lease={lease} />,
        meta: [
          ...(lease.progress ? [{ icon: CalendarRange, label: t('leaseList.columns.progress'), text: leaseProgressText(lease.progress, t) }] : []),
          { icon: Euro, label: t('leaseList.columns.rent'), text: leaseRentText(lease, t) },
        ],
        foot:
          overdue || step ? (
            <div className="space-y-1">
              {step ? <p className="break-words text-sm font-medium">{step.title}</p> : null}
              {overdue ? (
                <p className="flex items-start gap-1.5 text-sm font-medium text-danger-foreground">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{overdue}</span>
                </p>
              ) : null}
            </div>
          ) : undefined,
      };
    },
    // With the sidebar open (from `lg`) a table of four columns and a button is not seen whole under 1280 px: cards until then.
    cardsUntil: 'xl',
    csv: { fileName: 'contratti' },
    countLabel: (count) => t('leaseList.count', { count }),
    empty: {
      icon: FileText,
      title: t('leases.emptyTitle'),
      description: t('leases.guide.intro'),
      action: { label: t('leases.guide.property.cta'), href: LONG_RENT_PROPERTY_CREATE_PATH },
    },
    noResults: { title: t('leaseList.noResults.title'), description: t('leaseList.noResults.description') },
  });
}

/** The list of leases in the words of the person; it follows the language. */
export function useLeasesList(): ListDefinition<LeaseSummary> {
  const { t, i18n } = useTranslation();
  return useMemo(() => buildLeaseList(t, i18n.language), [t, i18n.language]);
}
