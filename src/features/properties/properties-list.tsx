import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BedDouble, Building2, CalendarDays, CircleCheck, Euro, Expand, Pause, Pencil, Power, Trash2, Wrench } from 'lucide-react';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListCardContent, ListMenuEntry, ListRowAction, ListSwipeAction } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { propertyStatus, type PropertyStatus } from '@/lib/status-dictionary';
import { formatStayDate, romeDateOf } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { Property } from '@/types';
import { PropertyThumb } from './components/property-thumb';
// The drawer registers its kind when its module is loaded: the list is what opens it.
import './components/property-drawer';
import { formatPropertyLocation } from './property-location';
import {
  PROPERTY_CREATE_PATH,
  PROPERTY_DRAWER_KIND,
  propertyWizardPath,
  propertyCalendarPath,
  propertyEditPath,
  propertyPath,
  propertyServiceRequestPath,
} from './properties-paths';

/** What waits for the host before the property can receive bookings: the ones to complete and the ones suspended. */
const needsAttention = (property: Property) => {
  const status = propertyStatus(property);
  return status === 'Pending' || status === 'Suspended';
};

/** The states in the order the host has to look at them: what is blocked first, what works last. */
const STATUS_RANK: Record<PropertyStatus, number> = { Suspended: 0, Pending: 1, Paused: 2, Active: 3 };

export interface PropertiesListOptions {
  /** `property.write`: completing, reactivating, pausing, editing and deleting are for who may write the property. */
  canWrite: boolean;
  /** `booking.read`: the calendar and the marketplace are pages of the bookings. */
  canReadBookings: boolean;
  /** A pause, a reactivation or a deletion is on its way: the buttons that start one wait. */
  busy: boolean;
  onPause: (property: Property) => void;
  onActivate: (property: Property) => void;
  onDelete: (property: Property) => void;
}

/**
 * The list of the properties of Affitti brevi (SR-07), in the words of the person: the unified list (UI-14) with one state for
 * each property, the one thing to do about it and the rest in "⋯". All the rows are in the page (`GET /properties?mode=short`),
 * so the list searches, filters and sorts them itself.
 *
 * The columns are the ones the API has data for. The design also has "what is missing", the occupancy of the last 30 days and
 * "on the site": they need what the property records do not carry (the list of what is missing for each property, the
 * bookings of the month, the host's own switch for the site), so they are not here and not made up.
 */
export function usePropertiesList({ canWrite, canReadBookings, busy, onPause, onActivate, onDelete }: PropertiesListOptions) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(() => {
    const spacesOf = (property: Property) =>
      [
        t('property.table.bedroomsCount', { count: property.bedrooms }),
        t('property.table.bathroomsCount', { count: property.bathrooms }),
        t('property.list.guestsCount', { count: property.maxGuests }),
      ].join(' · ');

    const pausedSince = (property: Property): string | null => {
      if (propertyStatus(property) !== 'Paused' || !property.pausedAt) return null;
      const day = formatStayDate(romeDateOf(property.pausedAt), language, { day: 'numeric', month: 'long', year: 'numeric' });
      return day ? t('property.list.pausedSince', { date: day }) : null;
    };

    const priceOf = (property: Property) => (property.nightlyRate > 0 ? formatCurrency(property.nightlyRate, property.currency) : null);

    /** The one thing to do about a property, by its state. */
    const primaryAction = (property: Property): ListRowAction | null => {
      const status = propertyStatus(property);
      if (status === 'Pending' || status === 'Suspended') {
        return canWrite
          ? {
              id: 'complete',
              label: t('property.list.actions.complete'),
              icon: CircleCheck,
              href: propertyWizardPath(property.id),
              variant: 'default',
              testId: 'property-complete',
            }
          : null;
      }
      if (status === 'Paused') {
        return canWrite
          ? {
              id: 'reactivate',
              label: t('property.list.actions.reactivate'),
              icon: Power,
              onSelect: () => onActivate(property),
              disabled: busy,
              testId: 'property-reactivate',
            }
          : null;
      }
      return canReadBookings
        ? {
            id: 'calendar',
            label: t('property.list.actions.calendar'),
            icon: CalendarDays,
            href: propertyCalendarPath(property.id),
            testId: 'property-calendar',
          }
        : null;
    };

    const requestService = (property: Property): ListRowAction | null =>
      canReadBookings
        ? {
            id: 'request',
            label: t('property.list.actions.requestService'),
            icon: Wrench,
            href: propertyServiceRequestPath(property.id),
            testId: 'property-request-service',
          }
        : null;

    const toSwipe = (action: ListRowAction | null, tone: ListSwipeAction['tone']): ListSwipeAction | null =>
      action ? { id: action.id, label: action.label, icon: action.icon, tone, href: action.href, onSelect: action.onSelect } : null;

    return defineList<Property>({
      key: 'properties',
      title: t('property.page.title'),
      rowKey: (property) => property.id,
      rowLabel: (property) => property.name,
      columns: [
        {
          id: 'property',
          label: t('property.list.columns.property'),
          always: true,
          default: true,
          rowHeader: true,
          sort: (property) => property.name,
          render: (property, cell) => (
            <div className="flex min-w-0 items-center gap-3">
              <PropertyThumb photoUrls={property.photoUrls} />
              <div className="min-w-0">
                {cell.open(property.name)}
                <span className="block break-words text-sm font-normal text-foreground/70">{formatPropertyLocation(property)}</span>
              </div>
            </div>
          ),
        },
        {
          id: 'status',
          label: t('property.list.columns.status'),
          default: true,
          sort: (property) => STATUS_RANK[propertyStatus(property)],
          render: (property) => {
            const since = pausedSince(property);
            return (
              <div className="flex min-w-0 flex-col items-start gap-1">
                <StatusBadge kind="property" status={propertyStatus(property)} />
                {since ? <span className="text-sm font-normal text-foreground/70">{since}</span> : null}
              </div>
            );
          },
        },
        {
          id: 'spaces',
          label: t('property.list.columns.spaces'),
          default: true,
          render: spacesOf,
        },
        {
          id: 'price',
          label: t('property.list.columns.price'),
          default: true,
          align: 'end',
          sort: (property) => (property.nightlyRate > 0 ? property.nightlyRate : null),
          render: (property) => {
            const price = priceOf(property);
            return price ? (
              <>
                <span className="font-medium">{price}</span>
                <span className="block text-sm font-normal text-foreground/70">{t('property.list.perNight')}</span>
              </>
            ) : (
              <span className="text-foreground/70">{t('property.table.noRate')}</span>
            );
          },
        },
      ],
      search: {
        label: t('property.list.search'),
        placeholder: t('property.list.searchPlaceholder'),
        text: (property) => [property.name, property.city, property.address, property.postalCode, property.unit].filter(Boolean).join(' '),
      },
      chips: [
        { id: 'all', label: t('property.list.chips.all'), test: () => true },
        { id: 'active', label: t('property.list.chips.active'), test: (property) => propertyStatus(property) === 'Active' },
        { id: 'todo', label: t('property.list.chips.todo'), hint: t('property.list.chips.todoHint'), urgent: true, test: needsAttention },
        { id: 'paused', label: t('property.list.chips.paused'), test: (property) => propertyStatus(property) === 'Paused' },
      ],
      filters: [
        {
          id: 'city',
          label: t('property.list.filters.city'),
          type: 'select',
          allLabel: t('property.list.filters.allCities'),
          options: (rows) =>
            [...new Set(rows.map((property) => property.city).filter(Boolean))]
              .sort((a, b) => a.localeCompare(b, language))
              .map((city) => ({ value: city, label: city })),
          test: (property, city) => property.city === city,
        },
      ],
      primaryAction,
      menu: (property): ListMenuEntry[] => {
        const request = requestService(property);
        const status = propertyStatus(property);
        const entries: (ListMenuEntry | null)[] = [
          { id: 'page', label: t('property.list.actions.page'), icon: Expand, href: propertyPath(property.id), testId: 'property-page' },
          canWrite ? { id: 'edit', label: t('property.list.actions.edit'), icon: Pencil, href: propertyEditPath(property.id), testId: 'property-edit' } : null,
          request,
          canWrite ? 'separator' : null,
          canWrite && status === 'Active'
            ? { id: 'pause', label: t('property.list.actions.pause'), icon: Pause, onSelect: () => onPause(property), disabled: busy, testId: 'property-pause' }
            : null,
          canWrite
            ? { id: 'delete', label: t('property.list.actions.delete'), icon: Trash2, danger: true, onSelect: () => onDelete(property), disabled: busy, testId: 'property-delete' }
            : null,
        ];
        return entries.filter((entry): entry is ListMenuEntry => entry !== null);
      },
      swipe: (property) => ({ left: toSwipe(primaryAction(property), 'accent'), right: toSwipe(requestService(property), 'neutral') }),
      card: (property): ListCardContent => {
        const price = priceOf(property);
        const since = pausedSince(property);
        return {
          lead: <PropertyThumb photoUrls={property.photoUrls} className="size-14" />,
          title: property.name,
          sub: formatPropertyLocation(property),
          status: <StatusBadge kind="property" status={propertyStatus(property)} />,
          meta: [
            { icon: BedDouble, text: spacesOf(property), label: t('property.list.columns.spaces') },
            ...(price ? [{ icon: Euro, text: `${price} ${t('property.list.perNight')}`, label: t('property.list.columns.price') }] : []),
          ],
          foot: since ? <p className="text-sm text-foreground/70">{since}</p> : undefined,
        };
      },
      // The name of the property opens its drawer; the page of the property is the first entry of "⋯" and the foot of the drawer.
      detail: { drawerKind: PROPERTY_DRAWER_KIND },
      rowHref: (property) => propertyPath(property.id),
      cardsUntil: 'xl',
      csv: false,
      empty: {
        icon: Building2,
        title: t('property.page.emptyTitle'),
        description: t('property.page.emptyDescription'),
        action: canWrite ? { label: t('property.page.emptyCta'), href: PROPERTY_CREATE_PATH } : undefined,
      },
      noResults: { title: t('property.list.noResults.title'), description: t('property.list.noResults.description') },
      countLabel: (count) => t('property.list.count', { count }),
    });
  }, [t, language, canWrite, canReadBookings, busy, onPause, onActivate, onDelete]);
}
