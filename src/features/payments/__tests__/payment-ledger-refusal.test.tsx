import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { BookingLedgerSection } from '@/features/bookings/components/booking-ledger-section';
import i18n from '@/i18n/config';
import axiosInstance, { setApiAuthHandlers, setApiForbiddenHandler } from '@/lib/axios';
import { PAYMENTS_KEY } from '@/queries/use-payments';
import type { PaymentLedgerBooking, PaymentLedgerLine } from '@/types';
import { PaymentLedgerPeriod } from '../components/payment-ledger-period';

// These tests use the real client of the app, with its interceptors and its handler of the 403: only the transport is replaced. What they prove is what the screens
// do with a refusal and with a «not found» when nothing of the ledger is mocked, as in the browser.
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));

const BOOKING_ID = 'b0c1d2e3-0000-4000-8000-000000000002';

const line = (overrides: Partial<PaymentLedgerLine> = {}): PaymentLedgerLine => ({
  kind: 'Card',
  bookingId: BOOKING_ID,
  bookingCode: 'ABCDE-FGHJK',
  paymentId: 'p-1',
  date: '2026-11-05',
  gross: 100,
  providerFee: 3.2,
  net: 96.8,
  providerCurrency: 'EUR',
  creditDate: '2026-11-08',
  currency: 'EUR',
  state: 'Paid',
  collectedBy: 'Platform',
  document: { id: 'd-1', number: '2026/12', kind: 'Invoice', status: 'Issued', paymentState: 'Paid' },
  ...overrides,
});

const ledgerOf = (lines: PaymentLedgerLine[]): PaymentLedgerBooking => ({
  bookingId: BOOKING_ID,
  bookingCode: 'ABCDE-FGHJK',
  channel: 'Direct',
  currency: 'EUR',
  lines,
  degraded: false,
});

type Reply = { status: number; data?: unknown };
let reply: (config: InternalAxiosRequestConfig) => Reply;
let requests: string[];
const onForbidden = vi.fn();
const realAdapter = axiosInstance.defaults.adapter;

/** The transport judges the status as the real ones do (`settle`): by the `validateStatus` of the request, a rejection otherwise. */
const transport: AxiosAdapter = async (config) => {
  requests.push(`${(config.method ?? 'get').toUpperCase()} ${config.url}`);
  const { status, data } = reply(config);
  const response: AxiosResponse = { status, data, statusText: '', headers: {}, config, request: {} };
  if (config.validateStatus ? config.validateStatus(status) : status >= 200 && status < 300) return response;
  throw new AxiosError(`Request failed with status code ${status}`, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, response);
};

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(async () => {
  vi.clearAllMocks();
  requests = [];
  reply = () => ({ status: 200, data: {} });
  axiosInstance.defaults.adapter = transport;
  setApiAuthHandlers({ getAccessToken: async () => 'test-token' });
  setApiForbiddenHandler(onForbidden);
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  axiosInstance.defaults.adapter = realAdapter;
  setApiAuthHandlers(null);
  setApiForbiddenHandler(null);
});

describe('the payment ledger and a 403 (permission rule: a refusal is told in the screen, the app is not sent to the no-access page)', () => {
  it('BookingLedgerSection_A403_SaysTheRefusalInItsSectionAndDoesNotSendTheAppToNoAccess', async () => {
    reply = () => ({ status: 403, data: '' });
    renderScreen(<BookingLedgerSection bookingId={BOOKING_ID} />);

    expect(await screen.findByTestId('payment-ledger-forbidden')).toHaveTextContent('Non hai il permesso di vedere gli incassi di questa prenotazione.');
    // The rest of the page stays where it is: the shared handler of the 403 on a read is not called, and nothing of the ledger is drawn, not even an error with a retry.
    expect(onForbidden).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    // A refusal is not asked again.
    expect(requests).toEqual([`GET /payment-ledger/bookings/${BOOKING_ID}`]);
  });

  it('PaymentLedgerPeriod_A403_SaysTheRefusalInTheScreenAndDoesNotSendTheAppToNoAccess', async () => {
    reply = () => ({ status: 403, data: '' });
    renderScreen(<PaymentLedgerPeriod />);

    expect(await screen.findByTestId('payment-ledger-forbidden')).toHaveTextContent('Non hai il permesso di vedere gli incassi del periodo.');
    expect(onForbidden).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Riprova' })).toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatch(/^GET \/payment-ledger$/);
  });

  it('theClientOfTheApp_A403OnAnyOtherRead_SendsTheAppToNoAccess', async () => {
    // The control of the two tests above: the handler is wired and the transport rejects as the real one does, so its silence there is the doing of the ledger read.
    reply = () => ({ status: 403, data: '' });

    await expect(axiosInstance.get('/payments')).rejects.toBeDefined();

    expect(onForbidden).toHaveBeenCalledTimes(1);
  });
});

describe('the payment ledger and a 404 (a booking that is not found is never the cached ledger)', () => {
  it('BookingLedgerSection_A404AfterLines_IsNotFoundAndTheOldLinesAreGone', async () => {
    let answers = 0;
    reply = () => (answers++ === 0 ? { status: 200, data: ledgerOf([line()]) } : { status: 404, data: { code: 'booking_not_found' } });
    const client = renderScreen(<BookingLedgerSection bookingId={BOOKING_ID} />);
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByTestId('payment-ledger-row')).toHaveLength(1));

    // The next read (a payment recorded somewhere, the booking out of the reach of the caller) is a 404: the lines the query still holds are not the ledger of a booking that is not found.
    await act(async () => {
      await client.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
    });

    expect(await screen.findByTestId('payment-ledger-not-found')).toHaveTextContent('Non troviamo gli incassi di questa prenotazione.');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('Incassato')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onForbidden).not.toHaveBeenCalled();
  });
});
