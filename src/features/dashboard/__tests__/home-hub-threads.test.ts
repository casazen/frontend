import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { MessageHubThread } from '@/types';
import { buildTodoRows } from '../lib/home-model';

const OTA_KEY = 'ota:6f1c9a52-1111-4222-8333-944455556666';
const DIRECT_KEY = 'direct:b-1';

function thread(overrides: Partial<MessageHubThread> & { threadKey: string }): MessageHubThread {
  return {
    source: 'Ota',
    channel: 'Airbnb',
    kind: 'Reservation',
    state: 'Open',
    propertyId: 'p-1',
    propertyName: 'Casa Mare',
    unassigned: false,
    bookingId: 'b-2',
    bookingCode: 'ABCDE-12345',
    guestName: 'Sofia Marino',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-23',
    lastMessageAt: '2026-11-10T08:00:00Z',
    lastMessageOrigin: 'Guest',
    preview: 'Che ore sono il check-in?',
    unreadCount: 2,
    needsReply: true,
    ...overrides,
  };
}

function rows(threads: MessageHubThread[], propertyId = '') {
  const today = { todo: { items: [] }, approvals: { items: [] } } as never;
  return buildTodoRows(today, [], { propertyId, canWrite: true, hasPermission: () => true, threads }, { t: i18n.getFixedT('it'), locale: 'it' });
}

// NF-61: the row «Rispondi a {ospite}» of the Home counts the conversations of the channels too (the list asked with includeOta).
describe('the rows of the Home for the conversations of the hub (NF-61)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('buildTodoRows_ConversationOfAChannel_IsAnsweredInThePageOfTheMessages', () => {
    const [row] = rows([thread({ threadKey: OTA_KEY })]);

    expect(row.title).toBe('Rispondi a Sofia Marino');
    expect(row.to).toBe(`/app/short-rent/messages/${encodeURIComponent(OTA_KEY)}`);
    expect(row.action).toEqual(expect.objectContaining({ kind: 'link', to: row.to }));
    expect(row.sub).toBe('Casa Mare · «Che ore sono il check-in?»');
    expect(row.unread).toBe(2);
    // The booking of the stay keeps its drawer.
    expect(row.bookingId).toBe('b-2');
  });

  it('buildTodoRows_RequestWithNoBookingYet_HasNoBookingToOpenAndGoesToTheMessages', () => {
    const [row] = rows([thread({ threadKey: 'ota:2222', kind: 'Request', bookingId: null, bookingCode: null, guestName: null })]);

    expect(row.bookingId).toBeUndefined();
    expect(row.to).toBe(`/app/short-rent/messages/${encodeURIComponent('ota:2222')}`);
    expect(row.title).toBe('Rispondi a un ospite');
  });

  it('buildTodoRows_DirectConversation_StillGoesToTheTabMessaggiOfItsBooking', () => {
    const [row] = rows([thread({ threadKey: DIRECT_KEY, source: 'Direct', channel: 'Direct', bookingId: 'b-1' })]);

    expect(row.to).toBe('/app/short-rent/bookings/b-1?tab=messages');
    expect(row.id).toBe(`message-${DIRECT_KEY}`);
  });

  it('buildTodoRows_PropertyOfTheFilter_KeepsItsConversationsAndThoseWithNoPropertyYet', () => {
    const list = [
      thread({ threadKey: 'ota:a', propertyId: 'p-1' }),
      thread({ threadKey: 'ota:b', propertyId: 'p-2' }),
      thread({ threadKey: 'ota:c', propertyId: null, propertyName: null, unassigned: true }),
    ];

    expect(rows(list, 'p-1').map((row) => row.id)).toEqual(['message-ota:a', 'message-ota:c']);
  });
});
