import { AxiosError } from 'axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import axios from '@/lib/axios';
import type { PaymentLedgerBooking, PaymentLedgerCriteria, PaymentLedgerDocument, PaymentLedgerLine, PaymentLedgerPage } from '@/types';

const PATH = '/payment-ledger';

/**
 * A 403 is an answer of these reads, not a failure of the app: for a read the shared client sends the whole app to the no-access page, and a refusal of the ledger must be
 * told in its own section with the rest of the page still there. The status is accepted here, as `reportsApi.getByOwner` and `propertySenderApi.get` do, and `readLedger` raises it
 * again as the error it is, so that the screens read it with `getHttpStatus` as any other. A 403 `account_inactive` or `onboarding_required` is not routed by these reads either: the
 * other reads of the page raise it.
 */
const acceptsRefusal = (status: number) => (status >= 200 && status < 300) || status === 403;

async function readLedger(path: string, params?: object): Promise<unknown> {
  const response = await axios.get<unknown>(path, { params, validateStatus: acceptsRefusal });
  if (response.status === 403) {
    throw new AxiosError(`Request failed with status code ${response.status}`, AxiosError.ERR_BAD_REQUEST, response.config, response.request, response);
  }
  return response.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isOptionalText = (value: unknown) => value === undefined || value === null || typeof value === 'string';
const isOptionalFigure = (value: unknown) => value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value));

function isDocument(value: unknown): value is PaymentLedgerDocument {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isOptionalText(value.number) &&
    typeof value.kind === 'string' &&
    typeof value.status === 'string' &&
    typeof value.paymentState === 'string'
  );
}

function isLine(value: unknown): value is PaymentLedgerLine {
  return (
    isRecord(value) &&
    typeof value.kind === 'string' &&
    typeof value.state === 'string' &&
    typeof value.collectedBy === 'string' &&
    typeof value.bookingId === 'string' &&
    typeof value.bookingCode === 'string' &&
    typeof value.date === 'string' &&
    typeof value.currency === 'string' &&
    typeof value.gross === 'number' &&
    Number.isFinite(value.gross) &&
    isOptionalFigure(value.providerFee) &&
    isOptionalFigure(value.net) &&
    isOptionalText(value.providerCurrency) &&
    isOptionalText(value.creditDate) &&
    isOptionalText(value.paymentId) &&
    (value.document === undefined || value.document === null || isDocument(value.document))
  );
}

function ensureBookingLedger(data: unknown, path: string): PaymentLedgerBooking {
  if (!isRecord(data) || typeof data.bookingId !== 'string' || !Array.isArray(data.lines) || !data.lines.every(isLine)) {
    throw new UnexpectedApiResponseError(path);
  }
  return {
    bookingId: data.bookingId,
    bookingCode: typeof data.bookingCode === 'string' ? data.bookingCode : '',
    channel: typeof data.channel === 'string' ? data.channel : '',
    currency: typeof data.currency === 'string' ? data.currency : '',
    lines: data.lines,
    degraded: data.degraded === true,
  };
}

function ensurePage(data: unknown, path: string): PaymentLedgerPage {
  if (
    !isRecord(data) ||
    !Array.isArray(data.items) ||
    !data.items.every(isLine) ||
    typeof data.totalCount !== 'number' ||
    !Number.isFinite(data.totalCount) ||
    typeof data.page !== 'number' ||
    typeof data.pageSize !== 'number'
  ) {
    throw new UnexpectedApiResponseError(path);
  }
  return { items: data.items, totalCount: data.totalCount, page: data.page, pageSize: data.pageSize };
}

/**
 * The ledger of one booking (`GET api/payment-ledger/bookings/{bookingId}`, FIS-05): its lines, newest first, and `degraded` when the collections of its channel
 * could not be read (the stored amounts are answered then, never an error). Needs `payment.read`: a booking of another organization, or one the caller may not
 * read the payments of, is a 404 and a caller who may not read payments at all a 403, which is thrown as an error with its response (no redirect to the no-access page).
 */
export async function getBookingLedger(bookingId: string): Promise<PaymentLedgerBooking> {
  const path = `${PATH}/bookings/${encodeURIComponent(bookingId)}`;
  return ensureBookingLedger(await readLedger(path), path);
}

export async function listLedger(criteria: PaymentLedgerCriteria, page: number, pageSize: number): Promise<PaymentLedgerPage> {
  return ensurePage(await readLedger(PATH, { ...criteria, page, pageSize }), PATH);
}
