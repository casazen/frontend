/**
 * What the loader takes from the address of the page and from the attributes of a widget (NF-145, §6 of the site integration analysis), and what it lets
 * through to the frame. The address of a page is written by anybody (a link, an advertisement, a visitor), and the frame is a page of CasaZen: so every
 * value is checked by a pattern and DROPPED when it does not fit, never repaired. Nothing here reads the page by itself: the callers pass what they read.
 *
 * PURE TYPESCRIPT, NO IMPORT FROM THE APP (like `protocol.ts`): this file ends up in a bundle of a few kilobytes that runs in the page of another website.
 */

import type { EmbedLang } from './texts';

export type EmbedOptions = Record<string, unknown>;

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/i;
const WHERE = /^[\w.~-]{1,100}$/;
const UTM_NAME = /^utm_(source|medium|campaign|term|content)$/;
const UTM_VALUE = /^[\w.-]{1,80}$/;
const GUESTS = /^[1-9]\d?$/;
const CHILDREN = /^\d{1,2}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export function readLang(value: unknown, pageLang: string): EmbedLang {
  const tag = typeof value === 'string' && value !== '' && value !== 'auto' ? value : pageLang;
  return /^en(?![a-z])/i.test(tag) ? 'en' : 'it';
}

export function readHeight(value: unknown): number {
  const height = Number(value);
  return Number.isInteger(height) && height >= 100 && height <= 3000 ? height : 360;
}

export function isOn(value: unknown): boolean {
  return value === true || value === 'true';
}

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

export function isDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function utmParams(search: string): [string, string][] {
  return [...new URLSearchParams(search)].filter(([name, value]) => UTM_NAME.test(name) && UTM_VALUE.test(value));
}

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

const SAFE_QUERY = /^[\w.,~%+=&-]{0,1000}$/;

const BOOKING_PATH = /^\/(booking|property\/[a-zA-Z0-9][a-zA-Z0-9-]{0,99})$/;
const PROPERTY_PATH = /^\/property\/[a-zA-Z0-9][a-zA-Z0-9-]{0,99}$/;
const GUEST_PATH = /^\/guest-access$/;

export function isFrameState(widget: string, path: string, query: string): boolean {
  const pages = widget === 'booking' ? BOOKING_PATH : widget === 'property' ? PROPERTY_PATH : widget === 'guest-access' ? GUEST_PATH : null;
  return pages !== null && pages.test(path) && SAFE_QUERY.test(query);
}

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

export function writeFrameState(search: string, path: string, query: string): string {
  const params = new URLSearchParams(search);
  params.set('cz', query ? `${path}?${query}` : path);
  return params.toString();
}
