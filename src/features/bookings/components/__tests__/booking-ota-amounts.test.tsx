import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import type { Booking } from '@/types';
import { BookingOtaAmounts } from '../booking-ota-amounts';
import { BookingPaymentTab } from '../booking-payment-tab';

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: () => true }),
}));

// Under the amounts the tab shows «Dati di fatturazione» (FIS-01), which reads its own data: not what these tests are about, so it is kept off the network.
vi.mock('@/api/invoice-data.api', () => ({
  getInvoiceData: vi.fn().mockResolvedValue({ bookingId: 'b0c1d2e3-0000-4000-8000-000000000002', invoiceRequested: false }),
  saveInvoiceData: vi.fn(),
}));

vi.mock('@/api/payment-ledger.api', () => ({
  getBookingLedger: vi.fn().mockResolvedValue({ bookingId: 'b0c1d2e3-0000-4000-8000-000000000002', bookingCode: '', channel: '', currency: 'EUR', lines: [], degraded: false }),
  listLedger: vi.fn(),
}));

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 'b0c1d2e3-0000-4000-8000-000000000002',
  propertyId: 'property-1',
  userId: 'auth0|host',
  checkInDate: '2027-10-01T00:00:00Z',
  checkOutDate: '2027-10-05T00:00:00Z',
  numberOfGuests: 2,
  numberOfAdults: 2,
  numberOfChildren: 0,
  basePrice: 450,
  cleaningFee: 50,
  touristTax: 12,
  totalPrice: 462,
  currency: 'EUR',
  status: 'Confirmed',
  source: 'Direct',
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '+393331234567', country: 'IT' },
  createdAt: '2027-09-24T08:00:00Z',
  updatedAt: '2027-09-24T08:00:00Z',
  ...overrides,
});

const channelBooking = (overrides: Partial<Booking> = {}): Booking =>
  booking({
    source: 'Expedia',
    otaSource: 'Expedia',
    paymentState: 'Paid',
    paidAmount: 462,
    otaAmounts: { commission: 69.3, net: 392.7, paid: 462, balance: 0, currency: 'EUR' },
    collection: { companyCollect: true, commissionIncludedInPayments: true },
    amountSources: { total: 'ChannelManager', commission: 'ChannelManager', net: 'ChannelManager', paid: 'ChannelManager', balance: 'ChannelManager' },
    ...overrides,
  });

function renderTab(value: Booking) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BookingPaymentTab booking={value} />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('BookingOtaAmounts', () => {
  it('BookingOtaAmounts_ChannelBooking_ShowsEveryFigureWithItsSource', () => {
    render(<BookingOtaAmounts booking={channelBooking()} />);

    const section = within(screen.getByTestId('booking-ota-amounts'));
    expect(section.getByRole('heading', { name: 'Importi del canale' })).toBeInTheDocument();
    expect(section.getByTestId('booking-ota-total')).toHaveTextContent('462,00 €');
    expect(section.getByTestId('booking-ota-commission')).toHaveTextContent('69,30 €');
    expect(section.getByTestId('booking-ota-net')).toHaveTextContent('392,70 €');
    expect(section.getByTestId('booking-ota-paid')).toHaveTextContent('462,00 €');
    expect(section.getByTestId('booking-ota-balance')).toHaveTextContent('0,00 €');
    expect(section.getByTestId('booking-ota-payment-state')).toHaveTextContent('Incassato');
    expect(section.getByTestId('booking-ota-collector')).toHaveTextContent('Il canale incassa il pagamento');
    expect(section.getByTestId('booking-ota-commission-included')).toHaveTextContent('Già inclusa');
    const tags = section.getAllByTestId('booking-amount-source');
    expect(tags).toHaveLength(5);
    for (const tag of tags) {
      expect(tag).toHaveAttribute('data-source', 'ChannelManager');
      expect(tag).toHaveTextContent('Channel manager');
      expect(tag.querySelector('svg')).not.toBeNull();
    }
    expect(section.queryByTestId('booking-ota-some-missing')).toBeNull();
  });

  it('BookingOtaAmounts_MissingFigures_SayNotAvailableAndNeverZero', () => {
    render(
      <BookingOtaAmounts
        booking={channelBooking({
          otaAmounts: { commission: null, net: null, paid: 462, balance: null, currency: 'EUR' },
          amountSources: { total: 'ChannelManager', paid: 'ChannelManager' },
        })}
      />,
    );

    const section = within(screen.getByTestId('booking-ota-amounts'));
    for (const id of ['commission', 'net', 'balance']) {
      const figure = section.getByTestId(`booking-ota-${id}`);
      expect(figure).toHaveAttribute('data-missing', 'true');
      expect(figure).toHaveTextContent('Non disponibile');
      expect(figure).not.toHaveTextContent('0');
    }
    expect(section.getAllByTestId('booking-amount-source')).toHaveLength(2);
    expect(screen.getByTestId('booking-ota-amounts')).not.toHaveTextContent('0,00');
    expect(section.getByTestId('booking-ota-some-missing')).toBeInTheDocument();
  });

  it('BookingOtaAmounts_FigureWithNoEntryInTheSources_IsDrawnWithNoTag', () => {
    render(
      <BookingOtaAmounts
        booking={channelBooking({ amountSources: { total: 'ChannelManager', commission: 'ChannelManager', paid: 'ChannelManager', balance: 'ChannelManager' } })}
      />,
    );

    const section = within(screen.getByTestId('booking-ota-amounts'));
    const net = section.getByTestId('booking-ota-net');
    expect(net).toHaveTextContent('392,70 €');
    expect(net.closest('div')?.querySelector('[data-testid="booking-amount-source"]')).toBeNull();
    expect(section.getAllByTestId('booking-amount-source')).toHaveLength(4);
  });

  it('BookingOtaAmounts_SettledBalance_IsAFigureOfZeroAndNotAMissingOne', () => {
    render(<BookingOtaAmounts booking={channelBooking({ otaAmounts: { commission: null, net: null, paid: 462, balance: 0, currency: 'EUR' } })} />);

    const balance = screen.getByTestId('booking-ota-balance');
    expect(balance).toHaveTextContent('0,00 €');
    expect(balance).not.toHaveAttribute('data-missing');
    expect(screen.getByTestId('booking-ota-commission')).toHaveAttribute('data-missing', 'true');
  });

  it('BookingOtaAmounts_TotalOfZero_SaysNotAvailableWithoutASourceAndNeverZero', () => {
    render(<BookingOtaAmounts booking={channelBooking({ totalPrice: 0 })} />);

    const section = within(screen.getByTestId('booking-ota-amounts'));
    const total = section.getByTestId('booking-ota-total');
    expect(total).toHaveAttribute('data-missing', 'true');
    expect(total).toHaveTextContent('Non disponibile');
    expect(total).not.toHaveTextContent('0');
    expect(total.closest('div')?.querySelector('[data-testid="booking-amount-source"]')).toBeNull();
    expect(section.getAllByTestId('booking-amount-source')).toHaveLength(4);
    expect(section.getByTestId('booking-ota-some-missing')).toBeInTheDocument();
    expect(section.getByTestId('booking-ota-balance')).toHaveTextContent('0,00 €');
  });

  it.each([
    [true, 'Il canale incassa il pagamento'],
    [false, 'Incassi tu il pagamento'],
    [null, 'Non disponibile'],
  ])('BookingOtaAmounts_CompanyCollect_%s_SaysWhoCollects', (companyCollect, text) => {
    render(<BookingOtaAmounts booking={channelBooking({ collection: { companyCollect, commissionIncludedInPayments: null } })} />);

    expect(screen.getByTestId('booking-ota-collector')).toHaveTextContent(text);
  });

  it.each([
    [true, 'Già inclusa'],
    [false, 'Non inclusa'],
    [null, 'Non disponibile'],
  ])('BookingOtaAmounts_CommissionIncludedInPayments_%s_SaysIfTheCommissionIsInThePayments', (commissionIncludedInPayments, text) => {
    render(<BookingOtaAmounts booking={channelBooking({ collection: { companyCollect: null, commissionIncludedInPayments } })} />);

    expect(screen.getByTestId('booking-ota-commission-included')).toHaveTextContent(text);
  });

  it('BookingOtaAmounts_NoCollectionInTheAnswer_SaysNotAvailableForBoth', () => {
    render(<BookingOtaAmounts booking={channelBooking({ collection: undefined })} />);

    expect(screen.getByTestId('booking-ota-collector')).toHaveTextContent('Non disponibile');
    expect(screen.getByTestId('booking-ota-commission-included')).toHaveTextContent('Non disponibile');
  });

  it('BookingOtaAmounts_English_UsesTheEnglishWords', async () => {
    await i18n.changeLanguage('en');
    render(<BookingOtaAmounts booking={channelBooking({ otaAmounts: { commission: null, net: 392.7, paid: 462, balance: 0, currency: 'EUR' } })} />);

    const section = within(screen.getByTestId('booking-ota-amounts'));
    expect(section.getByRole('heading', { name: 'Amounts of the channel' })).toBeInTheDocument();
    expect(section.getByTestId('booking-ota-commission')).toHaveTextContent('Not available');
    expect(section.getByTestId('booking-ota-collector')).toHaveTextContent('The channel collects the payment');
    expect(section.getByTestId('booking-ota-payment-state')).toHaveTextContent('Collected');
    expect(section.getAllByTestId('booking-amount-source')[0]).toHaveTextContent('Channel manager');
  });

  it('BookingOtaAmounts_AmountsInAnotherCurrency_AreShownInTheCurrencyOfTheBooking', () => {
    render(<BookingOtaAmounts booking={channelBooking({ currency: 'CHF', totalPrice: 500, otaAmounts: { commission: 75, net: 425, paid: 500, balance: 0, currency: 'CHF' } })} />);

    expect(screen.getByTestId('booking-ota-total')).toHaveTextContent(/500,00\s*CHF/);
    expect(screen.getByTestId('booking-ota-commission')).toHaveTextContent(/75,00\s*CHF/);
  });

  it.each([[undefined], [null]])('BookingOtaAmounts_AnswerWithoutAmounts_DrawsNothing (%s)', (otaAmounts) => {
    const { container } = render(<BookingOtaAmounts booking={channelBooking({ otaAmounts, collection: undefined, amountSources: undefined })} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('BookingPaymentTab (amounts of the channel)', () => {
  it('BookingPaymentTab_ChannelBooking_KeepsTheSummaryAndAddsTheSectionOfTheChannel', () => {
    renderTab(channelBooking());

    expect(screen.getByTestId('booking-price-total')).toHaveTextContent('462,00 €');
    expect(screen.getByTestId('booking-payment-state')).toHaveAttribute('data-state', 'Paid');
    expect(screen.getByTestId('booking-paid-amount')).toHaveTextContent('462,00 €');
    const section = within(screen.getByTestId('booking-ota-amounts'));
    expect(section.getAllByTestId('booking-amount-source')).toHaveLength(5);
    expect(screen.getAllByTestId('booking-amount-source')).toHaveLength(5);
  });

  it('BookingPaymentTab_PaymentsNotReadable_ShowsTheStateAndNoAmountAtAll', () => {
    renderTab(booking({ source: 'Expedia', otaSource: 'Expedia', paymentState: 'Paid' }));

    expect(screen.getByTestId('booking-payment-state')).toHaveTextContent('Soggiorno saldato');
    expect(screen.queryByTestId('booking-ota-amounts')).toBeNull();
    expect(screen.queryByTestId('booking-amount-source')).toBeNull();
    expect(screen.queryByTestId('booking-paid-amount')).toBeNull();
    expect(screen.queryByTestId('booking-balance-due')).toBeNull();
    expect(screen.queryByText(/Importi del canale/)).toBeNull();
  });

  it('BookingPaymentTab_DirectBooking_ShowsTheCommonSourceOnceForAllAmounts', () => {
    renderTab(
      booking({
        source: 'Direct',
        paymentState: 'Partial',
        paidAmount: 200,
        amountSources: { total: 'Stripe', paid: 'Stripe', balance: 'Stripe' },
      }),
    );

    const tags = screen.getAllByTestId('booking-amount-source');
    expect(tags).toHaveLength(1);
    for (const tag of tags) {
      expect(tag).toHaveAttribute('data-source', 'Stripe');
      expect(tag).toHaveTextContent('Stripe');
    }
    expect(screen.queryByTestId('booking-ota-amounts')).toBeNull();
  });

  it('BookingPaymentTab_PaymentRecordedByHand_SaysItWasEnteredByYou', () => {
    renderTab(
      booking({
        source: 'Manual',
        paymentState: 'Partial',
        paidAmount: 100,
        amountSources: { total: 'Stripe', paid: 'Manual', balance: 'Manual' },
      }),
    );

    const paid = within(screen.getByTestId('booking-paid-amount').closest('div') as HTMLElement);
    expect(paid.getByTestId('booking-amount-source')).toHaveAttribute('data-source', 'Manual');
    expect(paid.getByTestId('booking-amount-source')).toHaveTextContent('Inserito da te');
  });

  it('BookingPaymentTab_NoSourcesInTheAnswer_DrawsNoTagAndKeepsTheFigures', () => {
    renderTab(booking({ paymentState: 'Partial', paidAmount: 200 }));

    expect(screen.queryByTestId('booking-amount-source')).toBeNull();
    expect(screen.getByTestId('booking-paid-amount')).toHaveTextContent('200,00 €');
    expect(screen.getByTestId('booking-balance-due')).toHaveTextContent('262,00 €');
  });
});
