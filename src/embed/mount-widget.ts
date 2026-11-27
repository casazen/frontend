/**
 * One widget of the loader (NF-145): the frame with its placeholder, and the link to the site that takes its place when the frame cannot be shown. All the
 * values it gets are already checked (`page-params.ts`); everything it writes into the page goes through the CSSOM (`element.style.x = …`), never as an
 * `style` attribute or a `<style>` element, which a page with a strict content security policy blocks.
 */

import { LOADER_TEXTS, type EmbedLang } from './texts';

const READY_TIMEOUT_MS = 8000;

export interface Plan {
  widget: string;
  framed: boolean;
  lang: EmbedLang;
  base: string;
  linkBase: string;
  org: string;
  slug: string;
  invalid: boolean;
  query: URLSearchParams;
  minHeight: number;
  theme: Record<string, unknown> | undefined;
  dataLayer: boolean;
  sync: boolean;
  restored: { path: string; query: string } | null;
}

export interface Widget {
  el: HTMLElement;
  widget: string;
  lang: EmbedLang;
  theme: Record<string, unknown> | undefined;
  dataLayer: boolean;
  sync: boolean;
  ok: boolean;
  frame: HTMLIFrameElement | null;
  origin: string;
  show: () => void;
  fail: () => void;
}

export interface SearchOptions {
  lang: EmbedLang;
  target: unknown;
  destinations: unknown;
  theme: Record<string, unknown> | undefined;
  maxGuests: unknown;
  base: string;
  org: string;
  emit: (name: string, params: Record<string, unknown>) => void;
  preview?: boolean;
}

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
    wait.timer = setTimeout(widget.fail, READY_TIMEOUT_MS);
    return widget;
  }

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
