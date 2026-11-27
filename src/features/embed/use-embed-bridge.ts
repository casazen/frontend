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

export type EmbedErrorCode = 'disabled' | 'not_found' | 'load_failed' | 'bad_version';

export interface EmbedSend {
  event: (name: EmbedEventName, params: Record<string, unknown>) => void;
  navigate: (url: string, target: 'top' | 'blank') => void;
  error: (code: EmbedErrorCode) => void;
}

export interface EmbedBridge {
  active: boolean;
  attached: boolean;
  send: EmbedSend;
}

const nothing = () => undefined;

const INACTIVE_BRIDGE: EmbedBridge = { active: false, attached: false, send: { event: nothing, navigate: nothing, error: nothing } };

export const EmbedBridgeContext = createContext<EmbedBridge>(INACTIVE_BRIDGE);

export function useEmbedBridge(): EmbedBridge {
  return useContext(EmbedBridgeContext);
}

export interface EmbedConfig {
  primary?: string;
  radius?: string;
  font?: PublicSiteFontId;
  lang?: AppLocale;
}

const RADIUS = /^(\d{1,3}(?:\.\d{1,4})?)(px|rem)$/;
const MAX_RADIUS = { px: 32, rem: 2 } as const;

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

function publicQuery(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of [...params.keys()]) {
    if (SHELL_PARAMS.has(key) || PRIVATE_PARAMS.test(key)) params.delete(key);
  }
  return params.toString();
}

function pathUnder(pathname: string, embedBase: string): string {
  const path = pathname.startsWith(embedBase) ? pathname.slice(embedBase.length) : pathname;
  return path === '' ? '/' : path;
}

const MAX_URL_PART = 1000;

interface EmbedBridgeOptions {
  parentOrigin: string | null;
  widget: string;
  embedBase: string;
  wrapperRef: RefObject<HTMLElement | null>;
  ready: boolean;
  errorCode: EmbedErrorCode | null;
}

export function useEmbedBridgeController({ parentOrigin, widget, embedBase, wrapperRef, ready, errorCode }: EmbedBridgeOptions): { bridge: EmbedBridge; config: EmbedConfig } {
  const location = useLocation();
  const [attached, setAttached] = useState(false);
  const [config, setConfig] = useState<EmbedConfig>({});
  const active = parentOrigin !== null && typeof window !== 'undefined' && window.parent !== window;

  const post = useCallback(
    (message: EmbedMessage): void => {
      if (!active || parentOrigin === null) return;
      const checked = parseEmbedMessage(message);
      if (checked) window.parent.postMessage(checked, parentOrigin);
    },
    [active, parentOrigin],
  );

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
