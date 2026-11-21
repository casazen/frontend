import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { buildEmbedMessage, parseEmbedMessage, type EmbedEventName, type EmbedMessage } from '@/embed/protocol';
import type { AppLocale } from '@/i18n/locale-storage';
import { normalizeHexColor, resolvePublicSiteFont, type PublicSiteFontId } from '@/lib/public-site-themes';
import { languageOfTag } from '@/lib/site-language';

/**
 * The bridge between a widget and the page of the agency's website that frames it (NF-145, protocol v1 in `src/embed/protocol.ts`).
 *
 * It is a conversation with a script of that website (the loader), which can be read by every other script of the same page, so what holds it
 * is the rule of the protocol: a message goes only to the origin the address named (`?parent=`), never to `'*'`; a message is believed only when it
 * comes from the window that frames this one and from that origin; and nothing personal and no token ever travels in either direction.
 * Without a page to talk to (the widget was opened on its own) the bridge is inactive: nothing is sent and every widget works as plain links.
 */

/** Why the page of a widget has no content: the page that frames it shows its own fallback for it. */
export type EmbedErrorCode = 'disabled' | 'not_found' | 'load_failed' | 'bad_version';

/** What a widget can tell the page. `ready`, `resize` and `url` are the shell's own business. Every call is a no-op while the bridge is inactive. */
export interface EmbedSend {
  /** A GA4 event (`view_item_list`, `begin_checkout`…) with the payload of `lib/ga4-ecommerce.ts`: no personal data, at most 4 KB. */
  event: (name: EmbedEventName, params: Record<string, unknown>) => void;
  /** Takes the WHOLE page to `url` (`top`) or opens it in a new tab (`blank`): the checkout, the guest area. An absolute http(s) address. */
  navigate: (url: string, target: 'top' | 'blank') => void;
  /** The widget has nothing to show (a home that does not exist, a request that failed). */
  error: (code: EmbedErrorCode) => void;
}

export interface EmbedBridge {
  /** There is a page to talk to: the address names a valid `?parent=` and this page really is in a frame. */
  active: boolean;
  /**
   * The loader answered with a valid `config`: only then may a widget take over a click and use `navigate`. A frame embedded by hand, with no
   * loader, never gets one and keeps working through real links: a click that posts a message nobody reads would look dead.
   */
  attached: boolean;
  send: EmbedSend;
}

const nothing = () => undefined;

/** What a component outside the shell, or a widget opened on its own, sees: no page, nothing sent. */
const INACTIVE_BRIDGE: EmbedBridge = { active: false, attached: false, send: { event: nothing, navigate: nothing, error: nothing } };

export const EmbedBridgeContext = createContext<EmbedBridge>(INACTIVE_BRIDGE);

/** The bridge of the widget this component is in; an inactive one outside the shell. */
export function useEmbedBridge(): EmbedBridge {
  return useContext(EmbedBridgeContext);
}

/** What the page asked of the look of the frame, each member only when it is a value the frame accepts. */
export interface EmbedConfig {
  /** The primary color, `#rrggbb`. */
  primary?: string;
  /** The radius of cards and buttons, `0` to `32px` or `0` to `2rem`. */
  radius?: string;
  /** One of the font pairs of the booking site. */
  font?: PublicSiteFontId;
  lang?: AppLocale;
}

const RADIUS = /^(\d{1,3}(?:\.\d{1,4})?)(px|rem)$/;
const MAX_RADIUS = { px: 32, rem: 2 } as const;

/**
 * What of a `config` the frame uses: the primary color when it is a hex color, the radius when it is 0 to 32 px (or 2 rem), the font when it is one
 * the booking site knows, the language when it is Italian or English. The other members are ignored, each on its own: a message with one bad value
 * still gives the good ones.
 */
export function readEmbedConfig(message: EmbedMessage<'config'>): EmbedConfig {
  const config: EmbedConfig = {};

  const primary = normalizeHexColor(message.theme?.primary);
  if (primary) config.primary = primary;

  const radius = RADIUS.exec(message.theme?.radius?.trim() ?? '');
  if (radius && Number(radius[1]) <= MAX_RADIUS[radius[2] as 'px' | 'rem']) config.radius = `${radius[1]}${radius[2]}`;

  const font = resolvePublicSiteFont(message.theme?.font);
  if (font) config.font = font;

  const lang = message.lang === undefined ? null : languageOfTag(message.lang);
  if (lang) config.lang = lang;

  return config;
}

/** The parts of the query of the frame that are the frame's own, or could be a credential: they never go to the page. */
const SHELL_PARAMS = new Set(['parent', 'v', 'lang']);
const PRIVATE_PARAMS = /^(code|token|email|phone|last4|password|secret|surname|name|bookingcode)$/i;

/** The query of the frame as the page may keep it: what the guest chose (dates, guests, filters), without the parameters of the frame itself and without anything that looks like a credential. */
function publicQuery(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of [...params.keys()]) {
    if (SHELL_PARAMS.has(key) || PRIVATE_PARAMS.test(key)) params.delete(key);
  }
  return params.toString();
}

/** The path of the frame relative to the start of its widgets (`/embed/villa/property/casa-mare` is `/property/casa-mare`). */
function pathUnder(pathname: string, embedBase: string): string {
  const path = pathname.startsWith(embedBase) ? pathname.slice(embedBase.length) : pathname;
  return path === '' ? '/' : path;
}

/** The longest `path` or `query` the protocol takes. */
const MAX_URL_PART = 1000;

interface EmbedBridgeOptions {
  /** The origin of the page that frames this one, as `parseParentOrigin` read it; null when the address names none. */
  parentOrigin: string | null;
  widget: string;
  /** Where the pages of the widgets start (`/embed`, `/embed/<orgSlug>`): the `url` messages are relative to it. */
  embedBase: string;
  /** The element whose height is the height of the frame: the wrapper of the shell. */
  wrapperRef: RefObject<HTMLElement | null>;
  /** The shell has its content on the screen. */
  ready: boolean;
  /** The shell has none, and why. */
  errorCode: EmbedErrorCode | null;
}

/**
 * The conversation of the shell with the page that frames it: `ready` once when the content is there, `error` when it is not, `resize` whenever the
 * height of the wrapper changes (also when it shrinks), `url` at every change of address, and the `config` that the page sends back. Mounted by
 * `EmbedShell`, which gives the result to the widget through `EmbedBridgeContext`.
 */
export function useEmbedBridgeController({ parentOrigin, widget, embedBase, wrapperRef, ready, errorCode }: EmbedBridgeOptions): { bridge: EmbedBridge; config: EmbedConfig } {
  const location = useLocation();
  const [attached, setAttached] = useState(false);
  const [config, setConfig] = useState<EmbedConfig>({});
  // A frame, not a page on its own: the page it talks to is another window.
  const active = parentOrigin !== null && typeof window !== 'undefined' && window.parent !== window;

  // The only way a message leaves: to the origin the address named, after the protocol has read it back. A message that is not valid (a relative
  // address to go to, params over 4 KB) is not sent.
  const post = useCallback(
    (message: EmbedMessage): void => {
      if (!active || parentOrigin === null) return;
      const checked = parseEmbedMessage(message);
      if (checked) window.parent.postMessage(checked, parentOrigin);
    },
    [active, parentOrigin],
  );

  // `ready` once, the first time the shell has its content; `error` each time it has none for another reason.
  const readySent = useRef(false);
  const errorSent = useRef<EmbedErrorCode | null>(null);
  useEffect(() => {
    if (ready) {
      errorSent.current = null;
      if (!readySent.current) {
        readySent.current = true;
        post(buildEmbedMessage('ready', { widget }));
      }
    } else if (errorCode !== null) {
      if (errorSent.current !== errorCode) {
        errorSent.current = errorCode;
        post(buildEmbedMessage('error', { code: errorCode }));
      }
    } else {
      errorSent.current = null;
    }
  }, [post, widget, ready, errorCode]);

  // `resize`: the height of the wrapper itself, never `document.documentElement.scrollHeight`, which cannot go below the height the frame already
  // has and so would never let it shrink. At most once per animation frame, and only when it changed by a pixel or more (the height is rounded up).
  useEffect(() => {
    const element = wrapperRef.current;
    if (!active || !element) return;

    let frame = 0;
    let last: number | null = null;
    const measure = () => {
      frame = 0;
      const height = Math.ceil(element.getBoundingClientRect().height);
      if (height <= 0 || (last !== null && Math.abs(height - last) < 1)) return;
      last = height;
      post(buildEmbedMessage('resize', { height }));
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(element);
    schedule();
    return () => {
      observer?.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [active, post, wrapperRef]);

  // `url`: at every change of address after the first one, with the path relative to the base of the widgets.
  const lastAddress = useRef<string | null>(null);
  useEffect(() => {
    const address = `${location.pathname}${location.search}`;
    if (lastAddress.current === null) {
      lastAddress.current = address;
      return;
    }
    if (lastAddress.current === address) return;
    lastAddress.current = address;

    const path = pathUnder(location.pathname, embedBase);
    const query = publicQuery(location.search);
    if (path.length <= MAX_URL_PART && query.length <= MAX_URL_PART) post(buildEmbedMessage('url', { path, query }));
  }, [post, embedBase, location.pathname, location.search]);

  // `config`: believed only when it comes from the window that frames this one AND from the origin the address named. A valid one is the loader
  // answering: the bridge is attached from then on.
  useEffect(() => {
    if (!active || parentOrigin === null) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== parentOrigin) return;
      const message = parseEmbedMessage(event.data);
      if (message?.type !== 'config') return;
      setAttached(true);
      setConfig((previous) => ({ ...previous, ...readEmbedConfig(message) }));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [active, parentOrigin]);

  const send = useMemo<EmbedSend>(
    () => ({
      event: (name, params) => post(buildEmbedMessage('event', { name, params })),
      navigate: (url, target) => post(buildEmbedMessage('navigate', { url, target })),
      error: (code) => post(buildEmbedMessage('error', { code })),
    }),
    [post],
  );
  const bridge = useMemo<EmbedBridge>(() => ({ active, attached: active && attached, send }), [active, attached, send]);

  return { bridge, config };
}
