/**
 * One widget of the loader (NF-145): the frame with its placeholder, and the link to the site that takes its place when the frame cannot be shown. All the
 * values it gets are already checked (`page-params.ts`); everything it writes into the page goes through the CSSOM (`element.style.x = …`), never as an
 * `style` attribute or a `<style>` element, which a page with a strict content security policy blocks.
 */

import { LOADER_TEXTS, type EmbedLang } from './texts';

/**
 * How long a widget has to come before the link appears (AC-NF145-5): a frame to say `ready`, a widget the page draws itself (the search bar) to be drawn,
 * which waits for its file. One that comes later takes the link away again.
 */
const READY_TIMEOUT_MS = 8000;

/** What the loader worked out of the attributes of a widget and of the address of the page. */
export interface Plan {
  widget: string;
  /** The widget is one the loader puts in a frame (`booking`, `property`, `guest-access`); the others are drawn by the function registered for them. */
  framed: boolean;
  lang: EmbedLang;
  /** The origin of the site the widget belongs to: `''` when the `base` that was given is not one a frame can be served from. */
  base: string;
  /** Where the link may go when `base` is not valid: the origin the loader itself came from, or `''`. */
  linkBase: string;
  /** The org of the CasaZen domain (`/embed/<org>/<widget>`), `''` on an agency's own domain. */
  org: string;
  /** The property of a `property` widget. */
  slug: string;
  /** The org or the property the attributes name is not valid: there is nothing to frame, the link is shown. */
  invalid: boolean;
  /** The parameters of the page that go on to the frame (`checkin`, `checkout`, `guests`, `where`, `utm_*`), already checked. */
  query: URLSearchParams;
  minHeight: number;
  theme: Record<string, unknown> | undefined;
  dataLayer: boolean;
  sync: boolean;
  /** The state of the frame the address asks to come back to (`?cz=`), when the widget keeps its state there. */
  restored: { path: string; query: string } | null;
}

/** A widget on the page. A widget without a frame (the search bar, a widget that could not be framed) has no `frame` and no `origin`. */
export interface Widget {
  el: HTMLElement;
  widget: string;
  lang: EmbedLang;
  theme: Record<string, unknown> | undefined;
  dataLayer: boolean;
  sync: boolean;
  /** The frame is shown, and nothing is wrong with it. */
  ok: boolean;
  frame: HTMLIFrameElement | null;
  /** The origin the frame is served from: what its messages must say and the only one the whole page may be taken to. */
  origin: string;
  /** The frame said `ready`: it has its content, so the placeholder and the link are gone. */
  show: () => void;
  /** The frame has nothing to show, or not in time: the link to the site is shown (below the frame, when there is one). */
  fail: () => void;
}

/**
 * What the loader hands to the function that `CasaZenEmbed.register(name, fn)` registered for a widget it does not frame (the search bar, `search.js`).
 * The values come as the page gave them (attributes are text), except the ones the loader has to work out for everybody: the language, the theme, the base.
 * The function checks the rest itself.
 */
export interface SearchOptions {
  lang: EmbedLang;
  /** The page the bar leads to (`data-casazen-target`). */
  target: unknown;
  /** The destinations to choose from: the JSON of `[{ id, label }]` (`data-casazen-destinations`). */
  destinations: unknown;
  theme: Record<string, unknown> | undefined;
  /** The most guests the bar takes (`data-casazen-max-guests`). */
  maxGuests: unknown;
  /** The origin of the site (checked), where the bar leads when it has no target. */
  base: string;
  /** The org of the CasaZen domain, `''` on an agency's own domain. */
  org: string;
  /**
   * Reports an event of the widget to the page, as the events of the frames are reported: a `casazen:event` on the container and, when the page asked for
   * it (`data-casazen-datalayer="true"`), a push to `window.dataLayer`. A name that is not one of the four of GA4 the contract knows is dropped.
   */
  emit: (name: string, params: Record<string, unknown>) => void;
  /** Set by whoever calls `CasaZenEmbed.mount(element, { preview: true })` (the preview of the backoffice): the bar checks and reports but never navigates. */
  preview?: boolean;
}

/** The function a widget that is not framed registers: it draws the widget into `el`. */
export type WidgetMount = (el: HTMLElement, options: SearchOptions) => void;

function style(el: HTMLElement, rules: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, rules);
}

/**
 * Prepares a widget for `el`. With a valid plan and a frame widget the frame is created and put in; otherwise (the base or the org is not valid, or the
 * widget is the search bar) nothing is drawn here: the first has already got its link, the second is drawn by `search.js`.
 */
export function createWidget(el: HTMLElement, plan: Plan): Widget {
  const text = LOADER_TEXTS[plan.lang];
  const site = plan.base || plan.linkBase;
  const valid = plan.base !== '' && !plan.invalid;
  let link: HTMLAnchorElement | undefined;
  let reveal = (): void => undefined;
  const wait: { timer?: ReturnType<typeof setTimeout>; watcher?: IntersectionObserver } = {};

  const widget: Widget = {
    el,
    widget: plan.widget,
    lang: plan.lang,
    theme: plan.theme,
    dataLayer: plan.dataLayer,
    sync: plan.sync,
    ok: valid,
    frame: null,
    origin: '',
    show: () => {
      clearTimeout(wait.timer);
      wait.watcher?.disconnect();
      reveal();
      link?.remove();
    },
    fail: () => {
      reveal();
      if (!site) return;
      if (!link) {
        // The matching page of the site: the home, the property, the guest area (`/book/<org>/…` on the CasaZen domain), carrying what the guest chose and where
        // they come from (`utm_source=agency-site`, `utm_medium=embed`, the same words the checkout of a frame carries).
        const home = plan.org ? `/book/${plan.org}` : '';
        const page = plan.widget === 'property' && plan.slug ? `${home}/property/${plan.slug}` : plan.widget === 'guest-access' ? `${home}/my-bookings` : home || '/';
        const query = new URLSearchParams(plan.query);
        query.set('lang', plan.lang);
        query.set('utm_source', 'agency-site');
        query.set('utm_medium', 'embed');
        link = document.createElement('a');
        link.href = `${site}${page}?${query.toString()}`;
        link.textContent = `${plan.widget === 'guest-access' ? text.manage : text.book} ${new URL(site).host}`;
        style(link, { display: 'block', padding: '12px 0', textAlign: 'center' });
      }
      if (!widget.frame) el.textContent = '';
      el.appendChild(link);
    },
  };

  if (!valid) {
    widget.fail();
    return widget;
  }
  if (!plan.framed) {
    // Drawn by a function that may be late (`search.js`, a file that can be slow, blocked, or never answer): the same 8 seconds, then the link takes the
    // place of the empty container. The loader calls `show()` when the function has drawn the widget, which takes the link away again.
    wait.timer = setTimeout(widget.fail, READY_TIMEOUT_MS);
    return widget;
  }

  // The address of the frame: `<base>/embed/[<org>/]<widget>[/<slug>]`, with the language, the page that frames it and the version of the protocol first.
  const search = new URLSearchParams({ lang: plan.lang, parent: location.origin, v: '1' });
  plan.query.forEach((value, key) => search.set(key, value));
  new URLSearchParams(plan.restored?.query ?? '').forEach((value, key) => {
    if (key !== 'lang' && key !== 'parent' && key !== 'v') search.set(key, value);
  });
  const path = plan.restored?.path ?? (plan.widget === 'property' ? `/property/${plan.slug}` : `/${plan.widget}`);

  const frame = document.createElement('iframe');
  frame.src = `${plan.base}/embed${plan.org ? `/${plan.org}` : ''}${path}?${search.toString()}`;
  frame.title = text[plan.widget as 'booking' | 'property' | 'guest-access'];
  frame.setAttribute('loading', 'lazy');
  frame.setAttribute('referrerpolicy', 'origin');
  frame.setAttribute('scrolling', 'no');
  // Out of sight (and of assistive technology) until it has its content, so the frame's own loading state is never seen. Transparent, not
  // `visibility: hidden`: a browser may load a hidden frame at once, and this one is `loading="lazy"` so that a widget far down a page waits for the visitor.
  frame.setAttribute('aria-hidden', 'true');
  style(frame, { display: 'block', width: '100%', height: `${plan.minHeight}px`, border: '0', opacity: '0' });

  // The placeholder sits over the frame, with the same size, and takes the clicks of the visitor until the frame is shown.
  const placeholder = document.createElement('div');
  placeholder.setAttribute('role', 'status');
  placeholder.setAttribute('aria-busy', 'true');
  placeholder.textContent = text.loading;
  style(placeholder, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' });

  const box = document.createElement('div');
  style(box, { position: 'relative' });
  box.append(frame, placeholder);
  el.textContent = '';
  el.appendChild(box);

  reveal = () => {
    frame.style.opacity = '';
    frame.removeAttribute('aria-hidden');
    placeholder.remove();
  };
  // `loading="lazy"` keeps a frame that is far below the fold from being asked for at all, so it cannot say `ready` and nothing is wrong with it: its 8 seconds
  // start when it comes into view, not when the page was printed (a frame that said `ready` before takes the watch away). A browser that cannot tell starts them now.
  const arm = (): void => {
    wait.timer = setTimeout(widget.fail, READY_TIMEOUT_MS);
  };
  if (typeof IntersectionObserver === 'function') {
    wait.watcher = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      wait.watcher?.disconnect();
      arm();
    });
    wait.watcher.observe(frame);
  } else {
    arm();
  }
  widget.frame = frame;
  widget.origin = plan.base;
  return widget;
}
