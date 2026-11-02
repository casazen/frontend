import { useMemo } from 'react';
import { CalendarRange, Clock, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListDefinition } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { formatCurrency } from '@/lib/utils';
import type { TenantListView, TenantRow } from '@/types';
import { longRentTenantPath } from './paths';
import { tenantCitizenshipText, tenantEndText, tenantLeaseLine, tenantName, tenantPunctualityText } from './tenant-format';

/** The new contract is where a tenant starts: nobody is added to the list by hand. */
const LEASE_CREATE_PATH = '/app/long-rent/leases/new';

/**
 * The quick filters of the list and the view of `GET /long-rent/tenants?view=` each one asks the server for. `All` is the plain list,
 * with no parameter. The views are the server's: the list does not work out from the leases who is a former tenant.
 */
const CHIP_VIEWS: Readonly<Record<string, TenantListView>> = {
  current: 'Current',
  former: 'Former',
  all: 'All',
};

/** The view of the API for a quick filter of the list. */
export function tenantViewOfChip(chip: string): TenantListView {
  return CHIP_VIEWS[chip] ?? 'Current';
}

/** "950,00 €/mese" of the lease the person is described by. */
function rentLine(tenant: TenantRow, t: TFunction): string | null {
  const first = tenant.leases[0];
  return first && first.monthlyRent > 0 ? t('leases.monthlyRentValue', { amount: formatCurrency(first.monthlyRent) }) : null;
}

/**
 * The people of the long-term area on the unified list (LR-09), in `server` mode: the quick filters are the views the server knows
 * and the search is the one of the server (`?q=`: the name, in either order, and the property), so the list shows the rows as the API
 * gives them and has no order or filter of its own. At most four columns: the person (with the citizenship and the e-mail the server
 * masked), the lease (property, stage and rent), the punctuality and the end. No phone, no document, no message (decisions D3, D4,
 * LR-D23), and no CSV: a list of names and e-mails is not something to carry away.
 */
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
          <span className="block min-w-0">
            {cell.open(tenantName(tenant))}
            <span className="mt-0.5 block break-words text-sm text-foreground/70">
              {tenantCitizenshipText(tenant, t)} · {tenant.contactEmailMasked}
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

/** The list of tenants in the words of the person; it follows the language. */
export function useTenantsList(canCreateLease: boolean): ListDefinition<TenantRow> {
  const { t, i18n } = useTranslation();
  return useMemo(() => buildTenantsList(t, i18n.language, canCreateLease), [t, i18n.language, canCreateLease]);
}
