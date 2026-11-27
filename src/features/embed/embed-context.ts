import { createContext, useContext } from 'react';
import { EMBED_PROTOCOL_VERSION } from '@/embed/protocol';
import type { AppLocale } from '@/i18n/locale-storage';

export type EmbedWidget = 'booking' | 'property' | 'guest-access';

export function embedWidgetHandle(widget: EmbedWidget): { embedWidget: EmbedWidget } {
  return { embedWidget: widget };
}

export function embedWidgetOf(matches: readonly { handle?: unknown }[]): EmbedWidget | null {
  for (const match of [...matches].reverse()) {
    const widget = (match.handle as { embedWidget?: unknown } | undefined)?.embedWidget;
    if (widget === 'booking' || widget === 'property' || widget === 'guest-access') return widget;
  }
  return null;
}

export type EmbedHostMode = 'host' | 'platform';

export interface EmbedContextValue {
  widget: EmbedWidget;
  orgSlug: string;
  embedBase: string;
  parentOrigin: string | null;
  lang: AppLocale;
  hostMode: EmbedHostMode;
}

export const EmbedContext = createContext<EmbedContextValue | null>(null);

export function useEmbed(): EmbedContextValue | null {
  return useContext(EmbedContext);
}

export const EMBED_PARENT_QUERY_KEY = 'parent';

export const EMBED_VERSION_QUERY_KEY = 'v';

const SUPPORTED_VERSION = String(EMBED_PROTOCOL_VERSION);

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
  return value.toLowerCase() === url.origin ? url.origin : null;
}

export function isSupportedEmbedVersion(value: string | null | undefined): boolean {
  return value === SUPPORTED_VERSION;
}

export function embedBaseOf(mode: EmbedHostMode, orgSlug: string): string {
  return mode === 'host' ? '/embed' : `/embed/${encodeURIComponent(orgSlug)}`;
}
