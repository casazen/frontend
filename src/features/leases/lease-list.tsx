import { useMemo, type ReactNode } from 'react';
import { AlertCircle, CalendarRange, Euro, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListDefinition } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { LONG_RENT_PROPERTY_CREATE_PATH } from '@/features/properties/long-rent/paths';
import { getFiscalRegimeLabel, getLeaseContractTypeLabel, getLeaseStatusLabel, getLeaseTaxRegimeLabel } from '@/lib/i18n-labels';
import type { LeaseListView, LeaseSummary } from '@/types';
import { LeaseListDetail } from './components/lease-list-detail';
import {
  leaseNextRentText,
  leaseOverdueText,
  leasePropertyLine,
  leaseRentText,
  leaseTenantName,
  leaseTermText,
} from './lib/lease-list-format';

/** The page of a lease: the row opens its drawer, and the drawer and the button of the row lead here. */
const leasePath = (lease: LeaseSummary) => `/app/long-rent/leases/${lease.id}`;

/**
 * The quick filters of the list and the view of `GET /leases?view=` each one asks the server for (LR-01). `All` is the plain
 * list, with no parameter. The views are the server's: the list does not work out from the raw fields which lease is active or
 * about to expire.
 */
const CHIP_VIEWS: Readonly<Record<string, LeaseListView>> = {
  all: 'All',
  active: 'Active',
  preparing: 'InPreparation',
  expiring: 'Expiring',
  ended: 'Ended',
};

/** The view of the API for a quick filter of the list; `undefined` for the whole list (no `view` in the request). */
export function leaseViewOfChip(chip: string): LeaseListView | undefined {
  const view = CHIP_VIEWS[chip];
  return view === 'All' ? undefined : view;
}

/** "Canone libero (4+4)"; the combined regime of an old lease that has no contract type. */
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

/**
 * The list of the long-term leases (LR-02) on the unified list (UI-14), in `server` mode: the quick filters are the views the
 * server knows (`?view=`) and the search is the one of the server (`?q=`: property, city, address and name of the tenant), so
 * the list shows the rows as the API gives them, newest first, and has no order or filter of its own.
 *
 * The design of the list also has the stage of the lease, how far along it is, its next step and a board by stage. They need
 * what the backend does not send yet (the stage, the progress and the next step of the contract path), and none is worked out
 * here from the raw fields: they come when the API sends them (a column and a button of the row, a chip "Da fare", the board).
 */
export function buildLeaseList(t: TFunction, language: string): ListDefinition<LeaseSummary> {
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
        render: (lease, cell) => (
          <span className="block min-w-0">
            {cell.open(leaseTenantName(lease, t))}
            <span className="mt-0.5 block break-words text-sm text-foreground/70">{leasePropertyLine(lease, t)}</span>
          </span>
        ),
        csv: (lease) => `${leaseTenantName(lease, t)} · ${leasePropertyLine(lease, t)}`,
      },
      {
        id: 'status',
        label: t('leaseList.columns.status'),
        default: true,
        render: (lease) => (
          <span className="flex flex-col items-start gap-1">
            <StatusBadge kind="lease" status={lease.status} />
            <span className="text-sm text-foreground/70">{contractTypeLabel(lease, t)}</span>
          </span>
        ),
        csv: (lease) => getLeaseStatusLabel(lease.status, t),
      },
      {
        id: 'term',
        label: t('leaseList.columns.term'),
        default: true,
        render: (lease) => leaseTermText(lease, t, language),
        csv: (lease) => leaseTermText(lease, t, language),
      },
      {
        id: 'rent',
        label: t('leaseList.columns.rent'),
        default: true,
        align: 'end',
        render: (lease) => (
          <span className="block">
            <span className="block whitespace-nowrap font-medium">{leaseRentText(lease, t)}</span>
            {rentNote(lease, t, language)}
          </span>
        ),
        csv: (lease) => lease.monthlyRent,
      },
      {
        id: 'regime',
        label: t('leaseList.columns.regime'),
        render: (lease) => (lease.taxRegime ? getLeaseTaxRegimeLabel(lease.taxRegime, t) : t('leases.taxRegimeUnknown')),
      },
      { id: 'parties', label: t('leaseList.columns.parties'), align: 'end', render: (lease) => lease.partyCount },
    ],
    search: { label: t('leaseList.search.label'), placeholder: t('leaseList.search.placeholder') },
    chips: [
      { id: 'all', label: t('leaseList.chips.all') },
      { id: 'active', label: t('leaseList.chips.active'), hint: t('leaseList.chips.activeHint') },
      { id: 'preparing', label: t('leaseList.chips.preparing'), hint: t('leaseList.chips.preparingHint') },
      { id: 'expiring', label: t('leaseList.chips.expiring'), hint: t('leaseList.chips.expiringHint') },
      { id: 'ended', label: t('leaseList.chips.ended'), hint: t('leaseList.chips.endedHint') },
    ],
    defaultChip: 'all',
    primaryAction: (lease) => ({ id: 'open', label: t('leaseList.open'), href: leasePath(lease) }),
    detail: {
      title: (lease) => leaseTenantName(lease, t),
      description: (lease) => leasePropertyLine(lease, t),
      render: (lease) => <LeaseListDetail lease={lease} />,
      pageHref: leasePath,
    },
    // A rent that is late is the one thing in the list that cannot wait: a bar at the start of its row and the words in its cell.
    rowTone: (lease) => ((lease.overdueRentCount ?? 0) > 0 ? 'urgent' : undefined),
    card: (lease) => {
      const overdue = leaseOverdueText(lease, t);
      return {
        title: leaseTenantName(lease, t),
        sub: leasePropertyLine(lease, t),
        status: <StatusBadge kind="lease" status={lease.status} />,
        meta: [
          { icon: CalendarRange, label: t('leaseList.columns.term'), text: leaseTermText(lease, t, language) },
          { icon: Euro, label: t('leaseList.columns.rent'), text: leaseRentText(lease, t) },
        ],
        foot: overdue ? (
          <p className="flex items-start gap-1.5 text-sm font-medium text-danger-foreground">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{overdue}</span>
          </p>
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
