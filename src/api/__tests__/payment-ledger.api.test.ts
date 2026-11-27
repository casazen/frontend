import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getHttpStatus, UnexpectedApiResponseError } from '@/lib/api-errors';
import axios from '@/lib/axios';
import type { PaymentLedgerLine } from '@/types';
import { getBookingLedger, listLedger } from '../payment-ledger.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

/** What the shared client resolves with for a read that came back with a status the read accepts. */
const answer = (data: unknown, status = 200) => ({ status, data });

const BOOKING_ID = 'b0c1d2e3-0000-4000-8000-000000000002';

const line = (overrides: Partial<PaymentLedgerLine> = {}): PaymentLedgerLine => ({
  kind: 'Card',
  bookingId: BOOKING_ID,
  bookingCode: 'ABCDE-FGHJK',
  paymentId: 'p-1',
  date: '2026-11-05',
  gross: 100.1,
  providerFee: 2.9,
  net: 97.2,
  providerCurrency: 'EUR',
  creditDate: '2026-11-08',
  currency: 'EUR',
  state: 'Paid',
  collectedBy: 'Platform',
  document: { id: 'd-1', number: '2026/12', kind: 'Invoice', status: 'Issued', paymentState: 'Paid' },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getBookingLedger', () => {
  it('getBookingLedger_ABooking_AsksForItsLedgerAndGivesTheLinesAsTheServerSentThem', async () => {
    const sent = { bookingId: BOOKING_ID, bookingCode: 'ABCDE-FGHJK', channel: 'Direct', currency: 'EUR', lines: [line()], degraded: false };
    vi.mocked(axios.get).mockResolvedValueOnce(answer(sent));

    const ledger = await getBookingLedger(BOOKING_ID);

    expect(axios.get).toHaveBeenCalledWith(`/payment-ledger/bookings/${BOOKING_ID}`, expect.objectContaining({ validateStatus: expect.any(Function) }));
    // Money rule: the figures are the ones of the server, untouched (no sum, no rounding, no float arithmetic on the way).
    expect(ledger.lines).toEqual([line()]);
    expect(ledger.lines[0].gross).toBe(100.1);
    expect(ledger.lines[0].providerFee).toBe(2.9);
    expect(ledger.lines[0].net).toBe(97.2);
    expect(ledger.degraded).toBe(false);
  });

  it('getBookingLedger_DegradedTrue_IsKeptAndAMissingMemberIsTheOrdinaryAnswer', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer({ bookingId: BOOKING_ID, bookingCode: 'ABCDE-FGHJK', channel: 'Airbnb', currency: 'EUR', lines: [], degraded: true }));
    expect((await getBookingLedger(BOOKING_ID)).degraded).toBe(true);

    vi.mocked(axios.get).mockResolvedValueOnce(answer({ bookingId: BOOKING_ID, lines: [] }));
    expect((await getBookingLedger(BOOKING_ID)).degraded).toBe(false);
  });

  it('getBookingLedger_AFigureThatIsNotThere_StaysAbsentAndIsNeverMadeUp', async () => {
    const bare = line({ providerFee: undefined, net: null, providerCurrency: undefined, creditDate: undefined, document: undefined });
    vi.mocked(axios.get).mockResolvedValueOnce(answer({ bookingId: BOOKING_ID, lines: [bare] }));

    const [only] = (await getBookingLedger(BOOKING_ID)).lines;

    expect(only.providerFee).toBeUndefined();
    expect(only.net).toBeNull();
    expect(only.creditDate).toBeUndefined();
    expect(only.document).toBeUndefined();
  });

  it.each([
    ['the index.html behind a wrong rewrite', '<!doctype html><html></html>'],
    ['nothing', undefined],
    ['a list', []],
    ['an object without lines', { bookingId: BOOKING_ID }],
    ['lines that are not a list', { bookingId: BOOKING_ID, lines: 'none' }],
    ['a line with the amount as a text', { bookingId: BOOKING_ID, lines: [line({ gross: '100.00' as never })] }],
    ['a line with an amount that is not a number', { bookingId: BOOKING_ID, lines: [line({ gross: Number.NaN })] }],
    ['a line with no state', { bookingId: BOOKING_ID, lines: [{ ...line(), state: undefined }] }],
    ['a fee as a text', { bookingId: BOOKING_ID, lines: [line({ providerFee: '2.9' as never })] }],
    ['a document that is not one', { bookingId: BOOKING_ID, lines: [line({ document: { id: 1 } as never })] }],
    // One bad line is a load error for the whole answer: a ledger that silently misses a row could be read as one in order.
    ['one bad line among good ones', { bookingId: BOOKING_ID, lines: [line(), { ...line(), gross: null }] }],
  ])('getBookingLedger_%s_IsALoadErrorAndNeverAnEmptyLedger', async (_case, body) => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(body));

    await expect(getBookingLedger(BOOKING_ID)).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it('getBookingLedger_AFailure_IsLeftToTheCaller', async () => {
    const failure = Object.assign(new Error('not found'), { isAxiosError: true, response: { status: 404 } });
    vi.mocked(axios.get).mockRejectedValueOnce(failure);

    await expect(getBookingLedger(BOOKING_ID)).rejects.toBe(failure);
  });
});

describe('listLedger', () => {
  it('listLedger_APeriodAndAPage_AsksForThemAndKeepsTheFiguresAsSent', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer({ items: [line(), line({ currency: 'CHF', gross: 55 })], totalCount: 41, page: 2, pageSize: 20 }));

    const page = await listLedger({ from: '2026-11-01', to: '2026-11-30' }, 2, 20);

    expect(axios.get).toHaveBeenCalledWith('/payment-ledger', expect.objectContaining({ params: { from: '2026-11-01', to: '2026-11-30', page: 2, pageSize: 20 } }));
    expect(page.totalCount).toBe(41);
    expect(page.items.map((item) => [item.currency, item.gross])).toEqual([
      ['EUR', 100.1],
      ['CHF', 55],
    ]);
  });

  it.each([
    ['the index.html behind a wrong rewrite', '<!doctype html><html></html>'],
    ['no items', { totalCount: 0, page: 1, pageSize: 20 }],
    ['no count', { items: [], page: 1, pageSize: 20 }],
    ['a count that is a text', { items: [], totalCount: '0', page: 1, pageSize: 20 }],
    ['a bad line', { items: [{ ...line(), kind: 3 }], totalCount: 1, page: 1, pageSize: 20 }],
  ])('listLedger_%s_IsALoadErrorAndNeverAnEmptyPeriod', async (_case, body) => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer(body));

    await expect(listLedger({ from: '2026-11-01', to: '2026-11-30' }, 1, 20)).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});

describe('a 403 (permission rule: the refusal of the server is an answer of the read, not a move of the whole app to the no-access page)', () => {
  /** The shared client rejects a 403 on a read and sends the app to the no-access page, so the read has to accept the status for the answer to reach the code. */
  const acceptedStatuses = () => {
    const config = vi.mocked(axios.get).mock.calls[0][1];
    return [200, 204, 401, 403, 404, 422, 500].filter((status) => config?.validateStatus?.(status));
  };

  it('getBookingLedger_A403_IsAcceptedByTheClientAndThrownAsTheRefusalItIsWithItsResponse', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer({}, 403));

    const failure = await getBookingLedger(BOOKING_ID).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(getHttpStatus(failure)).toBe(403);
    expect(failure).not.toBeInstanceOf(UnexpectedApiResponseError);
    expect(acceptedStatuses()).toEqual([200, 204, 403]);
  });

  it('listLedger_A403_IsAcceptedByTheClientAndThrownAsTheRefusalItIsWithItsResponse', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(answer('', 403));

    const failure = await listLedger({ from: '2026-11-01', to: '2026-11-30' }, 1, 20).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(getHttpStatus(failure)).toBe(403);
    expect(failure).not.toBeInstanceOf(UnexpectedApiResponseError);
    expect(acceptedStatuses()).toEqual([200, 204, 403]);
  });
});
