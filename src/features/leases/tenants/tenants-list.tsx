import { useMemo } from 'react';
import { CalendarRange, Clock, UserRound, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListDefinition } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { formatCurrency } from '@/lib/utils';
import type { TenantListView, TenantRow } from '@/types';
import { longRentTenantPath } from './paths';
import { tenantCitizenshipText, tenantEndText, tenantLeaseLine, tenantName, tenantPunctualityText } from './tenant-format';

const LEASE_CREATE_PATH = '/app/long-rent/leases/new';

const CHIP_VIEWS: Readonly<Record<string, TenantListView>> = {
  current: 'Current',
  former: 'Former',
  all: 'All',
};

export function tenantViewOfChip(chip: string): TenantListView {
  return CHIP_VIEWS[chip] ?? 'Current';
}

function rentLine(tenant: TenantRow, t: TFunction): string | null {
  const first = tenant.leases[0];
  return first && first.monthlyRent > 0 ? t('leases.monthlyRentValue', { amount: formatCurrency(first.monthlyRent) }) : null;
}

export function buildTenantsList(t: TFunction, language: string, canCreateLease: boolean): ListDefinition<TenantRow> {
  return defineList<TenantRow>({
    key: 'long-rent-tenants',
    title: t('longRentTenants.title'),
    rowKey: (tenant) => tenant.id,
    rowLabel: (tenant) => tenantName(tenant),
    columns: [
      {
        id: 'tenant',
        label: t('longRentTenants.columns.tenant'),
        default: true,
        always: true,
        rowHeader: true,
        priority: 1,
        render: (tenant, cell) => (
          <span className="flex min-w-0 items-center gap-3">
            <UserRound aria-hidden="true" className="size-9 shrink-0 rounded-full bg-muted p-2 text-primary" />
            <span className="min-w-0">
            {cell.open(tenantName(tenant))}
            <span className="mt-0.5 block break-words text-sm text-foreground/70">
              {tenantCitizenshipText(tenant, t)} · {tenant.contactEmailMasked}
            </span>
            </span>
          </span>
        ),
      },
      {
        id: 'lease',
        label: t('longRentTenants.columns.lease'),
        default: true,
        priority: 2,
        render: (tenant) => {
          const first = tenant.leases[0];
          const rent = rentLine(tenant, t);
          return (
            <span className="block min-w-0">
              <span className="block break-words font-medium">{tenantLeaseLine(tenant, t)}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                {first?.stage ? <StatusBadge kind="leaseStage" status={first.stage} /> : null}
                {rent ? <span className="text-sm text-foreground/70">{rent}</span> : null}
              </span>
            </span>
          );
        },
      },
      {
        id: 'punctuality',
        label: t('longRentTenants.columns.punctuality'),
        default: true,
        priority: 3,
        render: (tenant) => tenantPunctualityText(tenant.punctuality, t),
      },
      {
        id: 'end',
        label: t('longRentTenants.columns.end'),
        default: true,
        render: (tenant) => tenantEndText(tenant, t, language),
      },
    ],
    search: { label: t('longRentTenants.search.label'), placeholder: t('longRentTenants.search.placeholder') },
    chips: [
      { id: 'current', label: t('longRentTenants.chips.current'), hint: t('longRentTenants.chips.currentHint') },
      { id: 'former', label: t('longRentTenants.chips.former'), hint: t('longRentTenants.chips.formerHint') },
      { id: 'all', label: t('longRentTenants.chips.all') },
    ],
    defaultChip: 'current',
    primaryAction: (tenant) => ({ id: 'open', label: t('longRentTenants.open'), href: longRentTenantPath(tenant.id) }),
    rowHref: (tenant) => longRentTenantPath(tenant.id),
    card: (tenant) => ({
      title: tenantName(tenant),
      sub: tenantLeaseLine(tenant, t),
      status: tenant.leases[0]?.stage ? <StatusBadge kind="leaseStage" status={tenant.leases[0].stage} /> : undefined,
      meta: [
        { icon: Clock, label: t('longRentTenants.columns.punctuality'), text: tenantPunctualityText(tenant.punctuality, t) },
        { icon: CalendarRange, label: t('longRentTenants.columns.end'), text: tenantEndText(tenant, t, language) },
      ],
    }),
    cardsUntil: 'xl',
    csv: false,
    countLabel: (count) => t('longRentTenants.count', { count }),
    empty: {
      icon: Users,
      title: t('longRentTenants.empty.title'),
      description: t('longRentTenants.empty.description'),
      action: canCreateLease ? { label: t('longRentTenants.empty.action'), href: LEASE_CREATE_PATH } : undefined,
    },
    noResults: { title: t('longRentTenants.noResults.title'), description: t('longRentTenants.noResults.description') },
  });
}

export function useTenantsList(canCreateLease: boolean): ListDefinition<TenantRow> {
  const { t, i18n } = useTranslation();
  return useMemo(() => buildTenantsList(t, i18n.language, canCreateLease), [t, i18n.language, canCreateLease]);
}
