import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, BedDouble, Building2, Euro, Expand, FileSignature, FileText, Pencil, User } from 'lucide-react';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListCardContent, ListMenuEntry, ListRowAction, ListSwipeAction } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import type { LongRentPropertyStatus } from '@/lib/status-dictionary';
import { cn, formatCurrency } from '@/lib/utils';
import { PropertyThumb } from '../components/property-thumb';
import { propertyModePath } from '../mode/paths';
import { formatPropertyLocation } from '../property-location';
// The drawer registers its kind when its module is loaded: the list is what opens it.
import './long-rent-property-drawer';
import { apeOfRow, cadastralOfRow, leaseOfRow, modeChangeOfRow, tenantOfRow } from './long-rent-property-format';
import type { LongRentPropertyRow } from './long-rent-property-rows';
import {
  LONG_RENT_PROPERTY_CREATE_PATH,
  LONG_RENT_PROPERTY_DRAWER_KIND,
  longRentLeasePath,
  longRentPropertyEditPath,
  longRentPropertyPath,
  newLeaseForPropertyPath,
} from './paths';

/** The states in the order the landlord has to look at them: what is free (and can be let) first. */
const STATUS_RANK: Record<LongRentPropertyStatus, number> = { Free: 0, Rented: 1 };

export interface LongRentPropertiesListOptions {
  /** `property.write` (long-rent): editing a property is for who may write it. */
  canWrite: boolean;
  /** `lease.create`: a lease is made by who may create leases. */
  canCreateLease: boolean;
  /** `lease.read`: a lease is opened by who may read it. */
  canReadLease: boolean;
  /** The leases are known. Without them nothing is said of who lives where, so there are no quick filters on it. */
  leasesKnown: boolean;
}

/**
 * The list of the properties of Affitti lunghi, in the words of the person: the unified list (UI-14) with one state for each
 * property (let or free), who lives there until when, and the rent. All the rows are in the page (`GET /properties?mode=long`
 * with `GET /leases`), so the list searches, filters and sorts them itself.
 *
 * The APE (its class under the place, or what is missing), "then free" (under the end of the lease, when it does not go on), the lease on its
 * way with its stage and the change of mode programmed come from the server (LR-07a). The design also has the type and the size of the property
 * and the rent asked for a free property: the model does not have them (LR-D30), so they are not here and not made up.
 */
export function useLongRentPropertiesList({ canWrite, canCreateLease, canReadLease, leasesKnown }: LongRentPropertiesListOptions) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(() => {
    const spacesOf = ({ property }: LongRentPropertyRow) =>
      [t('property.table.bedroomsCount', { count: property.bedrooms }), t('property.table.bathroomsCount', { count: property.bathrooms })].join(' · ');

    /** The one thing to do about a property: open its lease if it has one (in force or on its way), otherwise make one. */
    const primaryAction = (row: LongRentPropertyRow): ListRowAction | null => {
      const lease = leaseOfRow(row);
      if (lease) {
        return canReadLease
          ? { id: 'lease', label: t('longRentProperties.list.actions.openLease'), icon: FileText, href: longRentLeasePath(lease.id), testId: 'long-rent-property-lease' }
          : null;
      }
      return row.status === 'Free' && canCreateLease
        ? {
            id: 'create-lease',
            label: t('longRentProperties.list.actions.createLease'),
            icon: FileSignature,
            href: newLeaseForPropertyPath(row.property.id),
            variant: 'default',
            testId: 'long-rent-property-create-lease',
          }
        : null;
    };

    const toSwipe = (action: ListRowAction | null, tone: ListSwipeAction['tone']): ListSwipeAction | null =>
      action ? { id: action.id, label: action.label, icon: action.icon, tone, href: action.href, onSelect: action.onSelect } : null;

    return defineList<LongRentPropertyRow>({
      key: 'long-rent-properties',
      title: t('longRentProperties.list.title'),
      rowKey: (row) => row.property.id,
      rowLabel: (row) => row.property.name,
      columns: [
        {
          id: 'property',
          label: t('longRentProperties.list.columns.property'),
          always: true,
          default: true,
          rowHeader: true,
          sort: (row) => row.property.name,
          render: (row, cell) => {
            const ape = apeOfRow(row, t);
            return (
              <div className="flex min-w-0 items-center gap-3">
                <PropertyThumb photoUrls={row.property.photoUrls} />
                <div className="min-w-0">
                  {cell.open(row.property.name)}
                  <span className="block break-words text-sm font-normal text-foreground/70">{formatPropertyLocation(row.property)}</span>
                  {ape ? <span className={cn('block break-words text-sm font-normal', ape.warn ? 'text-warning-foreground' : 'text-foreground/70')}>{ape.text}</span> : null}
                </div>
              </div>
            );
          },
        },
        {
          id: 'status',
          label: t('longRentProperties.list.columns.status'),
          default: true,
          sort: (row) => (row.status ? STATUS_RANK[row.status] : null),
          render: (row) => {
            const change = modeChangeOfRow(row, t, language);
            return row.status ? (
              <div className="flex min-w-0 flex-col items-start gap-1">
                <StatusBadge kind="longRentProperty" status={row.status} />
                {change ? <span className="break-words text-sm font-normal text-foreground/70">{change}</span> : null}
              </div>
            ) : (
              <span className="text-foreground/70">—</span>
            );
          },
        },
        {
          id: 'tenant',
          label: t('longRentProperties.list.columns.tenant'),
          default: true,
          sort: (row) => tenantOfRow(row, t, language)?.name ?? null,
          render: (row) => {
            const tenant = tenantOfRow(row, t, language);
            if (!tenant) return <span className="text-foreground/70">{row.status === 'Free' ? t('longRentProperties.list.noTenant') : '—'}</span>;
            return (
              <div className="min-w-0">
                <span className="block break-words font-medium">{tenant.name}</span>
                {tenant.note ? <span className="block break-words text-sm font-normal text-foreground/70">{tenant.note}</span> : null}
              </div>
            );
          },
        },
        {
          id: 'rent',
          label: t('longRentProperties.list.columns.rent'),
          default: true,
          align: 'end',
          sort: (row) => row.current?.monthlyRent ?? null,
          render: (row) =>
            row.current ? (
              <>
                <span className="whitespace-nowrap font-medium">{formatCurrency(row.current.monthlyRent)}</span>
                <span className="block text-sm font-normal text-foreground/70">{t('longRentProperties.list.perMonth')}</span>
              </>
            ) : (
              <span className="text-foreground/70">—</span>
            ),
        },
        {
          id: 'ape',
          label: t('longRentProperties.list.columns.ape'),
          sort: (row) => row.aggregate?.apeClass ?? null,
          render: (row) => {
            const ape = apeOfRow(row, t);
            return ape ? <span className={cn(ape.warn && 'text-warning-foreground')}>{ape.text}</span> : <span className="text-foreground/70">—</span>;
          },
        },
        {
          id: 'cadastral',
          label: t('longRentProperties.list.columns.cadastral'),
          render: (row) => {
            const cadastral = cadastralOfRow(row, t);
            return cadastral ? <span className={cn(cadastral.warn && 'text-warning-foreground')}>{cadastral.text}</span> : <span className="text-foreground/70">—</span>;
          },
        },
        { id: 'spaces', label: t('longRentProperties.list.columns.spaces'), render: spacesOf },
      ],
      search: {
        label: t('longRentProperties.list.search'),
        placeholder: t('longRentProperties.list.searchPlaceholder'),
        text: (row) => {
          const lease = leaseOfRow(row);
          const { property } = row;
          return [property.name, property.city, property.address, property.postalCode, property.unit, lease?.tenantFirstName, lease?.tenantLastName]
            .filter(Boolean)
            .join(' ');
        },
      },
      chips: leasesKnown
        ? [
            { id: 'all', label: t('longRentProperties.list.chips.all'), test: () => true },
            { id: 'rented', label: t('longRentProperties.list.chips.rented'), hint: t('longRentProperties.list.chips.rentedHint'), test: (row) => row.status === 'Rented' },
            { id: 'free', label: t('longRentProperties.list.chips.free'), hint: t('longRentProperties.list.chips.freeHint'), test: (row) => row.status === 'Free' },
          ]
        : undefined,
      primaryAction,
      menu: (row): ListMenuEntry[] => {
        const entries: (ListMenuEntry | null)[] = [
          { id: 'page', label: t('longRentProperties.list.actions.page'), icon: Expand, href: longRentPropertyPath(row.property.id), testId: 'long-rent-property-page' },
          canWrite
            ? { id: 'edit', label: t('longRentProperties.list.actions.edit'), icon: Pencil, href: longRentPropertyEditPath(row.property.id), testId: 'long-rent-property-edit' }
            : null,
          // When the property has a lease, that is its button above; a new lease (another tenant) is here.
          canCreateLease && leaseOfRow(row)
            ? { id: 'new-lease', label: t('longRentProperties.list.actions.createLease'), icon: FileSignature, href: newLeaseForPropertyPath(row.property.id), testId: 'long-rent-property-new-lease' }
            : null,
          // The same entry as the menu of the page of the property: the wizard that moves it to Affitti brevi.
          canWrite ? 'separator' : null,
          canWrite
            ? { id: 'mode', label: t('propertyMode.entry.change'), icon: ArrowRightLeft, href: propertyModePath('long-rent', row.property.id), testId: 'long-rent-property-mode' }
            : null,
        ];
        return entries.filter((entry): entry is ListMenuEntry => entry !== null);
      },
      swipe: (row) => ({ left: toSwipe(primaryAction(row), 'accent') }),
      card: (row): ListCardContent => {
        const tenant = tenantOfRow(row, t, language);
        return {
          lead: <PropertyThumb photoUrls={row.property.photoUrls} className="size-14" />,
          title: row.property.name,
          sub: formatPropertyLocation(row.property),
          status: row.status ? <StatusBadge kind="longRentProperty" status={row.status} /> : undefined,
          meta: [
            ...(tenant ? [{ icon: User, text: tenant.name, label: t('longRentProperties.list.columns.tenant') }] : []),
            ...(row.current
              ? [{ icon: Euro, text: `${formatCurrency(row.current.monthlyRent)} ${t('longRentProperties.list.perMonth')}`, label: t('longRentProperties.list.columns.rent') }]
              : []),
            { icon: BedDouble, text: spacesOf(row), label: t('longRentProperties.list.columns.spaces') },
          ],
          foot: tenant?.note ? <p className="text-sm text-foreground/70">{tenant.note}</p> : undefined,
        };
      },
      // The name of the property opens its drawer; the page of the property is the first entry of "⋯" and the foot of the drawer.
      detail: { drawerKind: LONG_RENT_PROPERTY_DRAWER_KIND },
      rowHref: (row) => longRentPropertyPath(row.property.id),
      cardsUntil: 'xl',
      csv: false,
      empty: {
        icon: Building2,
        title: t('longRentProperties.list.emptyTitle'),
        description: t('longRentProperties.list.emptyDescription'),
        action: canWrite ? { label: t('longRentProperties.list.add'), href: LONG_RENT_PROPERTY_CREATE_PATH } : undefined,
      },
      noResults: { title: t('longRentProperties.list.noResults.title'), description: t('longRentProperties.list.noResults.description') },
      countLabel: (count) => t('longRentProperties.list.count', { count }),
    });
  }, [t, language, canWrite, canCreateLease, canReadLease, leasesKnown]);
}
