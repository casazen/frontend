import { CalendarDays, Send, Users } from 'lucide-react';
import { defineList } from '../define-list';
import type { ListDefinition } from '../list-types';

/** A list of stays, with a little of everything a list can have: the rows and the definition the tests of the list lean on. */

export type StayStatus = 'pending' | 'confirmed' | 'inProgress' | 'done' | 'cancelled';

export interface Stay {
  id: string;
  guest: string;
  email: string;
  property: 'casa-bianca' | 'trullo';
  channel: 'direct' | 'airbnb' | 'booking';
  status: StayStatus;
  from: string;
  to: string;
  total: number;
}

export const STAYS: Stay[] = [
  { id: 's1', guest: 'Mario Rossi', email: 'mario@example.com', property: 'casa-bianca', channel: 'direct', status: 'pending', from: '2026-10-12', to: '2026-10-15', total: 450 },
  { id: 's2', guest: 'Anna Bianchi', email: 'anna@example.com', property: 'trullo', channel: 'airbnb', status: 'confirmed', from: '2026-10-10', to: '2026-10-13', total: 380.5 },
  { id: 's3', guest: 'Zoë Müller', email: 'zoe@example.com', property: 'trullo', channel: 'booking', status: 'inProgress', from: '2026-10-07', to: '2026-10-11', total: 520 },
  { id: 's4', guest: 'Luigi Verdi', email: 'luigi@example.com', property: 'casa-bianca', channel: 'direct', status: 'done', from: '2026-09-20', to: '2026-09-24', total: 610 },
  { id: 's5', guest: '=HYPERLINK("http://evil.example","clicca")', email: 'x@example.com', property: 'casa-bianca', channel: 'airbnb', status: 'confirmed', from: '2026-10-20', to: '2026-10-22', total: 200 },
  { id: 's6', guest: 'Chiara Neri', email: 'chiara@example.com', property: 'trullo', channel: 'direct', status: 'cancelled', from: '2026-11-02', to: '2026-11-05', total: 300 },
];

export interface StayListOptions {
  /** What the primary action and the actions of the menu do, so that a test can see them run. */
  onAction?: (what: string, row: Stay) => void;
  withBoard?: boolean;
  withDetail?: boolean;
  withBulk?: boolean;
  withSwipe?: boolean;
  /** Anything else in the definition. */
  extra?: Partial<ListDefinition<Stay>>;
}

const STATUS_LABEL: Record<StayStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  inProgress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export function stayList(options: StayListOptions = {}): ListDefinition<Stay> {
  const { onAction = () => undefined, withBoard = true, withDetail = false, withBulk = true, withSwipe = true, extra = {} } = options;

  return defineList<Stay>({
    key: 'stays',
    title: 'Stays',
    rowKey: (stay) => stay.id,
    rowLabel: (stay) => stay.guest,
    columns: [
      { id: 'guest', label: 'Guest', default: true, always: true, rowHeader: true, priority: 1, sort: (stay) => stay.guest, render: (stay) => stay.guest },
      { id: 'dates', label: 'Dates', default: true, priority: 3, sort: (stay) => stay.from, render: (stay) => `${stay.from} → ${stay.to}` },
      { id: 'channel', label: 'Channel', default: true, priority: 4, render: (stay) => stay.channel },
      {
        id: 'status',
        label: 'Status',
        default: true,
        priority: 2,
        cardStatus: true,
        sort: (stay) => stay.status,
        render: (stay) => <span data-testid={`status-${stay.id}`}>{STATUS_LABEL[stay.status]}</span>,
        csv: (stay) => STATUS_LABEL[stay.status],
      },
      { id: 'total', label: 'Total', default: true, align: 'end', priority: 5, sort: (stay) => stay.total, render: (stay) => `€ ${stay.total}`, csv: (stay) => stay.total },
      { id: 'email', label: 'Email', render: (stay) => stay.email },
      { id: 'code', label: 'Code', render: (stay) => stay.id.toUpperCase() },
    ],
    search: { label: 'Search stays', placeholder: 'Search guest or email', text: (stay) => `${stay.guest} ${stay.email} ${stay.id}` },
    chips: [
      { id: 'all', label: 'All', test: () => true },
      { id: 'pending', label: 'To confirm', urgent: true, hint: 'Waiting for your answer', test: (stay) => stay.status === 'pending' },
      { id: 'upcoming', label: 'Upcoming', test: (stay) => stay.status === 'confirmed' || stay.status === 'pending' },
      { id: 'inProgress', label: 'In progress', test: (stay) => stay.status === 'inProgress' },
      { id: 'done', label: 'Done', test: (stay) => stay.status === 'done' },
    ],
    defaultChip: 'upcoming',
    defaultSort: 'dates:asc',
    filters: [
      {
        id: 'property',
        label: 'Property',
        type: 'select',
        allLabel: 'All properties',
        options: [
          { value: 'casa-bianca', label: 'Casa Bianca' },
          { value: 'trullo', label: 'Trullo' },
        ],
        test: (stay, value) => stay.property === value,
      },
      {
        id: 'channel',
        label: 'Channel',
        type: 'multi',
        options: [
          { value: 'direct', label: 'Direct' },
          { value: 'airbnb', label: 'Airbnb' },
          { value: 'booking', label: 'Booking.com' },
        ],
        test: (stay, values) => values.includes(stay.channel),
      },
      {
        id: 'arrival',
        label: 'Arrival',
        type: 'date',
        test: (stay, range) => (!range.from || stay.from >= range.from) && (!range.to || stay.from <= range.to),
      },
    ],
    views: [{ id: 'week', label: 'Arrivals this week', state: { chip: 'all', filters: { arrival: '2026-10-07..2026-10-14' } } }],
    primaryAction: (stay) => (stay.status === 'pending' ? { id: 'accept', label: 'Accept', icon: CalendarDays, onSelect: () => onAction('accept', stay) } : null),
    menu: (stay) => [
      { id: 'open', label: 'Open the stay', href: `/app/short-rent/bookings/${stay.id}` },
      'separator',
      { id: 'cancel', label: 'Cancel the stay', danger: true, onSelect: () => onAction('cancel', stay) },
    ],
    ...(withBulk
      ? {
          bulk: [
            {
              id: 'send-link',
              label: 'Send the link',
              icon: Send,
              run: (rows: Stay[]) => onAction(`send-link:${rows.map((stay) => stay.id).join(',')}`, rows[0]),
              undo: (rows: Stay[]) => onAction(`unsend-link:${rows.map((stay) => stay.id).join(',')}`, rows[0]),
              doneMessage: (count: number) => `Link sent to ${count}`,
            },
            {
              id: 'remove',
              label: 'Remove',
              icon: Users,
              run: (rows: Stay[]) => onAction(`remove:${rows.map((stay) => stay.id).join(',')}`, rows[0]),
              confirm: { title: (count: number) => `Remove ${count} stays?`, description: 'The guests are told.', confirmLabel: 'Remove the stays', destructive: true },
            },
            'export' as const,
          ],
        }
      : {}),
    ...(withSwipe
      ? {
          swipe: (stay: Stay) => ({
            left: stay.status === 'confirmed' ? { id: 'arrive', label: 'Arrival', tone: 'success' as const, onSelect: () => onAction('arrive', stay) } : null,
            right: { id: 'write', label: 'Write', tone: 'neutral' as const, onSelect: () => onAction('write', stay) },
          }),
        }
      : {}),
    ...(withDetail
      ? {
          detail: {
            title: (stay: Stay) => stay.guest,
            description: (stay: Stay) => `${stay.from} → ${stay.to}`,
            render: (stay: Stay) => <p data-testid="detail-body">Detail of {stay.id}</p>,
            pageHref: (stay: Stay) => `/app/short-rent/bookings/${stay.id}`,
          },
        }
      : { rowHref: (stay: Stay) => `/app/short-rent/bookings/${stay.id}` }),
    ...(withBoard
      ? {
          board: {
            defaultChip: 'all',
            columns: [
              { id: 'pending', label: 'Requests', tone: 'warning' as const, test: (stay: Stay) => stay.status === 'pending', empty: 'No requests' },
              { id: 'confirmed', label: 'Confirmed', tone: 'success' as const, test: (stay: Stay) => stay.status === 'confirmed', empty: 'Nothing confirmed' },
              { id: 'inProgress', label: 'In progress', tone: 'info' as const, test: (stay: Stay) => stay.status === 'inProgress', empty: 'Nobody here' },
              { id: 'done', label: 'Done', tone: 'neutral' as const, test: (stay: Stay) => stay.status === 'done', empty: 'Nothing done' },
            ],
            onMove: (stay: Stay, to: string, from: string | undefined) => {
              onAction(`move:${from}->${to}`, stay);
              return to === 'done' && from !== 'inProgress'
                ? { ok: false as const, title: 'Cannot move it here', reason: 'A stay is done after the departure.' }
                : { ok: true as const, title: 'Moved' };
            },
          },
        }
      : {}),
    rowTone: (stay) => (stay.status === 'pending' ? 'urgent' : stay.status === 'done' ? 'done' : undefined),
    empty: { title: 'Your stays arrive here', description: 'From your site and from the portals.' },
    noResults: { title: 'No stay with these filters', description: 'Try removing a filter.' },
    countLabel: (count) => `${count} ${count === 1 ? 'stay' : 'stays'}`,
    ...extra,
  });
}
