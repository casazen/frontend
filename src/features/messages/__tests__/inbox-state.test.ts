import { describe, expect, it } from 'vitest';
import { messagesOfBookingPath } from '@/lib/message-hub-routes';
import { INBOX_PAGE_SIZE, inboxFilters, parseInboxState, withInboxState } from '../lib/inbox-state';

const PROPERTY = '6f1c9a52-1111-4222-8333-944455556666';
const BOOKING = '0c9d2a10-aaaa-4bbb-8ccc-123456789abc';

describe('the state of the list of the messages (NF-61)', () => {
  it('parseInboxState_PlainAddress_IsTheViewToRespondOnTheFirstPage', () => {
    expect(parseInboxState(new URLSearchParams(''))).toEqual({ view: 'toRespond', channel: null, propertyId: null, bookingId: null, q: '', page: 1 });
  });

  it('parseInboxState_ValuesThatAreNotValid_AreIgnoredSoAStaleLinkNeverBreaksThePage', () => {
    const state = parseInboxState(new URLSearchParams(`view=everything&channel=Agoda&property=not-an-id&booking=${PROPERTY.slice(1)}&page=-3`));
    expect(state).toEqual({ view: 'toRespond', channel: null, propertyId: null, bookingId: null, q: '', page: 1 });
  });

  it('parseInboxState_EveryFilter_ReadsItFromTheAddress', () => {
    const state = parseInboxState(new URLSearchParams(`view=unread&channel=Airbnb&property=${PROPERTY}&booking=${BOOKING}&q=%20rossi%20&page=3`));
    expect(state).toEqual({ view: 'unread', channel: 'Airbnb', propertyId: PROPERTY, bookingId: BOOKING, q: 'rossi', page: 3 });
  });

  it('parseInboxState_LongSearch_IsCutAtWhatTheServerCounts', () => {
    expect(parseInboxState(new URLSearchParams(`q=${'a'.repeat(200)}`)).q).toHaveLength(64);
  });

  it('withInboxState_ChangeOfView_GoesBackToTheFirstPageAndWritesNothingForTheDefault', () => {
    const start = new URLSearchParams('view=all&page=4&tab=other');

    expect(withInboxState(start, { view: 'toRespond' }).toString()).toBe('tab=other');
    expect(withInboxState(start, { view: 'unread' }).toString()).toBe('view=unread&tab=other');
  });

  it('withInboxState_ChangeOfPage_KeepsTheFiltersAndTakesTheFirstPageOutOfTheAddress', () => {
    const start = new URLSearchParams('channel=Vrbo&page=2');

    expect(withInboxState(start, { page: 3 }).toString()).toBe('channel=Vrbo&page=3');
    expect(withInboxState(start, { page: 1 }).toString()).toBe('channel=Vrbo');
  });

  it('withInboxState_EmptyValues_TakeTheFilterOutOfTheAddress', () => {
    const start = new URLSearchParams(`channel=Vrbo&property=${PROPERTY}&q=rossi&booking=${BOOKING}`);

    expect(withInboxState(start, { channel: null, propertyId: null, bookingId: null, q: '  ' }).toString()).toBe('');
  });

  it('inboxFilters_ToRespond_AsksForTheConversationsThatWaitForAnAnswer', () => {
    expect(inboxFilters(parseInboxState(new URLSearchParams('')))).toEqual({ needsReply: true, page: 1, pageSize: INBOX_PAGE_SIZE });
  });

  it('inboxFilters_All_AsksForNoViewFilterAndNeverSendsAnEmptySearch', () => {
    expect(inboxFilters(parseInboxState(new URLSearchParams('view=all')))).toEqual({ page: 1, pageSize: INBOX_PAGE_SIZE });
  });

  it('messagesOfBookingPath_AddressOfABooking_IsReadBackByTheInboxAsAllTheConversationsOfThatBooking', () => {
    const [path, query] = messagesOfBookingPath(BOOKING).split('?');

    expect(path).toBe('/app/short-rent/messages');
    // Every conversation of the booking, answered or not (not only «Da rispondere»), and nothing else narrows the list.
    expect(parseInboxState(new URLSearchParams(query))).toEqual({ view: 'all', channel: null, propertyId: null, bookingId: BOOKING, q: '', page: 1 });
    expect(inboxFilters(parseInboxState(new URLSearchParams(query)))).toEqual({ bookingId: BOOKING, page: 1, pageSize: INBOX_PAGE_SIZE });
  });

  it('inboxFilters_UnreadWithChannelPropertyBookingAndSearch_CombinesThemAll', () => {
    const state = parseInboxState(new URLSearchParams(`view=unread&channel=Booking&property=${PROPERTY}&booking=${BOOKING}&q=rossi&page=2`));

    expect(inboxFilters(state)).toEqual({ unread: true, channel: 'Booking', propertyId: PROPERTY, bookingId: BOOKING, q: 'rossi', page: 2, pageSize: INBOX_PAGE_SIZE });
  });
});
