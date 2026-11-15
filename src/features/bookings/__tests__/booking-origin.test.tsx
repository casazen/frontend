import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import { BOOKING_ORIGINS, type BookingListItem, type BookingOrigin } from '@/types';
import { useBookingsList } from '../bookings-list';
import { BookingOriginBadge } from '../components/booking-origin-badge';
import { bookingFilterParams } from '../lib/booking-list-query';
import { bookingOriginName } from '../lib/ota-stay';

/**
 * Where a booking came from, in the four words the host reads (E27/F01/US02, NF-123): the badge of the list and of the booking, and the filter of the list.
 * What the badge says is the `origin` the API works out; the screen never works it out itself.
 */
const handlers = { accept: vi.fn(), arrival: vi.fn(), decline: vi.fn(), cancel: vi.fn(), sendLink: vi.fn() };

const item = (overrides: Partial<BookingListItem> = {}): BookingListItem => ({
  id: 'b0c1d2e3-0000-4000-8000-000000000004',
  bookingCode: 'ABCDE-12345',
  propertyId: 'property-1',
  propertyName: 'Casa Mare',
  userId: 'auth0|host',
  checkInDate: '2027-10-01T00:00:00Z',
  checkOutDate: '2027-10-05T00:00:00Z',
  numberOfGuests: 2,
  totalPrice: 462,
  currency: 'EUR',
  status: 'Confirmed',
  source: 'Direct',
  channel: 'Direct',
  paymentState: 'None',
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '', country: 'IT' },
  createdAt: '2027-09-24T08:00:00Z',
  updatedAt: '2027-09-24T08:00:00Z',
  ...overrides,
});

function listDefinition() {
  return renderHook(() => useBookingsList({ canWrite: true, properties: [], handlers })).result.current;
}

function renderChannelCell(row: BookingListItem) {
  const column = listDefinition().columns.find((candidate) => candidate.id === 'channel');
  if (!column) throw new Error('the list has no channel column');
  return render(<>{column.render(row, {} as never)}</>);
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('bookingOriginName', () => {
  it.each([
    ['AgencySite', null, "Sito dell'agenzia", 'Agency site'],
    ['CasaZenSite', null, 'Sito CasaZen', 'CasaZen site'],
    ['Manual', null, 'Manuale', 'Manual'],
    ['Portal', 'Airbnb', 'Portale Airbnb', 'Airbnb portal'],
    ['Portal', 'BookingCom', 'Portale Booking.com', 'Booking.com portal'],
  ] as const)('bookingOriginName_%s_%s_IsTheWordOfTheHostInBothLanguages', (origin, originChannel, italian, english) => {
    const booking = { origin, originChannel, source: originChannel ?? 'Direct' };

    expect(bookingOriginName(booking, i18n.getFixedT('it'))).toBe(italian);
    expect(bookingOriginName(booking, i18n.getFixedT('en'))).toBe(english);
  });

  it('bookingOriginName_PortalWithNoSourceOfItsOwn_IsToldByTheNameTheChannelManagerGaveIt', () => {
    const t = i18n.getFixedT('it');

    expect(bookingOriginName({ origin: 'Portal', originChannel: 'OtherChannel', source: 'OtherChannel', channelLabel: 'Hotels Mare' }, t)).toBe('Portale Hotels Mare');
    // No name to add: «Portale Altro portale» says no more than «Portale».
    expect(bookingOriginName({ origin: 'Portal', originChannel: 'OtherChannel', source: 'OtherChannel', channelLabel: null }, t)).toBe('Portale');
    expect(bookingOriginName({ origin: 'Portal', originChannel: null, source: undefined }, t)).toBe('Portale');
  });

  it.each([[undefined], ['Elsewhere'], ['constructor']])('bookingOriginName_OriginThatIsNotOneOfTheFour_IsNothingAndNeverARawValue (%s)', (origin) => {
    expect(bookingOriginName({ origin: origin as BookingOrigin | undefined }, i18n.getFixedT('it'))).toBeNull();
  });
});

describe('BookingOriginBadge', () => {
  it('BookingOriginBadge_BookingMadeFromALinkOfTheAgency_SaysAgencySite', () => {
    render(<BookingOriginBadge booking={{ origin: 'AgencySite' }} />);

    expect(screen.getByTestId('booking-origin-badge')).toHaveTextContent("Sito dell'agenzia");
    expect(screen.getByTestId('booking-origin-badge')).toHaveAttribute('data-origin', 'AgencySite');
  });

  it('BookingOriginBadge_English_SaysAgencySite', async () => {
    await i18n.changeLanguage('en');
    render(<BookingOriginBadge booking={{ origin: 'AgencySite' }} />);

    expect(screen.getByTestId('booking-origin-badge')).toHaveTextContent('Agency site');
  });

  it('BookingOriginBadge_AnswerWithNoOrigin_DrawsNothing', () => {
    const { container } = render(<BookingOriginBadge booking={{}} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('the list of bookings and the origin', () => {
  it('BookingsList_RowWithAnOrigin_ShowsItsBadgeUnderTheChannel', () => {
    renderChannelCell(item({ source: 'Direct', channel: 'Direct', origin: 'AgencySite', originChannel: null }));

    expect(screen.getByTestId('booking-source')).toHaveTextContent('Sito diretto');
    expect(screen.getByTestId('booking-origin-badge')).toHaveTextContent("Sito dell'agenzia");
  });

  it('BookingsList_PortalRow_KeepsItsOtaBadgeAndSaysWhichPortal', () => {
    renderChannelCell(item({ source: 'Airbnb', channel: 'Airbnb', otaSource: 'Airbnb', origin: 'Portal', originChannel: 'Airbnb' }));

    expect(screen.getByTestId('booking-ota-badge')).toHaveTextContent('OTA');
    expect(screen.getByTestId('booking-origin-badge')).toHaveTextContent('Portale Airbnb');
  });

  it('BookingsList_RowWithNoOriginInTheAnswer_HasNoOriginBadge', () => {
    // An older answer has no `origin` at all: the row is what it always was.
    renderChannelCell(item());

    expect(screen.queryByTestId('booking-origin-badge')).toBeNull();
    expect(screen.getByTestId('booking-source')).toHaveTextContent('Sito diretto');
  });

  it('BookingsList_OriginFilter_OffersTheFourOriginsInTheOrderOfTheApi', () => {
    const filter = listDefinition().filters?.find((candidate) => candidate.id === 'origin');
    if (!filter || filter.type !== 'multi' || typeof filter.options === 'function') throw new Error('the origin filter is a list of options');

    expect(filter.options.map((option) => option.value)).toEqual([...BOOKING_ORIGINS]);
    expect(filter.options.map((option) => option.label)).toEqual(['Portale', "Sito dell'agenzia", 'Sito CasaZen', 'Manuale']);
  });
});

describe('bookingFilterParams (origin)', () => {
  it('bookingFilterParams_OriginsChosen_AreAskedByTheirNamesAndNoOriginIsNoFilter', () => {
    expect(bookingFilterParams({ q: '', filters: { origin: 'Portal,AgencySite' } }).origin).toBe('Portal,AgencySite');
    // The counters of the chips take the same filters as the rows, so they count what the rows show.
    expect(bookingFilterParams({ q: 'rossi', filters: { origin: 'AgencySite', channel: 'Direct' } })).toMatchObject({ q: 'rossi', origin: 'AgencySite', channel: 'Direct' });
    expect(bookingFilterParams({ q: '', filters: {} }).origin).toBeUndefined();
  });
});

describe('the texts of the origin', () => {
  it.each([
    ['it', it_],
    ['en', en],
  ] as const)('locale_%s_EveryOriginHasItsNameAndNoTextNamesASupplier', (_language, locale) => {
    const texts = locale as unknown as {
      booking: { origin: Record<string, string>; list: { filters: { origin: string } } };
      directBooking: { bookingLink: Record<string, string> };
    };

    expect(Object.keys(texts.booking.origin).sort()).toEqual([...BOOKING_ORIGINS, 'PortalNamed'].sort());
    expect(texts.booking.origin.PortalNamed).toContain('{{name}}');
    // The booking engine of the manager of the rooms is «Sito dell'agenzia» (or «Agency site»): the name of the supplier is never in a text for hosts or guests.
    const everyText = [...Object.values(texts.booking.origin), texts.booking.list.filters.origin, ...Object.values(texts.directBooking.bookingLink)];
    for (const text of everyText) {
      expect(text.trim()).not.toBe('');
      expect(text).not.toMatch(/octorate|channel manager|concordato|partner/i);
    }
  });
});
