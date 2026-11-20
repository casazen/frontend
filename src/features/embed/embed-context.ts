import { createContext, useContext } from 'react';
import type { AppLocale } from '@/i18n/locale-storage';

/**
 * What a page of the embeddable widgets knows about itself (NF-144, page-frame contract v1 of the site integration analysis, §6). The
 * shell (`EmbedShell`) works it out once from the address and gives it to the widget it frames; outside a widget there is none.
 */

/** The widgets served as frames: the booking engine, one home and the entry of the guest area. */
export type EmbedWidget = 'booking' | 'property' | 'guest-access';

/** Where the frame is served: an agency's own domain (`host`: `/embed/booking`) or the CasaZen domain (`platform`: `/embed/<orgSlug>/booking`). */
export type EmbedHostMode = 'host' | 'platform';

export interface EmbedContextValue {
  widget: EmbedWidget;
  /** The org the widget shows: the one of the agency's domain (never read from the address there), or the slug of the address on the CasaZen domain. */
  orgSlug: string;
  /** Where the pages of this org's widgets start: `/embed` on the agency's domain, `/embed/<orgSlug>` on the CasaZen domain. */
  embedBase: string;
  /** The origin of the page that frames this one (`?parent=`), or null when the address does not name a valid one (the page was opened on its own). */
  parentOrigin: string | null;
  /** The language of the frame (`?lang=`, else Italian). */
  lang: AppLocale;
  hostMode: EmbedHostMode;
}

export const EmbedContext = createContext<EmbedContextValue | null>(null);

/** The widget this component is in, or null outside the frame of one (the booking site of the platform, the console). */
export function useEmbed(): EmbedContextValue | null {
  return useContext(EmbedContext);
}

/** The query parameter that carries the origin of the framing page. */
export const EMBED_PARENT_QUERY_KEY = 'parent';

/** The query parameter that carries the version of the protocol the page expects (`v=1`). */
export const EMBED_VERSION_QUERY_KEY = 'v';

/** The only version of the page-frame protocol this app speaks. */
const SUPPORTED_VERSION = '1';

/** The longest origin that can be one: a scheme, a host of 253 characters and a port. */
const MAX_ORIGIN_LENGTH = 300;

/**
 * The origin of the page that frames the widget, from `?parent=`: `https://host[:port]` and nothing else (no path, no query, no
 * credentials, no other scheme); `http` only for the machine of the developer (`localhost`, `127.0.0.1`). Anything else is null:
 * the page was not opened by a loader, so it sends nothing (a message is only ever addressed to an origin that is checked here).
 * Written the way the browser writes an origin (lower case, no default port), so that it can be compared with `event.origin`.
 */
export function parseParentOrigin(value: string | null | undefined): string | null {
  if (!value || value.length > MAX_ORIGIN_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const secure = url.protocol === 'https:';
  const development = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (!secure && !development) return null;
  if (url.username || url.password) return null;
  // The value must BE the origin: a path (even `/`), a query, a fragment or a port the origin does not write are something else.
  return value.toLowerCase() === url.origin ? url.origin : null;
}

/** True for the version of the protocol this app speaks; a missing or any other value makes the page «not available». */
export function isSupportedEmbedVersion(value: string | null | undefined): boolean {
  return value === SUPPORTED_VERSION;
}

/** Where the pages of an org's widgets start (see `EmbedContextValue.embedBase`). */
export function embedBaseOf(mode: EmbedHostMode, orgSlug: string): string {
  return mode === 'host' ? '/embed' : `/embed/${encodeURIComponent(orgSlug)}`;
}
