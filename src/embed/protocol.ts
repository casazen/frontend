/**
 * Protocol v1 of the messages between the page of an agency's website and the frame of an embeddable widget (NF-145; contract §6 of the
 * site integration analysis). Every message is a plain object `{ source: 'casazen', v: 1, type, … }`, sent with `postMessage`:
 *
 * - frame → page: `ready { widget }`, `resize { height }`, `navigate { url, target }`, `event { name, params }`, `url { path, query }`,
 *   `error { code }`;
 * - page → frame: `config { theme?, lang? }` and nothing else.
 *
 * PURE TYPESCRIPT, NO IMPORT FROM THE APP: this file is the reference of the contract. The app reads it (the bridge of the shell), the loader
 * script compiles it into a bundle of a few kilobytes, and the plugin and the acceptance test follow it. A message carries no personal data
 * and no token, ever: every script of the page that frames the widget, the analytics and ad scripts included, can read it.
 *
 * `parseEmbedMessage` is the only door a message goes through before anything acts on it: it returns the typed message with the members of the
 * contract and nothing else, or null. It is strict on purpose; the receiver still checks WHO sent it (the window and the origin).
 */

/** The `source` of every message: the page and the frame ignore a message that does not say it. */
export const EMBED_SOURCE = 'casazen';

/** The version of this protocol: a change that is not compatible is `v2`, with its own path (`/embed/v2/`). */
export const EMBED_PROTOCOL_VERSION = 1;

/** The events a widget reports to the page, with the names of GA4. */
export const EMBED_EVENT_NAMES = ['search', 'view_item_list', 'view_item', 'begin_checkout'] as const;
export type EmbedEventName = (typeof EMBED_EVENT_NAMES)[number];

/** What the page may ask of the look of the frame; each member is checked by the frame before it is used. */
export interface EmbedTheme {
  primary?: string;
  radius?: string;
  font?: string;
}

/** The members of each type of message, apart from `source`, `v` and `type`. */
export interface EmbedFields {
  ready: { widget: string };
  resize: { height: number };
  navigate: { url: string; target: 'top' | 'blank' };
  event: { name: EmbedEventName; params: Record<string, unknown> };
  url: { path: string; query: string };
  error: { code: string };
  config: { theme?: EmbedTheme; lang?: string };
}

export type EmbedMessageType = keyof EmbedFields;

/** A message of the protocol: of the type asked, or of any type. */
export type EmbedMessage<T extends EmbedMessageType = EmbedMessageType> = {
  [K in T]: { source: typeof EMBED_SOURCE; v: typeof EMBED_PROTOCOL_VERSION; type: K } & EmbedFields[K];
}[T];

/** The highest height a frame can be asked for (a page of 50 000 px is a mistake, never a layout). */
const MAX_HEIGHT = 50000;
const MAX_URL_LENGTH = 2048;
const MAX_PARAMS_BYTES = 4096;
const MAX_PATH_LENGTH = 1000;
const MAX_THEME_VALUE_LENGTH = 64;
const MAX_LANG_LENGTH = 16;
/** How deep the `params` of an event may nest: they are a flat list of values and, at most, the items of a purchase. */
const MAX_PARAMS_DEPTH = 6;

/** The name of a widget (`booking`, `guest-access`) or of an error (`not_found`): short, lower case, no spaces. */
const TOKEN = /^[a-z][a-z0-9_-]{0,31}$/;

/** `message` as the protocol writes it. Used by the builder and by the parser, so that what one makes the other reads back. */
export function buildEmbedMessage<T extends EmbedMessageType>(type: T, fields: EmbedFields[T]): EmbedMessage<T> {
  return { source: EMBED_SOURCE, v: EMBED_PROTOCOL_VERSION, type, ...fields } as EmbedMessage<T>;
}

/** An object made of keys and values, not an array, a date, a map or an instance of a class (the prototype of another window's object counts as plain). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
}

/** Whether `value` is what JSON can say: text, finite numbers, booleans, null, lists and plain objects, nested no deeper than `depth`. A member that is `undefined` is simply not there. */
function isJsonValue(value: unknown, depth: number): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (depth <= 0) return false;
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth - 1));
  if (isPlainObject(value)) return Object.values(value).every((item) => item === undefined || isJsonValue(item, depth - 1));
  return false;
}

/** The size of `text` in bytes of UTF-8, the way the limit of the contract counts it. */
function utf8Length(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** The `params` of an event as plain JSON of at most 4 KB (a clean copy: no prototype, no `undefined`), or null. */
function readParams(value: unknown): Record<string, unknown> | null {
  if (!isPlainObject(value) || !isJsonValue(value, MAX_PARAMS_DEPTH)) return null;
  const json = JSON.stringify(value);
  return utf8Length(json) <= MAX_PARAMS_BYTES ? (JSON.parse(json) as Record<string, unknown>) : null;
}

/** An absolute http(s) address of at most 2048 characters, with no credentials in it; anything else is null. */
function readUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(value);
    const web = url.protocol === 'https:' || url.protocol === 'http:';
    return web && !url.username && !url.password ? value : null;
  } catch {
    return null;
  }
}

function readTheme(value: unknown): EmbedTheme | null {
  if (!isPlainObject(value)) return null;
  const theme: EmbedTheme = {};
  for (const key of ['primary', 'radius', 'font'] as const) {
    const member = value[key];
    // A member that is not a short text is not one of the contract: dropped, the others stay.
    if (typeof member === 'string' && member.length <= MAX_THEME_VALUE_LENGTH) theme[key] = member;
  }
  return theme;
}

/**
 * The message `data` carries, as the protocol writes it, or null when it is not a message of version 1: a `source` or `v` that is not exact, an
 * unknown type, or a member that breaks the rules of its type. Members that are not in the contract are dropped. A number that is too high
 * is brought down to the limit (`resize`); one that cannot be a height at all (not finite, negative) is no message.
 */
export function parseEmbedMessage(data: unknown): EmbedMessage | null {
  if (!isPlainObject(data) || data.source !== EMBED_SOURCE || data.v !== EMBED_PROTOCOL_VERSION) return null;

  switch (data.type) {
    case 'ready': {
      const widget = data.widget;
      return typeof widget === 'string' && TOKEN.test(widget) ? buildEmbedMessage('ready', { widget }) : null;
    }
    case 'resize': {
      const height = data.height;
      if (typeof height !== 'number' || !Number.isFinite(height) || height < 0) return null;
      return buildEmbedMessage('resize', { height: Math.min(height, MAX_HEIGHT) });
    }
    case 'navigate': {
      const url = readUrl(data.url);
      const target = data.target;
      return url !== null && (target === 'top' || target === 'blank') ? buildEmbedMessage('navigate', { url, target }) : null;
    }
    case 'event': {
      const name = EMBED_EVENT_NAMES.find((candidate) => candidate === data.name);
      const params = readParams(data.params);
      return name !== undefined && params !== null ? buildEmbedMessage('event', { name, params }) : null;
    }
    case 'url': {
      const { path, query } = data;
      const fits = (text: unknown): text is string => typeof text === 'string' && text.length <= MAX_PATH_LENGTH;
      return fits(path) && fits(query) ? buildEmbedMessage('url', { path, query }) : null;
    }
    case 'error': {
      const code = data.code;
      return typeof code === 'string' && TOKEN.test(code) ? buildEmbedMessage('error', { code }) : null;
    }
    case 'config': {
      const theme = data.theme === undefined ? undefined : readTheme(data.theme);
      const lang = data.lang;
      if (theme === null) return null;
      if (lang !== undefined && (typeof lang !== 'string' || lang.length > MAX_LANG_LENGTH)) return null;
      return buildEmbedMessage('config', { ...(theme ? { theme } : {}), ...(lang !== undefined ? { lang } : {}) });
    }
    default:
      return null;
  }
}
