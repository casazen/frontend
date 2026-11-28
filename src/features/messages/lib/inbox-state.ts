import { MESSAGE_HUB_CHANNELS, type MessageHubChannel, type MessageHubFilters } from '@/types';

/**
 * The state of the list of the messages lives in the address, and only there: a refresh, the Back button, a link and the way back from a
 * conversation all give the list as it was left, and the conversation page draws the same list beside the open thread.
 *
 *     /app/short-rent/messages?view=unread&channel=Airbnb&property=…&booking=…&q=rossi&page=2
 *
 * What is not asked for is the default and is not written, so the plain address is the plain list; what is not valid (a channel that
 * does not exist, an id that is not an id) is ignored, so a stale link or a typed address never breaks the page.
 */

export type InboxView = 'toRespond' | 'all' | 'unread' | 'reviews';

export const INBOX_VIEWS: readonly InboxView[] = ['toRespond', 'all', 'unread', 'reviews'];

export const DEFAULT_INBOX_VIEW: InboxView = 'toRespond';

export const INBOX_PAGE_SIZE = 20;

export const INBOX_SEARCH_MAX_LENGTH = 64;

export interface InboxState {
  view: InboxView;
  channel: MessageHubChannel | null;
  propertyId: string | null;
  bookingId: string | null;
  q: string;
  page: number;
}

export const INBOX_PARAM = {
  view: 'view',
  channel: 'channel',
  property: 'property',
  booking: 'booking',
  q: 'q',
  page: 'page',
} as const;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGE = 100_000;

const isView = (value: string | null): value is InboxView => INBOX_VIEWS.some((view) => view === value);
const channelOf = (value: string | null): MessageHubChannel | null => MESSAGE_HUB_CHANNELS.find((channel) => channel === value) ?? null;
const idOf = (value: string | null): string | null => (value !== null && ID.test(value) ? value : null);

export function parseInboxState(params: URLSearchParams): InboxState {
  const view = params.get(INBOX_PARAM.view);
  const page = Number(params.get(INBOX_PARAM.page));
  return {
    view: isView(view) ? view : DEFAULT_INBOX_VIEW,
    channel: channelOf(params.get(INBOX_PARAM.channel)),
    propertyId: idOf(params.get(INBOX_PARAM.property)),
    bookingId: idOf(params.get(INBOX_PARAM.booking)),
    q: (params.get(INBOX_PARAM.q) ?? '').trim().slice(0, INBOX_SEARCH_MAX_LENGTH),
    page: Number.isInteger(page) && page > 1 && page <= MAX_PAGE ? page : 1,
  };
}

export function withInboxState(params: URLSearchParams, changes: Partial<InboxState>): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (name: string, value: string | null) => {
    if (value) next.set(name, value);
    else next.delete(name);
  };
  if ('view' in changes) set(INBOX_PARAM.view, changes.view && changes.view !== DEFAULT_INBOX_VIEW ? changes.view : null);
  if ('channel' in changes) set(INBOX_PARAM.channel, changes.channel ?? null);
  if ('propertyId' in changes) set(INBOX_PARAM.property, changes.propertyId ?? null);
  if ('bookingId' in changes) set(INBOX_PARAM.booking, changes.bookingId ?? null);
  if ('q' in changes) set(INBOX_PARAM.q, (changes.q ?? '').trim().slice(0, INBOX_SEARCH_MAX_LENGTH) || null);
  if ('page' in changes) set(INBOX_PARAM.page, changes.page && changes.page > 1 ? String(changes.page) : null);
  else next.delete(INBOX_PARAM.page);
  return next;
}

export function inboxFilters(state: InboxState): MessageHubFilters {
  return {
    ...(state.view === 'toRespond' ? { needsReply: true } : {}),
    ...(state.view === 'unread' ? { unread: true } : {}),
    ...(state.view === 'reviews' ? { kind: 'Review' as const } : {}),
    ...(state.channel ? { channel: state.channel } : {}),
    ...(state.propertyId ? { propertyId: state.propertyId } : {}),
    ...(state.bookingId ? { bookingId: state.bookingId } : {}),
    ...(state.q ? { q: state.q } : {}),
    page: state.page,
    pageSize: INBOX_PAGE_SIZE,
  };
}

export function hasInboxFilters(state: InboxState): boolean {
  return state.channel !== null || state.propertyId !== null || state.bookingId !== null || state.q !== '';
}
