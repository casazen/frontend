import { isEmbedPath } from '@/lib/embed-path';
import type { HostSite } from '@/lib/host-site';

/**
 * Google Tag Manager on the pages of an agency's own domain (NF-149). Everything the tag manager can make the page do goes through this file:
 * which container (if any) a page may load, the check of its id, and the insertion of its script, once. It reads no consent and no storage: whoever
 * calls `loadGtm` has checked the consent of the visitor, and a page that may not measure never calls it. No cookie is written here.
 */

export type DataLayerWindow = Window & { dataLayer?: unknown[] };

const GTM_SCRIPT_ADDRESS = 'https://www.googletagmanager.com/gtm.js';

const GTM_SCRIPT_MARK = 'data-casazen-gtm';

const CONTAINER_ID = /^GTM-[A-Z0-9]{4,12}$/;
const MAX_CONTAINER_ID_LENGTH = 16;

function isAscii(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) > 127) return false;
  }
  return true;
}

/**
 * The container id to load for `value`: trimmed and in upper case, when it is `GTM-` plus letters and digits; null for anything else (a GA4 id, a Universal
 * Analytics id, an address, a script tag, a text with spaces, a longer text, nothing). The id goes into the address of a script, so what is not an id never
 * gets there. ASCII only before the upper-casing: a letter of another alphabet must not turn into a Latin one (the Turkish dotless i becomes `I`).
 */
export function normalizeGtmContainerId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > MAX_CONTAINER_ID_LENGTH || !isAscii(trimmed)) return null;
  const candidate = trimmed.toUpperCase();
  return CONTAINER_ID.test(candidate) ? candidate : null;
}

const KEY_ADDRESS_PAGE = /^(?:\/book\/[^/]+)?\/(?:my-bookings|requests|booking\/[^/]+\/review|bookings\/[^/]+\/cancel)(?:\/|$)/i;

function isKeyAddressPath(pathname: string): boolean {
  return KEY_ADDRESS_PAGE.test(pathname.split(/[?#]/, 1)[0] ?? '');
}

/**
 * The container the page at `pathname` may load, or null when it loads nothing: not an agency's own domain (`site` null: the CasaZen domain), the embeddable
 * pages are not on for it (`embedEnabled`: the flag and the plan), the agency set no container or an invalid one, the page is a widget (`/embed/*`:
 * a widget reports its events to the page that frames it, and never loads a tag manager), or the address of the page is the key to a booking (`KEY_ADDRESS_PAGE`:
 * a tag manager reads the whole address, the `Page URL` of its tags and the `page_location` of GA4, and would be handed the code or the token of the guest; it is the same
 * reason why the source of a sign-up is not recorded on a page whose address names a person, `recordLandingTouch`). The consent of the visitor is the caller's check.
 */
export function gtmContainerOf(site: Pick<HostSite, 'embedEnabled' | 'tracking'> | null, pathname: string): string | null {
  if (!site || site.embedEnabled !== true || isEmbedPath(pathname) || isKeyAddressPath(pathname)) return null;
  return normalizeGtmContainerId(site.tracking?.gtmContainerId);
}

export function dataLayerOf(win: DataLayerWindow = window): unknown[] {
  win.dataLayer ||= [];
  return win.dataLayer;
}

export function loadGtm(containerId: string, win: DataLayerWindow = window): boolean {
  const id = normalizeGtmContainerId(containerId);
  if (id === null) return false;

  const doc = win.document;
  if (doc.querySelector(`script[${GTM_SCRIPT_MARK}]`)) return false;

  dataLayerOf(win).push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  const script = doc.createElement('script');
  script.async = true;
  script.src = `${GTM_SCRIPT_ADDRESS}?id=${encodeURIComponent(id)}`;
  script.setAttribute(GTM_SCRIPT_MARK, id);
  doc.head.appendChild(script);
  return true;
}
