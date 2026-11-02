import { isStayDate } from '@/lib/stay-dates';
import { supplierSitePaths } from './site-paths';

/**
 * What the pages of the site tell the booking (`/fornitori/:slug/prenota`, SP-12b) about what the customer already chose. Every
 * member is optional and **a value that does not fit is ignored, never an error**: a link written by hand, an old one or a
 * shortened one must still open the booking, only without that choice.
 *
 *   /fornitori/:slug/prenota?service=<slug>&quantity=<n>&surface=<m2>&options=<code>:<qty>,<code>:<qty>&comune=<istat>&day=<YYYY-MM-DD>&start=<startUtc>
 *
 * `service` is the slug of the service; `quantity` are the hours, sets or square meters of its own price; `surface` the m² of
 * the home (what the `sqm30` supplements count); `options` the supplements picked with their quantity; `comune` the ISTAT code
 * of the place of the work; `day` a day (Europe/Rome) and `start` a slot (the UTC instant the API gave).
 */
export interface BookingParams {
  service?: string;
  quantity?: number;
  surface?: number;
  options?: { code: string; quantity: number }[];
  comune?: string;
  day?: string;
  start?: string;
}

const SERVICE_SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;
const OPTION_CODE = /^[A-Za-z0-9_-]{1,40}$/;
const ISTAT_CODE = /^\d{6}$/;
const MAX_OPTIONS = 10;
const MAX_UNITS = 9999;
const MAX_OPTION_QUANTITY = 99;

function whole(value: unknown, max: number): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d{1,5}$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(number) && number >= 1 && number <= max ? number : undefined;
}

function optionsOf(raw: string | null): { code: string; quantity: number }[] | undefined {
  if (!raw) return undefined;
  const picked: { code: string; quantity: number }[] = [];
  for (const part of raw.split(',')) {
    const [code, quantity = '1'] = part.split(':');
    const units = whole(quantity, MAX_OPTION_QUANTITY);
    // A code that is not a code, or one that was already picked, is dropped; the rest stays.
    if (!OPTION_CODE.test(code) || units === undefined || picked.some((option) => option.code === code)) continue;
    picked.push({ code, quantity: units });
    if (picked.length === MAX_OPTIONS) break;
  }
  return picked.length > 0 ? picked : undefined;
}

/** The parameters of an address (`?service=...`): what fits, nothing else. */
export function parseBookingParams(search: string | URLSearchParams): BookingParams {
  const query = typeof search === 'string' ? new URLSearchParams(search) : search;
  const params: BookingParams = {};

  const service = query.get('service');
  if (service && SERVICE_SLUG.test(service)) params.service = service;

  const quantity = whole(query.get('quantity'), MAX_UNITS);
  if (quantity !== undefined) params.quantity = quantity;

  const surface = whole(query.get('surface'), MAX_UNITS);
  if (surface !== undefined) params.surface = surface;

  const options = optionsOf(query.get('options'));
  if (options) params.options = options;

  const comune = query.get('comune');
  if (comune && ISTAT_CODE.test(comune)) params.comune = comune;

  const day = query.get('day');
  if (day && isStayDate(day)) params.day = day;

  const start = query.get('start');
  if (start && !Number.isNaN(new Date(start).getTime())) params.start = new Date(start).toISOString();

  return params;
}

/** The booking of a supplier with what is known: the path and the query, ready for a link or for `navigate`. */
export function buildBookingPath(slug: string, params: BookingParams = {}): string {
  const query = new URLSearchParams();
  // The same rules as reading: what would be ignored when read is not written.
  if (params.service && SERVICE_SLUG.test(params.service)) query.set('service', params.service);
  const quantity = whole(params.quantity, MAX_UNITS);
  if (quantity !== undefined) query.set('quantity', String(quantity));
  const surface = whole(params.surface, MAX_UNITS);
  if (surface !== undefined) query.set('surface', String(surface));
  const options = (params.options ?? [])
    .filter((option) => OPTION_CODE.test(option.code) && whole(option.quantity, MAX_OPTION_QUANTITY) !== undefined)
    .slice(0, MAX_OPTIONS);
  if (options.length > 0) query.set('options', options.map((option) => `${option.code}:${option.quantity}`).join(','));
  if (params.comune && ISTAT_CODE.test(params.comune)) query.set('comune', params.comune);
  if (params.day && isStayDate(params.day)) query.set('day', params.day);
  if (params.start && !Number.isNaN(new Date(params.start).getTime())) query.set('start', new Date(params.start).toISOString());

  const search = query.toString();
  return `${supplierSitePaths.booking(slug)}${search ? `?${search}` : ''}`;
}

/** The request on measure of a supplier (SP-12c), with the two things the customer may already have said: the service and the comune. */
export function buildInquiryPath(slug: string, params: Pick<BookingParams, 'service' | 'comune'> = {}): string {
  const query = new URLSearchParams();
  if (params.service && SERVICE_SLUG.test(params.service)) query.set('service', params.service);
  if (params.comune && ISTAT_CODE.test(params.comune)) query.set('comune', params.comune);
  const search = query.toString();
  return `${supplierSitePaths.inquiry(slug)}${search ? `?${search}` : ''}`;
}
