import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import { BOOKING_AMOUNT_SOURCES, type BookingChannel, type BookingListItem } from '@/types';
import { useBookingsList } from '../bookings-list';
import { AmountSourceTag, BookingSourceValue, OtaBadge } from '../components/booking-facts';
import { CHANNEL_ICONS, bookingChannelName, channelOf } from '../lib/ota-stay';

const handlers = { accept: vi.fn(), arrival: vi.fn(), decline: vi.fn(), cancel: vi.fn(), sendLink: vi.fn() };

const item = (overrides: Partial<BookingListItem> = {}): BookingListItem => ({
  id: 'b0c1d2e3-0000-4000-8000-000000000003',
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

const CHANNELS = Object.keys(CHANNEL_ICONS) as BookingChannel[];

function listDefinition() {
  return renderHook(() => useBookingsList({ canWrite: true, properties: [], handlers })).result.current;
}

/** The cell of the channel column for a row, drawn on its own. */
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

describe('booking list: channels', () => {
  it('BookingsList_ChannelBooking_ShowsItsChannelWithTheOtaBadge', () => {
    renderChannelCell(item({ source: 'Expedia', channel: 'Expedia', otaSource: 'Expedia' }));

    const cell = screen.getByTestId('booking-source');
    expect(cell).toHaveTextContent('Expedia');
    expect(screen.getByTestId('booking-ota-badge')).toHaveTextContent('OTA');
    // The channel has its own icon next to the name.
    expect(cell.querySelector('svg')).not.toBeNull();
  });

  it.each([
    ['Direct', 'Sito diretto'],
    ['Manual', 'Manuale'],
  ] as const)('BookingsList_BookingThatIsNotFromAChannel_HasNoOtaBadge (%s)', (channel, label) => {
    renderChannelCell(item({ source: channel, channel, otaSource: null }));

    expect(screen.getByTestId('booking-source')).toHaveTextContent(label);
    expect(screen.queryByTestId('booking-ota-badge')).toBeNull();
  });

  it('BookingsList_RowWithoutOtaSourceInTheAnswer_HasNoOtaBadge', () => {
    // An older answer has no `otaSource` at all.
    renderChannelCell(item({ source: 'Airbnb', channel: 'Airbnb' }));

    expect(screen.getByTestId('booking-source')).toHaveTextContent('Airbnb');
    expect(screen.queryByTestId('booking-ota-badge')).toBeNull();
  });

  it('BookingsList_ChannelFilter_OffersEveryChannelWithItsIconAndName', () => {
    const filter = listDefinition().filters?.find((candidate) => candidate.id === 'channel');
    if (!filter || filter.type !== 'multi' || typeof filter.options === 'function') throw new Error('the channel filter is a list of options');

    // The four portals have an option of their own, in the order of the API, and `Other` is the last.
    expect(filter.options.map((option) => option.value)).toEqual(['Direct', 'Manual', 'Airbnb', 'BookingCom', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda', 'Other']);
    expect(filter.options.map((option) => option.label)).toEqual([
      'Sito diretto',
      'Inserita a mano',
      'Airbnb',
      'Booking.com',
      'Expedia',
      'Vrbo',
      'Tripadvisor',
      'Agoda',
      'Altri canali',
    ]);
    for (const option of filter.options) expect(option.icon).toBe(CHANNEL_ICONS[option.value as BookingChannel]);
  });

  it('CHANNEL_ICONS_EveryChannel_HasAnIconOfItsOwn', () => {
    expect(new Set(Object.values(CHANNEL_ICONS)).size).toBe(CHANNELS.length);
    expect(CHANNELS).toEqual(expect.arrayContaining(['Expedia', 'Vrbo', 'TripAdvisor', 'Agoda']));
  });

  it('channelOf_ChannelOrSourceWeDoNotKnow_IsAnotherChannel', () => {
    expect(channelOf('Expedia')).toBe('Expedia');
    expect(channelOf('Local')).toBe('Other');
    expect(channelOf('constructor')).toBe('Other');
    expect(channelOf(null)).toBe('Other');
    expect(channelOf(undefined)).toBe('Other');
  });
});

describe('texts of the channels and of the sources', () => {
  it.each([
    ['it', it_],
    ['en', en],
  ] as const)('locale_%s_EveryChannelAndEverySourceOfAnAmountHasItsName', (_language, locale) => {
    const booking = (locale as { booking: { channels: Record<string, string>; amountSource: Record<string, string> } }).booking;

    expect(Object.keys(booking.channels).sort()).toEqual([...CHANNELS].sort());
    expect(Object.keys(booking.amountSource).sort()).toEqual([...BOOKING_AMOUNT_SOURCES].sort());
    for (const text of [...Object.values(booking.channels), ...Object.values(booking.amountSource)]) expect(text.trim()).not.toBe('');
  });

  it('bookingChannelName_KnownAndUnknownChannel_TranslatesOrKeepsTheValue', () => {
    const t = i18n.getFixedT('it');
    expect(bookingChannelName('TripAdvisor', t)).toBe('Tripadvisor');
    expect(bookingChannelName('Other', t)).toBe('Altri canali');
    expect(bookingChannelName('Kayak', t)).toBe('Kayak');
    expect(bookingChannelName('Direct', i18n.getFixedT('en'))).toBe('Booking site');
  });
});

describe('booking facts: channel and source of a figure', () => {
  it('BookingSourceValue_ChannelBooking_ShowsIconNameAndOtaBadge', () => {
    render(<BookingSourceValue source="Vrbo" ota />);

    expect(screen.getByTestId('booking-detail-source')).toHaveTextContent('Vrbo');
    expect(screen.getByTestId('booking-ota-badge')).toHaveTextContent('OTA');
    expect(document.querySelector('svg')).not.toBeNull();
  });

  it('BookingSourceValue_BookingOfTheHost_HasNoOtaBadge', () => {
    render(<BookingSourceValue source="Manual" ota={false} />);

    expect(screen.getByTestId('booking-detail-source')).toHaveTextContent('Manuale');
    expect(screen.queryByTestId('booking-ota-badge')).toBeNull();
  });

  it('OtaBadge_English_SaysOta', async () => {
    await i18n.changeLanguage('en');
    render(<OtaBadge />);

    expect(screen.getByTestId('booking-ota-badge')).toHaveTextContent('OTA');
  });

  it.each([
    ['Stripe', 'Stripe'],
    ['ChannelManager', 'Channel manager'],
    ['Manual', 'Inserito da te'],
  ])('AmountSourceTag_%s_ShowsAnIconAndTheNameOfTheSource', (source, label) => {
    render(<AmountSourceTag source={source} />);

    const tag = screen.getByTestId('booking-amount-source');
    expect(tag).toHaveAttribute('data-source', source);
    expect(tag).toHaveTextContent(label);
    expect(tag.querySelector('svg')).not.toBeNull();
  });

  it.each([[undefined], [null], [''], ['Paypal'], ['constructor']])('AmountSourceTag_SourceThatIsNotOurs_DrawsNothing (%s)', (source) => {
    const { container } = render(<AmountSourceTag source={source} />);

    expect(container).toBeEmptyDOMElement();
  });
});
