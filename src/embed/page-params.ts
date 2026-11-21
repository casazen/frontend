/**
 * What the loader takes from the address of the page and from the attributes of a widget (NF-145, §6 of the site integration analysis), and what it lets
 * through to the frame. The address of a page is written by anybody (a link, an advertisement, a visitor), and the frame is a page of CasaZen: so every
 * value is checked by a pattern and DROPPED when it does not fit, never repaired. Nothing here reads the page by itself: the callers pass what they read.
 *
 * PURE TYPESCRIPT, NO IMPORT FROM THE APP (like `protocol.ts`): this file ends up in a bundle of a few kilobytes that runs in the page of another website.
 */

import type { EmbedLang } from './texts';

/** The options of `CasaZenEmbed.mount(element, options)`; an option that is missing is read from the `data-casazen-*` attribute of the element. */
export type EmbedOptions = Record<string, unknown>;

/** A slug of an org or of a property: letters, digits and dashes, at most 100 characters. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/i;
/** The id of a destination (`where`): the same characters as the destinations of the search bar. */
const WHERE = /^[\w.~-]{1,100}$/;
/** The five `utm_*` of a campaign, and a value that is a plain token (an address of e-mail or a phone number is never one). */
const UTM_NAME = /^utm_(source|medium|campaign|term|content)$/;
const UTM_VALUE = /^[\w.-]{1,80}$/;
const GUESTS = /^[1-9]\d?$/;
const CHILDREN = /^\d{1,2}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The slug of an org or of a property, or `''` when `value` is not one. */
export function readSlug(value: unknown): string {
  return typeof value === 'string' && SLUG.test(value) ? value : '';
}

/**
 * The origin of `value` when a frame can be served from it: `https`, or `http` for the machine of the developer (`localhost`, `127.0.0.1`), with no
 * credentials; a path, a query or a fragment are cut. `''` for anything else (the page then shows the link instead of the widget).
 */
export function readOrigin(value: unknown): string {
  try {
    const url = new URL(String(value));
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return !url.username && !url.password && (url.protocol === 'https:' || (url.protocol === 'http:' && local)) ? url.origin : '';
  } catch {
    return '';
  }
}

/** `it` or `en`: the language asked for, else (`auto` or nothing) the one of the `<html lang>` of the page, else Italian. */
export function readLang(value: unknown, pageLang: string): EmbedLang {
  const tag = typeof value === 'string' && value !== '' && value !== 'auto' ? value : pageLang;
  return /^en(?![a-z])/i.test(tag) ? 'en' : 'it';
}

/** The initial height of a frame in pixels (`data-casazen-min-height`): a whole number from 100 to 3000, else 360. */
export function readHeight(value: unknown): number {
  const height = Number(value);
  return Number.isInteger(height) && height >= 100 && height <= 3000 ? height : 360;
}

/** `data-casazen-datalayer="true"` (or `true` as an option): any other value is off. */
export function isOn(value: unknown): boolean {
  return value === true || value === 'true';
}

/**
 * The theme a page asks for: an object, or the JSON of one of at most 500 characters (parsed in a try). The frame and the search bar check each member
 * again; here only the shape is.
 */
export function readTheme(value: unknown): Record<string, unknown> | undefined {
  let theme = value;
  if (typeof value === 'string') {
    if (value.length > 500) return undefined;
    try {
      theme = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return typeof theme === 'object' && theme !== null && !Array.isArray(theme) ? (theme as Record<string, unknown>) : undefined;
}

/** An existing calendar date written `YYYY-MM-DD`. */
export function isDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The `utm_*` of the address `search` that are one of the five names and a plain token, as `[name, value]`: where the guest comes from, nothing else. */
export function utmParams(search: string): [string, string][] {
  return [...new URLSearchParams(search)].filter(([name, value]) => UTM_NAME.test(name) && UTM_VALUE.test(value));
}

/** The stay a widget may be asked to open with: attributes first, then the address of the page. */
interface OwnStay {
  checkin: unknown;
  checkout: unknown;
  guests: unknown;
}

/**
 * The parameters of the PAGE that go on to the frame: `checkin` and `checkout` (a real pair, the departure after the arrival), `guests` (1 to 99), `where`
 * (the destination the search bar chose) and the `utm_*` of the campaign. An attribute of the widget wins over the page for the dates and the guests.
 * Whatever else the address holds (a code, a token, an address of e-mail) never goes: only what is named here, and only when it fits its pattern.
 * The state of the frame that an address asks to come back to (`?cz=`) is held to the same patterns (`readFrameState`).
 */
export function frameQuery(search: string, own: OwnStay): URLSearchParams {
  const page = new URLSearchParams(search);
  const out = new URLSearchParams();
  const read = (key: keyof OwnStay): string => String(own[key] || page.get(key) || '');

  const checkin = read('checkin');
  const checkout = read('checkout');
  if (isDate(checkin) && isDate(checkout) && checkout > checkin) {
    out.set('checkin', checkin);
    out.set('checkout', checkout);
  }
  const guests = read('guests');
  if (GUESTS.test(guests)) out.set('guests', guests);
  const where = page.get('where') ?? '';
  if (WHERE.test(where)) out.set('where', where);
  for (const [name, value] of utmParams(search)) out.set(name, value);
  return out;
}

/** The query of the frame that may live in the address of the page: plain characters only (no `<`, no quotes, no `#`), at most 1000 of them. */
const SAFE_QUERY = /^[\w.,~%+=&-]{0,1000}$/;

/** The pages each widget may show: the booking engine its own page and a property, a property its own page, the guest area its entry. */
const BOOKING_PATH = /^\/(booking|property\/[a-zA-Z0-9][a-zA-Z0-9-]{0,99})$/;
const PROPERTY_PATH = /^\/property\/[a-zA-Z0-9][a-zA-Z0-9-]{0,99}$/;
const GUEST_PATH = /^\/guest-access$/;

/** Whether `widget` may be at `path` with `query`: a page of its own and a query made of safe characters, nothing else. */
export function isFrameState(widget: string, path: string, query: string): boolean {
  const pages = widget === 'booking' ? BOOKING_PATH : widget === 'property' ? PROPERTY_PATH : widget === 'guest-access' ? GUEST_PATH : null;
  return pages !== null && pages.test(path) && SAFE_QUERY.test(query);
}

/**
 * Whether a parameter of a restored state may go on to the frame: one a frame keeps in its address (the stay, the place, the five `utm_*`), with a value that
 * fits what it is (the same patterns `frameQuery` asks of the parameters of the page). A switch, not a table: a name like `constructor` is no key of anything.
 */
function fitsRestored(name: string, value: string): boolean {
  switch (name) {
    case 'checkin':
    case 'checkout':
      return isDate(value);
    case 'guests':
      return GUESTS.test(value);
    case 'children':
      return CHILDREN.test(value);
    case 'pets':
      return value === '1';
    case 'where':
      return WHERE.test(value);
    default:
      return UTM_NAME.test(name) && UTM_VALUE.test(value);
  }
}

/** The query of a restored state as it may go on to the frame: only the parameters that fit (see `fitsRestored`), written again, so no `%`-escape of the address survives. */
function restoredQuery(query: string): string {
  const kept = new URLSearchParams();
  for (const [name, value] of new URLSearchParams(query)) {
    if (fitsRestored(name, value)) kept.set(name, value);
  }
  return kept.toString();
}

/**
 * The state of the frame an address (`?cz=<path>?<query>`) asks to come back to, or null when there is none or it is not one of the widget's: a path of
 * another site, a `javascript:` value, a query with anything but safe characters. Only read when the widget asked to keep its state in the address.
 * The address is written by anybody, so the query is not taken as it stands: what a frame keeps there comes back, each parameter with the pattern its value
 * must fit, and nothing else (a code, a token, an address of e-mail or a phone number in a link never goes on to the frame through here either).
 */
export function readFrameState(widget: string, search: string): { path: string; query: string } | null {
  const value = new URLSearchParams(search).get('cz') ?? '';
  const at = value.indexOf('?');
  const path = at < 0 ? value : value.slice(0, at);
  const query = at < 0 ? '' : value.slice(at + 1);
  return isFrameState(widget, path, query) ? { path, query: restoredQuery(query) } : null;
}

/** `search` of the page with `cz` set to the state of the frame (the rest of the query stays as it was). */
export function writeFrameState(search: string, path: string, query: string): string {
  const params = new URLSearchParams(search);
  params.set('cz', query ? `${path}?${query}` : path);
  return params.toString();
}
