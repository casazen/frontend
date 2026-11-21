/**
 * `/embed/v1/embed.js`: the loader an agency includes in the pages of its website (NF-145, §6 of the site integration analysis). It mounts every
 * `[data-casazen-widget]` element (and `CasaZenEmbed.mount(element, options)`): it creates the iframe, keeps its height equal to its content, does the
 * navigations the frame asks for, hands the events of the frame to the page (a DOM event and, when asked, `window.dataLayer`), forwards the stay and the
 * campaign of the page to the frame, and shows a link to the site when the frame does not come. It speaks protocol v1 (`protocol.ts`) and nothing else.
 *
 * Built by `scripts/build-embed.mjs` as ONE file (an IIFE of at most 6 KB gzip), with no dependency, no `fetch`, no storage, no cookie and no `eval`.
 * The module has NO exports on purpose: an IIFE with exports would assign them to a global of its own name and overwrite `window.CasaZenEmbed`.
 *
 * The page and the frame do not trust each other: a message is accepted only from the window of the frame and from its origin, after the protocol has
 * read it back; the whole page is taken only to the origin of the widget; and what leaves the page for the frame is what the patterns of `page-params.ts`
 * let through. The loader never loads a tag manager: `dataLayer` is only written to.
 */

import { EMBED_EVENT_NAMES, buildEmbedMessage, parseEmbedMessage, type EmbedTheme } from './protocol';
import { createWidget, type Plan, type Widget, type WidgetMount } from './mount-widget';
import { frameQuery, isFrameState, isOn, readFrameState, readHeight, readLang, readOrigin, readSlug, readTheme, writeFrameState, type EmbedOptions } from './page-params';

type EmbedWindow = Window & { CasaZenEmbed?: unknown; dataLayer?: unknown[] };

/** The elements the loader mounts by itself. */
const SELECTOR = '[data-casazen-widget]';

function start(win: EmbedWindow): void {
  // The script that is running: where the loader comes from (the default `base`, the folder of `search.js`) and the nonce a strict page gave it.
  const script = document.currentScript as HTMLScriptElement | null;
  const scriptUrl = script?.src ?? '';
  const scriptOrigin = readOrigin(scriptUrl);
  const mounted = new WeakSet<Element>();
  /** The preview switch of each widget the page draws itself (the search bar): a later `mount(element, { preview: true })` turns it on. */
  const previews = new WeakMap<Element, { on: boolean }>();
  const registry = new Map<string, WidgetMount>();
  /** The search bars that wait for `search.js` to register itself. */
  const waiting: { widget: Widget; run: () => void }[] = [];
  let widgets: Widget[] = [];
  let search: 'idle' | 'loading' | 'failed' = 'idle';

  /** An event of a widget: a DOM event on its container and, when the page asked for it, a push of the `dataLayer` with the name and the shape of GA4. */
  const emit = (widget: Widget, name: string, params: Record<string, unknown>): void => {
    if (!(EMBED_EVENT_NAMES as readonly string[]).includes(name)) return;
    widget.el.dispatchEvent(new CustomEvent('casazen:event', { bubbles: true, detail: { name, params, widget: widget.widget } }));
    if (!widget.dataLayer) return;
    const layer = (win.dataLayer = win.dataLayer || []);
    if (name === 'search') {
      // The name goes last: a `params` that carries an `event` of its own can never rename the event.
      layer.push({ ...params, event: name });
    } else {
      layer.push({ ecommerce: null });
      layer.push({ event: name, ecommerce: params });
    }
  };

  const failSearch = (): void => {
    search = 'failed';
    waiting.splice(0).forEach((item) => item.widget.fail());
  };

  /** Loads `search.js` from the folder this script came from, once; a file that fails or never registers shows the link in every bar that waits. */
  const loadSearch = (base: string): void => {
    if (search !== 'idle') return;
    search = 'loading';
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = new URL('search.js', scriptUrl || `${base}/embed/v1/embed.js`).href;
    if (script?.nonce) tag.nonce = script.nonce;
    tag.onerror = failSearch;
    tag.onload = () => {
      if (!registry.has('search')) failSearch();
    };
    (document.head || document.documentElement).appendChild(tag);
  };

  const mount = (element: Element, options: EmbedOptions = {}): void => {
    if (!element || element.nodeType !== 1) return;
    if (mounted.has(element)) {
      // A bar the loader drew by itself (its element carries the attribute) is a preview all the same when its caller asks for it afterwards: the bar reads the
      // switch when its form is sent. Only `true` turns it on, nothing turns it off, and a frame has no preview: for the rest, mounting twice does nothing.
      if (options.preview === true) {
        const mode = previews.get(element);
        if (mode) mode.on = true;
      }
      return;
    }
    const host = element as HTMLElement;
    const get = (key: string, attribute = key): unknown => options[key] ?? host.getAttribute(`data-casazen-${attribute}`);
    const widget = String(get('widget') ?? '');
    const framed = widget === 'booking' || widget === 'property' || widget === 'guest-access';
    if (!framed && widget !== 'search' && !registry.has(widget)) return;
    mounted.add(host);

    const given = get('base');
    const orgGiven = get('org');
    const org = readSlug(orgGiven);
    const slug = readSlug(get('property'));
    const sync = isOn(get('syncUrl', 'sync-url'));
    const plan: Plan = {
      widget,
      framed,
      lang: readLang(get('lang'), document.documentElement.lang),
      base: given ? readOrigin(given) : scriptOrigin,
      linkBase: scriptOrigin,
      org,
      slug,
      invalid: (!!orgGiven && org === '') || (widget === 'property' && slug === ''),
      query: frameQuery(location.search, { checkin: get('checkin'), checkout: get('checkout'), guests: get('guests') }),
      minHeight: readHeight(get('minHeight', 'min-height')),
      theme: readTheme(get('theme')),
      dataLayer: isOn(get('datalayer')),
      sync,
      restored: framed && sync ? readFrameState(widget, location.search) : null,
    };
    const created = createWidget(host, plan);
    if (created.frame) {
      widgets = widgets.filter((item) => item.el.isConnected);
      widgets.push(created);
      return;
    }
    if (!created.ok) return;

    // A widget the page draws itself (the search bar): its function is called with the options, once `search.js` has registered it.
    const mode = { on: options.preview === true };
    previews.set(host, mode);
    const run = (): void => {
      try {
        registry.get(widget)?.(host, {
          lang: plan.lang,
          target: get('target'),
          destinations: get('destinations'),
          theme: plan.theme,
          maxGuests: get('maxGuests', 'max-guests'),
          base: plan.base,
          org,
          emit: (name, params) => emit(created, name, params),
          // Read when the bar needs it (at the submit), not when it is drawn: see `previews`.
          get preview() {
            return mode.on;
          },
        });
      } catch {
        created.fail();
      }
    };
    if (registry.has(widget)) run();
    else if (search === 'failed') created.fail();
    else {
      waiting.push({ widget: created, run });
      loadSearch(plan.base);
    }
  };

  const scan = (root: ParentNode = document): void => {
    if ((root as Element).matches?.(SELECTOR)) mount(root as Element);
    root.querySelectorAll(SELECTOR).forEach((element) => mount(element));
  };

  const register = (name: string, fn: WidgetMount): void => {
    if (typeof fn !== 'function') return;
    registry.set(String(name), fn);
    // The search bars that wait for `search.js` start now; the elements of any other name that were on the page before its function came are mounted now.
    if (name === 'search') waiting.splice(0).forEach((item) => item.run());
    else scan();
  };

  /** The only door a message of a frame goes through: the window it comes from, the origin it says, and the protocol. */
  const onMessage = (event: MessageEvent): void => {
    const widget = widgets.find((item) => item.frame !== null && event.source !== null && item.frame.contentWindow === event.source);
    if (!widget?.frame || event.origin !== widget.origin) return;
    const message = parseEmbedMessage(event.data);
    if (!message) return;

    switch (message.type) {
      case 'ready': {
        widget.show();
        const config = { lang: widget.lang, ...(widget.theme ? { theme: widget.theme as EmbedTheme } : {}) };
        widget.frame.contentWindow?.postMessage(parseEmbedMessage(buildEmbedMessage('config', config)) ?? buildEmbedMessage('config', { lang: widget.lang }), widget.origin);
        break;
      }
      case 'resize':
        widget.frame.style.height = `${message.height}px`;
        break;
      case 'navigate':
        // The whole page goes only where the widget lives; a new tab may go anywhere the protocol let through (http or https), and never reaches the page.
        if (message.target === 'blank') window.open(message.url, '_blank', 'noopener');
        else if (readOrigin(message.url) === widget.origin) location.assign(message.url);
        break;
      case 'event':
        emit(widget, message.name, message.params);
        break;
      case 'url':
        if (widget.sync && isFrameState(widget.widget, message.path, message.query)) {
          history.replaceState(history.state, '', `${location.pathname}?${writeFrameState(location.search, message.path, message.query)}${location.hash}`);
        }
        break;
      case 'error':
        widget.fail();
        break;
      default:
        break;
    }
  };

  win.CasaZenEmbed = { version: 1, mount, scan, register };
  window.addEventListener('message', onMessage);
  new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => node.nodeType === 1 && scan(node as Element)));
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan());
  else scan();
}

// Idempotent: a second copy of the script (two plugins, a page builder that prints it again) finds the object of the first and does nothing.
if (!(window as EmbedWindow).CasaZenEmbed) start(window as EmbedWindow);
