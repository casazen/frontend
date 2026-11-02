import { useContext, useMemo, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DetailContentProps, DetailTitleProps } from '@/components/shared/detail-drawer/detail-registry';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { propertyTabPath } from '@/features/properties/properties-paths';
import { todayInRome } from '@/lib/stay-dates';
import { useHostCalendar } from '@/queries/use-host-calendar';
import type {
  HostCalendarBlockItem,
  HostCalendarIcalItem,
  HostCalendarItem,
  HostCalendarProperty,
} from '@/types/host-calendar.types';
import { BlockDetailsBody } from './components/block-details';
import { blockSourceLabel, toHostCalendarBlockEvent } from './lib/host-calendar';
import { parseTimelineZoom, resolveCalendarAnchor, timelineQuery } from './lib/host-timeline';

const BOOKINGS_PATH = '/app/short-rent/bookings';
const LINK = 'h-auto min-h-11 whitespace-normal py-2';

/**
 * The item a drawer of the Timeline shows. The calendar has no read by id: the item is found in the read of the days on screen,
 * which the address holds (`?from=`, `?zoom=`, `?propertyId=`) and which is the very entry of the cache that the page has just
 * filled, so opening a drawer asks the server for nothing. An address shared with `?detail=` loads the same days itself.
 */
function useCalendarItem(id: string) {
  const [searchParams] = useSearchParams();
  const query = timelineQuery(
    resolveCalendarAnchor(searchParams.get('from'), 'timeline', todayInRome()),
    parseTimelineZoom(searchParams.get('zoom')),
    searchParams.get('propertyId') ?? '',
  );
  const calendar = useHostCalendar(query, { refetchOnMount: false });
  const item = calendar.data?.items.find((candidate) => candidate.id === id);
  const property = item ? calendar.data?.properties.find((candidate) => candidate.id === item.propertyId) : undefined;
  return { calendar, item, property };
}

interface ItemDrawerProps<T extends HostCalendarItem> {
  id: string;
  /** The kind of item this drawer is for: an id of another kind (an address typed by hand) is not found. */
  matches: (item: HostCalendarItem) => item is T;
  children: (item: T, property: HostCalendarProperty | undefined) => ReactNode;
}

/** Loading, error ("Riprova") and not found around the content of a drawer of the Timeline. */
function ItemDrawer<T extends HostCalendarItem>({ id, matches, children }: ItemDrawerProps<T>) {
  const { t } = useTranslation();
  const { calendar, item, property } = useCalendarItem(id);

  if (calendar.isLoading) return <SkeletonLine lines={5} />;
  if (calendar.isError && !calendar.data) {
    return <ErrorState title={t('detailDrawer.calendar.loadError')} error={calendar.error} onRetry={() => void calendar.refetch()} />;
  }
  if (!item || !matches(item)) {
    return (
      <div className="space-y-3 text-sm" data-testid="calendar-item-missing">
        <p>{t('detailDrawer.calendar.missing')}</p>
        <Button asChild variant="outline" className={LINK}>
          <Link to={`${BOOKINGS_PATH}/calendar?view=timeline`}>{t('detailDrawer.calendar.openCalendar')}</Link>
        </Button>
      </div>
    );
  }
  return <>{children(item, property)}</>;
}

const isBlockItem = (item: HostCalendarItem): item is HostCalendarIcalItem | HostCalendarBlockItem => item.type === 'Ical' || item.type === 'Block';
const isIcalItem = (item: HostCalendarItem): item is HostCalendarIcalItem => item.type === 'Ical';

/* --------------------------------------------------------------------------------------------- Portal and block */

function BlockContent({ item, property, close }: { item: HostCalendarIcalItem | HostCalendarBlockItem; property?: HostCalendarProperty; close: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const workspace = useContext(WorkspaceContext);
  const block = useMemo(() => toHostCalendarBlockEvent(item), [item]);

  return (
    <div className="space-y-4 pb-2" data-testid={item.type === 'Ical' ? 'ical-drawer' : 'block-drawer'}>
      {property ? <p className="break-words text-sm text-foreground/70">{property.name}</p> : null}
      <div className="space-y-3 text-sm">
        <BlockDetailsBody
          block={block}
          propertyId={item.propertyId}
          canWrite={workspace?.hasPermission('short-rent', 'booking.write') ?? false}
          canWriteProperty={workspace?.hasPermission('short-rent', 'property.write') ?? false}
          // The guest tab: the check-in link of the new stay is sent from there (CO-09).
          onStayCreated={(booking) => navigate(`${BOOKINGS_PATH}/${booking.id}?tab=guest`)}
          onBlockDeleted={close}
        />
      </div>
      {item.type === 'Ical' ? (
        <Button asChild variant="outline" className={LINK}>
          <Link to={propertyTabPath(item.propertyId, 'ical')}>{t('detailDrawer.ical.channels')}</Link>
        </Button>
      ) : null}
    </div>
  );
}

/** A reservation of a portal, a block of its calendar: where it comes from, the stay it can become and the way to its calendars. */
export function IcalDrawerContent({ id, close }: DetailContentProps) {
  return (
    <ItemDrawer id={id} matches={isIcalItem}>
      {(item, property) => <BlockContent item={item} property={property} close={close} />}
    </ItemDrawer>
  );
}

/** The host's own block: why the nights are closed and, if the host may, the way to open them again. */
export function BlockDrawerContent({ id, close }: DetailContentProps) {
  return (
    <ItemDrawer id={id} matches={(item): item is HostCalendarBlockItem => item.type === 'Block'}>
      {(item, property) => <BlockContent item={item} property={property} close={close} />}
    </ItemDrawer>
  );
}

/** The name of the drawer of a portal's reservation or of a block: the same words as the panel of the month. */
export function BlockDrawerTitle({ id }: DetailTitleProps) {
  const { t } = useTranslation();
  const { item } = useCalendarItem(id);
  if (!item || !isBlockItem(item)) return null;
  const block = toHostCalendarBlockEvent(item);
  const source = blockSourceLabel(block, t);
  return <>{block.manual ? t('booking.calendar.manualBlock.title', { reason: source }) : t('booking.calendar.block.title', { source })}</>;
}
