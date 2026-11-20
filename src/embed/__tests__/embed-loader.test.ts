import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEmbedMessage } from '../protocol';

/**
 * The loader `embed.js` (E41/F02/US01/T01, NF-145): what it mounts, the frame it builds, which messages it believes, where it may take the page, what
 * it hands to the page and to the `dataLayer`, how it keeps the state of the frame in the address, and the link that takes the place of a frame that does
 * not come. The module is the script itself: every test loads it again (`vi.resetModules`) into a clean page and puts it away afterwards, because the
 * loader keeps a `message` listener and a `MutationObserver` for the life of the page.
 */
const BASE = 'https://prenota.quokka360.com';
const SCRIPT_URL = `${BASE}/embed/v1/embed.js`;
const PAGE_ORIGIN = window.location.origin;
const CHECKOUT = `${BASE}/property/casa-mare/checkout?checkin=2026-12-01&checkout=2026-12-05&guests=2&utm_source=agency-site&utm_medium=embed`;

type Options = Record<string, unknown>;
interface EmbedApi {
  version: number;
  mount: (element: Element, options?: Options) => void;
  scan: (root?: ParentNode) => void;
  register: (name: string, fn: (element: HTMLElement, options: Options) => void) => void;
}
type EmbedWindow = Window & { CasaZenEmbed?: EmbedApi; dataLayer?: unknown[] };

const embedWindow = window as EmbedWindow;
const api = () => embedWindow.CasaZenEmbed as EmbedApi;

const listeners: EventListenerOrEventListenerObject[] = [];
const observers: MutationObserver[] = [];
const bodyListeners: EventListener[] = [];

/** Listens for the `casazen:event` the loader fires on a container (it bubbles up to the body); taken away after the test. */
function listen(handler: EventListener): void {
  document.body.addEventListener('casazen:event', handler);
  bodyListeners.push(handler);
}

beforeEach(() => {
  // What the loader installs for the life of the page is taken away after each test, or the next page would have two loaders.
  const addEventListener = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    if (type === 'message') listeners.push(listener);
    addEventListener(type, listener, options);
  });
  const NativeObserver = window.MutationObserver;
  vi.stubGlobal(
    'MutationObserver',
    class extends NativeObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        observers.push(this);
      }
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const listener of listeners.splice(0)) window.removeEventListener('message', listener);
  for (const observer of observers.splice(0)) observer.disconnect();
  for (const handler of bodyListeners.splice(0)) document.body.removeEventListener('casazen:event', handler);
  Reflect.deleteProperty(window, 'CasaZenEmbed');
  Reflect.deleteProperty(window, 'dataLayer');
  Reflect.deleteProperty(document, 'currentScript');
  document.documentElement.lang = '';
  document.body.innerHTML = '';
  document.head.querySelectorAll('script').forEach((script) => script.remove());
  window.history.replaceState(null, '', '/');
});

/** The script is the one the page printed: `document.currentScript` says where it came from, as the browser does while the script runs. */
async function loadLoader(script: { src: string; nonce?: string } | null = { src: SCRIPT_URL }): Promise<void> {
  if (script) Object.defineProperty(document, 'currentScript', { configurable: true, get: () => script });
  vi.resetModules();
  await import('../embed');
}

function widget(kind: string, attributes: Record<string, string> = {}): HTMLElement {
  const element = document.createElement('div');
  element.setAttribute('data-casazen-widget', kind);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(`data-casazen-${name}`, value);
  document.body.appendChild(element);
  return element;
}

const frameOf = (element: Element) => element.querySelector('iframe') as HTMLIFrameElement;
const linkOf = (element: Element) => element.querySelector('a') as HTMLAnchorElement | null;
const placeholderOf = (element: Element) => element.querySelector('[aria-busy="true"]');

/** A message as the browser delivers it: from `source` (the window of the frame unless said), saying `origin`. */
function post(frame: HTMLIFrameElement, data: unknown, origin = BASE, source: MessageEventSource | null = frame.contentWindow): void {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source }));
}

describe('mounting (AC1)', () => {
  it('embedLoader_Api_IsTheObjectOfTheContract', async () => {
    await loadLoader();

    expect(api().version).toBe(1);
    expect(Object.keys(api()).sort()).toEqual(['mount', 'register', 'scan', 'version']);
  });

  it('embedLoader_IncludedTwice_KeepsOneObjectAndMountsEachWidgetOnce', async () => {
    const element = widget('booking');
    await loadLoader();
    const first = api();
    const frame = frameOf(element);

    await loadLoader();

    expect(api()).toBe(first);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(frameOf(element)).toBe(frame);
  });

  it('embedLoader_Mount_OnAMountedElement_DoesNothing', async () => {
    const element = widget('booking');
    await loadLoader();
    const frame = frameOf(element);

    api().mount(element);
    api().mount(element, { widget: 'property', property: 'casa-mare' });

    expect(element.querySelectorAll('iframe')).toHaveLength(1);
    expect(frameOf(element)).toBe(frame);
  });

  it('embedLoader_ElementAddedLater_IsMountedByTheObserver', async () => {
    await loadLoader();

    const element = widget('booking');
    const section = document.createElement('section');
    const nested = document.createElement('div');
    nested.setAttribute('data-casazen-widget', 'guest-access');
    section.appendChild(nested);
    document.body.appendChild(section);
    await Promise.resolve();

    expect(frameOf(element)).not.toBeNull();
    expect(new URL(frameOf(nested).src).pathname).toBe('/embed/guest-access');
  });

  it('embedLoader_Scan_MountsASubtreeAndTheElementItself', async () => {
    await loadLoader();
    // A tree that is not in the page (the observer never sees it) with a widget in it, and a widget that is the root itself.
    const tree = document.createElement('div');
    const child = document.createElement('div');
    child.setAttribute('data-casazen-widget', 'guest-access');
    tree.appendChild(child);
    const root = document.createElement('div');
    root.setAttribute('data-casazen-widget', 'booking');

    api().scan(tree);
    api().scan(root);

    expect(frameOf(child)).not.toBeNull();
    expect(frameOf(root)).not.toBeNull();
  });

  it('embedLoader_Mount_TakesTheOptionsBeforeTheAttributes', async () => {
    await loadLoader();
    const element = document.createElement('div');
    element.setAttribute('data-casazen-widget', 'booking');
    element.setAttribute('data-casazen-lang', 'it');
    document.body.appendChild(element);

    api().mount(element, { widget: 'property', property: 'casa-mare', lang: 'en', minHeight: 500 });

    const frame = frameOf(element);
    expect(new URL(frame.src).pathname).toBe('/embed/property/casa-mare');
    expect(new URL(frame.src).searchParams.get('lang')).toBe('en');
    expect(frame.style.height).toBe('500px');
  });

  it('embedLoader_UnknownWidget_IsLeftAlone', async () => {
    const element = widget('carousel');
    await loadLoader();

    expect(element.childNodes).toHaveLength(0);
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });
});

describe('the frame (AC2)', () => {
  it('embedLoader_Booking_BuildsTheFrameOfTheAgencyDomain', async () => {
    const element = widget('booking');
    await loadLoader();
    const frame = frameOf(element);

    expect(frame.src).toBe(`${BASE}/embed/booking?lang=it&parent=${encodeURIComponent(PAGE_ORIGIN)}&v=1`);
    expect(frame.title).toBe('Prenotazione');
    expect(frame.getAttribute('loading')).toBe('lazy');
    expect(frame.getAttribute('referrerpolicy')).toBe('origin');
    expect(frame.hasAttribute('sandbox')).toBe(false);
    expect(frame.style.width).toBe('100%');
    expect(frame.style.height).toBe('360px');
    expect(frame.style.border).toMatch(/^0(px)?$/);
  });

  it('embedLoader_Frame_StartsHiddenBehindAPlaceholderThatIsBusy', async () => {
    const element = widget('booking');
    await loadLoader();

    expect(placeholderOf(element)?.textContent).toBe('Caricamento…');
    expect(frameOf(element).style.visibility).toBe('hidden');
  });

  it.each([
    ['booking', {}, 'it', '/embed/booking', 'Prenotazione'],
    ['booking', { lang: 'en' }, 'en', '/embed/booking', 'Booking'],
    ['property', { property: 'casa-mare' }, 'it', '/embed/property/casa-mare', 'Scheda alloggio'],
    ['property', { property: 'casa-mare', lang: 'en' }, 'en', '/embed/property/casa-mare', 'Property'],
    ['guest-access', {}, 'it', '/embed/guest-access', 'Accesso alla prenotazione'],
    ['guest-access', { lang: 'en' }, 'en', '/embed/guest-access', 'Manage your booking'],
  ])('embedLoader_%s_%j_FramesThePathAndTitleOfTheWidget', async (kind, attributes, lang, path, title) => {
    const element = widget(kind, attributes);
    await loadLoader();
    const frame = frameOf(element);

    expect(new URL(frame.src).pathname).toBe(path);
    expect(new URL(frame.src).searchParams.get('lang')).toBe(lang);
    expect(frame.title).toBe(title);
  });

  it('embedLoader_OnTheCasaZenDomain_PutsTheOrgBeforeTheWidget', async () => {
    const booking = widget('booking', { base: 'https://app.casazen.example/', org: 'villa-rossi' });
    const property = widget('property', { base: 'https://app.casazen.example', org: 'villa-rossi', property: 'casa-mare' });
    await loadLoader();

    expect(new URL(frameOf(booking).src).origin).toBe('https://app.casazen.example');
    expect(new URL(frameOf(booking).src).pathname).toBe('/embed/villa-rossi/booking');
    expect(new URL(frameOf(property).src).pathname).toBe('/embed/villa-rossi/property/casa-mare');
  });

  it('embedLoader_Base_DefaultsToTheOriginOfTheScriptAndTheDeveloperMachineIsAllowed', async () => {
    const own = widget('booking');
    const local = widget('booking', { base: 'http://localhost:5173' });
    await loadLoader({ src: `${BASE}/embed/v1/embed.js?ver=3` });

    expect(new URL(frameOf(own).src).origin).toBe(BASE);
    expect(new URL(frameOf(local).src).origin).toBe('http://localhost:5173');
  });

  it.each([
    ['text that is no address', 'not a url'],
    ['a script', 'javascript:alert(1)'],
    ['http on a real host', 'http://prenota.quokka360.com'],
    ['credentials in the address', 'https://user:pw@prenota.quokka360.com'],
    ['another scheme', 'ftp://prenota.quokka360.com'],
  ])('embedLoader_Base_%s_ShowsTheLinkInsteadOfAFrame', async (_label, base) => {
    const element = widget('booking', { base });
    await loadLoader();

    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    // The link goes to the site the loader itself came from: the only origin that is known to be good.
    expect(linkOf(element)?.href.startsWith(`${BASE}/`)).toBe(true);
  });

  it('embedLoader_NoBaseAndNoScriptOrigin_DrawsNothing', async () => {
    const element = widget('booking');
    await loadLoader(null);

    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    expect(linkOf(element)).toBeNull();
  });

  it.each([
    ['an org that is not a slug', 'booking', { base: BASE, org: 'villa/rossi' }],
    ['a property widget without a property', 'property', {}],
    ['a property that is not a slug', 'property', { property: '../casa' }],
  ])('embedLoader_%s_ShowsTheLinkInsteadOfAFrame', async (_label, kind, attributes) => {
    const element = widget(kind, attributes);
    await loadLoader();

    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    expect(linkOf(element)).not.toBeNull();
  });

  it.each([
    ['en', '', 'en'],
    ['it', 'en', 'it'],
    ['auto', 'en-GB', 'en'],
    ['', 'en_US', 'en'],
    ['auto', 'it-IT', 'it'],
    ['auto', 'de', 'it'],
    ['auto', '', 'it'],
    ['fr', 'en', 'it'],
  ])('embedLoader_Lang_%s_WithAPageIn_%s_Is_%s', async (asked, pageLang, expected) => {
    document.documentElement.lang = pageLang;
    const element = widget('booking', asked ? { lang: asked } : {});
    await loadLoader();

    expect(new URL(frameOf(element).src).searchParams.get('lang')).toBe(expected);
  });

  it.each([
    ['500', '500px'],
    ['100', '100px'],
    ['3000', '3000px'],
    ['99', '360px'],
    ['3001', '360px'],
    ['abc', '360px'],
    ['250.5', '360px'],
    ['', '360px'],
  ])('embedLoader_MinHeight_%s_Is_%s', async (asked, expected) => {
    const element = widget('booking', { 'min-height': asked });
    await loadLoader();

    expect(frameOf(element).style.height).toBe(expected);
  });

  describe('what the page hands over', () => {
    it('embedLoader_PageParameters_GoOnToTheFrame', async () => {
      window.history.replaceState(null, '', '/prenota?checkin=2026-12-01&checkout=2026-12-05&guests=3&where=lugano&utm_source=newsletter&utm_medium=email&utm_campaign=natale-2026&utm_term=casa&utm_content=hero');
      const element = widget('booking');
      await loadLoader();
      const query = new URL(frameOf(element).src).searchParams;

      expect(Object.fromEntries(query)).toEqual({
        lang: 'it',
        parent: PAGE_ORIGIN,
        v: '1',
        checkin: '2026-12-01',
        checkout: '2026-12-05',
        guests: '3',
        where: 'lugano',
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'natale-2026',
        utm_term: 'casa',
        utm_content: 'hero',
      });
    });

    it('embedLoader_AttributesOfTheWidget_WinOverThePageForDatesAndGuests', async () => {
      window.history.replaceState(null, '', '/prenota?checkin=2026-12-01&checkout=2026-12-05&guests=3&where=lugano');
      const element = widget('booking', { checkin: '2027-01-10', checkout: '2027-01-12', guests: '4' });
      await loadLoader();
      const query = new URL(frameOf(element).src).searchParams;

      expect(query.get('checkin')).toBe('2027-01-10');
      expect(query.get('checkout')).toBe('2027-01-12');
      expect(query.get('guests')).toBe('4');
      // `where` has no attribute: it is the page's.
      expect(query.get('where')).toBe('lugano');
    });

    it.each([
      ['dates that do not exist', 'checkin=2026-02-30&checkout=2026-03-02'],
      ['dates written another way', 'checkin=01/12/2026&checkout=05/12/2026'],
      ['a departure before the arrival', 'checkin=2026-12-05&checkout=2026-12-01'],
      ['a departure on the arrival', 'checkin=2026-12-05&checkout=2026-12-05'],
      ['an arrival with no departure', 'checkin=2026-12-05'],
      ['a month 13', 'checkin=2026-13-01&checkout=2026-13-05'],
    ])('embedLoader_PageDates_%s_AreDropped', async (_label, search) => {
      window.history.replaceState(null, '', `/prenota?${search}`);
      const element = widget('booking');
      await loadLoader();
      const query = new URL(frameOf(element).src).searchParams;

      expect(query.has('checkin')).toBe(false);
      expect(query.has('checkout')).toBe(false);
    });

    it.each([['0'], ['100'], ['-2'], ['2.5'], ['abc'], ['02'], [''], ['1e1']])('embedLoader_PageGuests_%s_IsDropped', async (guests) => {
      window.history.replaceState(null, '', `/prenota?guests=${guests}`);
      const element = widget('booking');
      await loadLoader();

      expect(new URL(frameOf(element).src).searchParams.has('guests')).toBe(false);
    });

    it.each([['1'], ['2'], ['9'], ['10'], ['99']])('embedLoader_PageGuests_%s_Passes', async (guests) => {
      window.history.replaceState(null, '', `/prenota?guests=${guests}`);
      const element = widget('booking');
      await loadLoader();

      expect(new URL(frameOf(element).src).searchParams.get('guests')).toBe(guests);
    });

    it('embedLoader_PageCampaign_ThatIsNotAPlainToken_IsDropped', async () => {
      window.history.replaceState(
        null,
        '',
        `/prenota?utm_source=guest%40example.com&utm_medium=a%20b&utm_campaign=${'x'.repeat(81)}&utm_term=3331234567&utm_content=ok-1&utm_other=x&where=a%20b&where2=x`,
      );
      const element = widget('booking');
      await loadLoader();
      const query = new URL(frameOf(element).src).searchParams;

      // An address of e-mail, a text with a space and a value that is too long are no token; a name that is not one of the five is not forwarded.
      expect(query.has('utm_source')).toBe(false);
      expect(query.has('utm_medium')).toBe(false);
      expect(query.has('utm_campaign')).toBe(false);
      expect(query.has('utm_other')).toBe(false);
      expect(query.has('where')).toBe(false);
      expect(query.has('where2')).toBe(false);
      expect(query.get('utm_content')).toBe('ok-1');
    });

    it('embedLoader_NothingElseOfThePage_GoesOnToTheFrame', async () => {
      window.history.replaceState(null, '', '/prenota?code=ABCDE-FGHIJ&token=secret&email=guest%40example.com&page_id=7&parent=https%3A%2F%2Fevil.example&v=9&lang=de&checkin=2026-12-01&checkout=2026-12-05');
      const element = widget('booking');
      await loadLoader();
      const query = new URL(frameOf(element).src).searchParams;

      expect([...query.keys()].sort()).toEqual(['checkin', 'checkout', 'lang', 'parent', 'v']);
      // The three that belong to the frame itself are the loader's, whatever the page says.
      expect(query.get('parent')).toBe(PAGE_ORIGIN);
      expect(query.get('v')).toBe('1');
      expect(query.get('lang')).toBe('it');
    });
  });
});

describe('the messages of the frame (AC3)', () => {
  it('embedLoader_ignoresForeignMessages', async () => {
    const element = widget('booking');
    await loadLoader();
    const frame = frameOf(element);
    const send = vi.spyOn(frame.contentWindow as Window, 'postMessage');
    const resize = buildEmbedMessage('resize', { height: 900 });
    const ready = buildEmbedMessage('ready', { widget: 'booking' });

    post(frame, resize, BASE, window);
    post(frame, ready, BASE, window);
    post(frame, resize, BASE, null);
    post(frame, resize, 'https://evil.example');
    post(frame, resize, `${BASE}.evil.example`);
    post(frame, resize, 'http://prenota.quokka360.com');
    post(frame, resize, `${BASE}:8443`);
    post(frame, resize, '');
    post(frame, ready, 'https://evil.example');
    post(frame, { ...resize, v: 2 });
    post(frame, { ...resize, source: 'other' });
    post(frame, { type: 'resize', height: 900 });
    post(frame, { ...resize, height: 'tall' });
    post(frame, { ...resize, height: -5 });
    post(frame, JSON.stringify(resize));
    post(frame, null);

    expect(frame.style.height).toBe('360px');
    expect(frame.style.visibility).toBe('hidden');
    expect(placeholderOf(element)).not.toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('embedLoader_Messages_GoOnlyToTheWidgetWhoseFrameSentThem', async () => {
    const first = widget('booking');
    const second = widget('guest-access');
    await loadLoader();

    post(frameOf(second), buildEmbedMessage('resize', { height: 700 }));

    expect(frameOf(second).style.height).toBe('700px');
    expect(frameOf(first).style.height).toBe('360px');
  });

  it('embedLoader_Resize_SetsTheHeightAtOnceAndAlsoLowersIt', async () => {
    const element = widget('booking');
    await loadLoader();
    const frame = frameOf(element);

    post(frame, buildEmbedMessage('resize', { height: 900 }));
    expect(frame.style.height).toBe('900px');

    post(frame, buildEmbedMessage('resize', { height: 420 }));
    expect(frame.style.height).toBe('420px');

    // What the protocol brings down to its limit is what the page gets.
    post(frame, buildEmbedMessage('resize', { height: 99999 }));
    expect(frame.style.height).toBe('50000px');
  });

  it('embedLoader_Ready_RemovesThePlaceholderAndSendsTheConfigToTheOriginOfTheFrameOnly', async () => {
    const element = widget('booking', { lang: 'en', theme: '{"primary":"#0a7d5a","radius":"12px","font":"moderno","evil":"x"}' });
    await loadLoader();
    const frame = frameOf(element);
    const send = vi.spyOn(frame.contentWindow as Window, 'postMessage');

    post(frame, buildEmbedMessage('ready', { widget: 'booking' }));

    expect(placeholderOf(element)).toBeNull();
    expect(frame.style.visibility).toBe('');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ source: 'casazen', v: 1, type: 'config', lang: 'en', theme: { primary: '#0a7d5a', radius: '12px', font: 'moderno' } }, BASE);
  });

  it.each([
    ['no theme', undefined],
    ['text that is not JSON', 'primary: red'],
    ['a list', '["#0a7d5a"]'],
    ['a text', '"red"'],
    ['null', 'null'],
    ['JSON of more than 500 characters', JSON.stringify({ primary: '#0a7d5a', note: 'x'.repeat(500) })],
  ])('embedLoader_Theme_%s_SendsTheLanguageAlone', async (_label, theme) => {
    const element = widget('booking', theme === undefined ? {} : { theme });
    await loadLoader();
    const frame = frameOf(element);
    const send = vi.spyOn(frame.contentWindow as Window, 'postMessage');

    post(frame, buildEmbedMessage('ready', { widget: 'booking' }));

    expect(send).toHaveBeenCalledWith({ source: 'casazen', v: 1, type: 'config', lang: 'it' }, BASE);
  });

  it('embedLoader_Theme_PassedToMountAsAnObject_IsSent', async () => {
    await loadLoader();
    const element = document.createElement('div');
    document.body.appendChild(element);
    api().mount(element, { widget: 'booking', theme: { primary: '#123456', radius: 8 } });
    const frame = frameOf(element);
    const send = vi.spyOn(frame.contentWindow as Window, 'postMessage');

    post(frame, buildEmbedMessage('ready', { widget: 'booking' }));

    // A radius that is not a short text is not one of the contract: the protocol drops it, the primary color stays.
    expect(send).toHaveBeenCalledWith({ source: 'casazen', v: 1, type: 'config', lang: 'it', theme: { primary: '#123456' } }, BASE);
  });

  it('embedLoader_Config_FromTheFrame_IsNotForThePage', async () => {
    const element = widget('booking');
    await loadLoader();
    const frame = frameOf(element);
    const send = vi.spyOn(frame.contentWindow as Window, 'postMessage');

    post(frame, buildEmbedMessage('config', { theme: { primary: '#ff0000' }, lang: 'en' }));

    expect(send).not.toHaveBeenCalled();
    expect(placeholderOf(element)).not.toBeNull();
  });
});

describe('the whole page goes only where the widget lives (AC4)', () => {
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
  });

  it('embedLoader_navigate_Top_GoesToTheOriginOfTheWidget', async () => {
    const element = widget('booking');
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('navigate', { url: CHECKOUT, target: 'top' }));

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(CHECKOUT);
  });

  it('embedLoader_navigate_Top_OnTheCasaZenDomain_GoesToTheCasaZenDomain', async () => {
    const element = widget('booking', { base: 'https://app.casazen.example', org: 'villa-rossi' });
    await loadLoader();
    const checkout = 'https://app.casazen.example/book/villa-rossi/property/casa-mare/checkout?checkin=2026-12-01&checkout=2026-12-05&guests=2';

    post(frameOf(element), buildEmbedMessage('navigate', { url: checkout, target: 'top' }), 'https://app.casazen.example');

    expect(assign).toHaveBeenCalledWith(checkout);
  });

  it.each([
    ['another site', 'https://evil.example/checkout'],
    ['a site that starts like the widget', 'https://prenota.quokka360.com.evil.example/checkout'],
    ['a sub-domain of the widget', 'https://evil.prenota.quokka360.com/checkout'],
    ['the same host over http', 'http://prenota.quokka360.com/checkout'],
    ['the same host on another port', 'https://prenota.quokka360.com:8443/checkout'],
    ['an address with credentials', 'https://user:pw@evil.example/checkout'],
  ])('embedLoader_navigate_refusesForeignOrigin_%s', async (_label, url) => {
    const element = widget('booking');
    await loadLoader();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    post(frameOf(element), buildEmbedMessage('navigate', { url, target: 'top' }));

    expect(assign).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it.each([
    ['a script', 'javascript:alert(document.cookie)'],
    ['a data address', 'data:text/html,<script>alert(1)</script>'],
    ['a blob', 'blob:https://prenota.quokka360.com/1234'],
    ['a relative address', '/property/casa-mare/checkout'],
    ['an address that is not one', 'not a url'],
  ])('embedLoader_navigate_refuses_%s', async (_label, url) => {
    const element = widget('booking');
    await loadLoader();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    for (const target of ['top', 'blank']) post(frameOf(element), { source: 'casazen', v: 1, type: 'navigate', url, target });

    expect(assign).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('embedLoader_navigate_Blank_OpensANewTabWithNoOpener', async () => {
    const element = widget('booking');
    await loadLoader();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    post(frameOf(element), buildEmbedMessage('navigate', { url: `${BASE}/my-bookings?code=ABCDE-FGHIJ`, target: 'blank' }));

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(`${BASE}/my-bookings?code=ABCDE-FGHIJ`, '_blank', 'noopener');
    expect(assign).not.toHaveBeenCalled();
  });

  it('embedLoader_navigate_FromAnotherWindowOrOrigin_IsIgnored', async () => {
    const element = widget('booking');
    await loadLoader();
    const frame = frameOf(element);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const message = buildEmbedMessage('navigate', { url: CHECKOUT, target: 'top' });

    post(frame, message, BASE, window);
    post(frame, message, 'https://evil.example');
    post(frame, buildEmbedMessage('navigate', { url: CHECKOUT, target: 'blank' }), 'https://evil.example');

    expect(assign).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});

describe('the events of the frame (AC5)', () => {
  const VIEW_ITEM_LIST = { item_list_id: 'search_results', items: [{ item_id: 'p1', item_name: 'Casa Mare', index: 0, price: 480.5, quantity: 1 }] };

  it('embedLoader_Event_FiresACustomEventOnTheContainerThatBubbles', async () => {
    const element = widget('booking');
    await loadLoader();
    const heard: CustomEvent[] = [];
    listen((event) => heard.push(event as CustomEvent));

    post(frameOf(element), buildEmbedMessage('event', { name: 'view_item_list', params: VIEW_ITEM_LIST }));

    expect(heard).toHaveLength(1);
    expect(heard[0].target).toBe(element);
    expect(heard[0].detail).toEqual({ name: 'view_item_list', params: VIEW_ITEM_LIST, widget: 'booking' });
  });

  it('embedLoader_Event_WithoutTheAttribute_PushesNothingAndCreatesNoDataLayer', async () => {
    const element = widget('booking');
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('event', { name: 'view_item_list', params: VIEW_ITEM_LIST }));
    post(frameOf(element), buildEmbedMessage('event', { name: 'search', params: { search_term: 'Lugano' } }));

    expect(embedWindow.dataLayer).toBeUndefined();
  });

  it('embedLoader_Event_WithDatalayerOff_PushesNothingToAnExistingDataLayer', async () => {
    embedWindow.dataLayer = [];
    const element = widget('booking', { datalayer: 'false' });
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('event', { name: 'view_item_list', params: VIEW_ITEM_LIST }));

    expect(embedWindow.dataLayer).toEqual([]);
  });

  it.each([
    ['view_item_list', VIEW_ITEM_LIST],
    ['view_item', { currency: 'CHF', value: 480.5, items: [{ item_id: 'p1' }] }],
    ['begin_checkout', { currency: 'EUR', value: 1200, items: [{ item_id: 'p1', quantity: 1 }] }],
  ] as const)('embedLoader_Event_%s_IsPushedWithTheShapeOfGa4', async (name, params) => {
    const element = widget('booking', { datalayer: 'true' });
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('event', { name, params }));

    expect(embedWindow.dataLayer).toEqual([{ ecommerce: null }, { event: name, ecommerce: params }]);
  });

  it('embedLoader_Event_Search_IsPushedFlat', async () => {
    const element = widget('booking', { datalayer: 'true' });
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('event', { name: 'search', params: { search_term: 'Lugano', start_date: '2026-12-01', end_date: '2026-12-05' } }));

    expect(embedWindow.dataLayer).toEqual([{ event: 'search', search_term: 'Lugano', start_date: '2026-12-01', end_date: '2026-12-05' }]);
  });

  it('embedLoader_Event_KeepsTheDataLayerThePageAlreadyHas', async () => {
    const page = [{ event: 'page_view' }];
    embedWindow.dataLayer = page;
    const element = widget('booking', { datalayer: 'true' });
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('event', { name: 'view_item', params: {} }));

    expect(embedWindow.dataLayer).toBe(page);
    expect(page).toEqual([{ event: 'page_view' }, { ecommerce: null }, { event: 'view_item', ecommerce: {} }]);
  });

  it('embedLoader_Event_CannotRenameItself', async () => {
    const element = widget('booking', { datalayer: 'true' });
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('event', { name: 'search', params: { event: 'purchase', search_term: 'Lugano' } }));

    expect(embedWindow.dataLayer).toEqual([{ search_term: 'Lugano', event: 'search' }]);
  });

  it.each([['purchase'], ['page_view'], ['Search'], ['gtm.js'], ['']])('embedLoader_Event_%s_IsDropped', async (name) => {
    const element = widget('booking', { datalayer: 'true' });
    await loadLoader();
    const heard = vi.fn();
    listen(heard);

    post(frameOf(element), { source: 'casazen', v: 1, type: 'event', name, params: { transaction_id: 't1' } });

    expect(heard).not.toHaveBeenCalled();
    expect(embedWindow.dataLayer).toBeUndefined();
  });

  it('embedLoader_Event_FromAnotherWindow_IsIgnored', async () => {
    const element = widget('booking', { datalayer: 'true' });
    await loadLoader();
    const heard = vi.fn();
    listen(heard);

    post(frameOf(element), buildEmbedMessage('event', { name: 'view_item', params: {} }), BASE, window);
    post(frameOf(element), buildEmbedMessage('event', { name: 'view_item', params: {} }), 'https://evil.example');

    expect(heard).not.toHaveBeenCalled();
    expect(embedWindow.dataLayer).toBeUndefined();
  });

  it('embedLoader_Datalayer_NeverLoadsATagManager', async () => {
    const element = widget('booking', { datalayer: 'true' });
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('event', { name: 'begin_checkout', params: { currency: 'EUR', value: 1 } }));

    expect(document.querySelectorAll('script')).toHaveLength(0);
    expect(JSON.stringify(embedWindow.dataLayer)).not.toContain('gtm.');
  });
});

describe('the state of the frame in the address (AC6)', () => {
  const state = () => new URLSearchParams(window.location.search).get('cz');

  it('embedLoader_syncUrl_MirrorsTheFrameInTheAddressAndKeepsTheRest', async () => {
    window.history.replaceState({ keep: true }, '', '/prenota/?page_id=7&cz=%2Fbooking#top');
    const element = widget('booking', { 'sync-url': 'true' });
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('url', { path: '/property/casa-mare', query: 'checkin=2026-12-01&checkout=2026-12-05&guests=2' }));

    expect(state()).toBe('/property/casa-mare?checkin=2026-12-01&checkout=2026-12-05&guests=2');
    expect(window.location.pathname).toBe('/prenota/');
    expect(new URLSearchParams(window.location.search).get('page_id')).toBe('7');
    expect(window.location.hash).toBe('#top');
    expect(window.history.state).toEqual({ keep: true });
  });

  it('embedLoader_syncUrl_AFrameWithNoQuery_WritesThePathAlone', async () => {
    const element = widget('booking', { 'sync-url': 'true' });
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('url', { path: '/booking', query: '' }));

    expect(state()).toBe('/booking');
  });

  it('embedLoader_syncUrl_Off_LeavesTheAddressAlone', async () => {
    window.history.replaceState(null, '', '/prenota/?page_id=7');
    const element = widget('booking');
    const explicit = widget('booking', { 'sync-url': 'false' });
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('url', { path: '/booking', query: 'guests=2' }));
    post(frameOf(explicit), buildEmbedMessage('url', { path: '/booking', query: 'guests=2' }));

    expect(window.location.search).toBe('?page_id=7');
  });

  it('embedLoader_syncUrl_FromAnotherWindowOrOrigin_IsIgnored', async () => {
    const element = widget('booking', { 'sync-url': 'true' });
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('url', { path: '/booking', query: 'guests=2' }), BASE, window);
    post(frameOf(element), buildEmbedMessage('url', { path: '/booking', query: 'guests=2' }), 'https://evil.example');

    expect(state()).toBeNull();
  });

  it.each([
    ['a page of the app', '/admin'],
    ['a path that climbs', '/property/../../admin'],
    ['a path under a widget', '/booking/extra'],
    ['a property with no slug', '/property/'],
    ['an address of another site', 'https://evil.example/booking'],
    ['an address that borrows the scheme', '//evil.example/booking'],
    ['a script', 'javascript:alert(1)'],
    ['a path in another case that is not one', '/BOOKINGS'],
    ['a path with a query inside', '/booking?x=1'],
    ['nothing', ''],
  ])('embedLoader_syncUrl_rejectsForeignPaths_%s', async (_label, path) => {
    window.history.replaceState(null, '', '/prenota/');
    const element = widget('booking', { 'sync-url': 'true' });
    await loadLoader();

    post(frameOf(element), { source: 'casazen', v: 1, type: 'url', path, query: '' });

    expect(window.location.search).toBe('');
  });

  it.each([
    ['a tag', 'x=<script>'],
    ['a quote', 'x="1"'],
    ['a space', 'x=a b'],
    ['a fragment', 'x=1#top'],
    ['a slash', 'x=//evil.example'],
    ['more than 1000 characters', `x=${'a'.repeat(999)}`],
  ])('embedLoader_syncUrl_rejectsAQueryWith_%s', async (_label, query) => {
    window.history.replaceState(null, '', '/prenota/');
    const element = widget('booking', { 'sync-url': 'true' });
    await loadLoader();

    post(frameOf(element), { source: 'casazen', v: 1, type: 'url', path: '/booking', query });

    expect(window.location.search).toBe('');
  });

  it('embedLoader_syncUrl_ARestoredStateIsTheFrameOfTheWidget', async () => {
    window.history.replaceState(null, '', `/prenota/?cz=${encodeURIComponent('/property/casa-mare?checkin=2026-12-01&checkout=2026-12-04&guests=2')}`);
    const element = widget('booking', { 'sync-url': 'true' });
    await loadLoader();
    const frame = new URL(frameOf(element).src);

    expect(frame.pathname).toBe('/embed/property/casa-mare');
    expect(frame.searchParams.get('checkin')).toBe('2026-12-01');
    expect(frame.searchParams.get('checkout')).toBe('2026-12-04');
    expect(frame.searchParams.get('guests')).toBe('2');
    expect(frame.searchParams.get('lang')).toBe('it');
    expect(frame.searchParams.get('parent')).toBe(PAGE_ORIGIN);
  });

  it('embedLoader_syncUrl_ARestoredStateWinsOverTheStayOfThePage', async () => {
    window.history.replaceState(null, '', `/prenota/?checkin=2026-11-01&checkout=2026-11-03&guests=5&cz=${encodeURIComponent('/booking?checkin=2026-12-01&checkout=2026-12-04')}`);
    const element = widget('booking', { 'sync-url': 'true' });
    await loadLoader();
    const query = new URL(frameOf(element).src).searchParams;

    expect(query.get('checkin')).toBe('2026-12-01');
    expect(query.get('checkout')).toBe('2026-12-04');
    // What the restored state does not say stays what the page said.
    expect(query.get('guests')).toBe('5');
  });

  it('embedLoader_syncUrl_ARestoredStateCannotChangeTheLanguageTheParentOrTheVersion', async () => {
    window.history.replaceState(null, '', `/prenota/?cz=${encodeURIComponent('/booking?parent=https://evil.example&lang=de&v=9')}`);
    const element = widget('booking', { 'sync-url': 'true' });
    await loadLoader();
    const query = new URL(frameOf(element).src).searchParams;

    // `https://evil.example` has `:` and `/`, which are no safe characters: the whole state is ignored.
    expect(new URL(frameOf(element).src).pathname).toBe('/embed/booking');
    expect(query.getAll('parent')).toEqual([PAGE_ORIGIN]);
    expect(query.getAll('lang')).toEqual(['it']);
    expect(query.getAll('v')).toEqual(['1']);
  });

  it('embedLoader_syncUrl_ARestoredQueryThatNamesTheFrameParameters_DoesNotDuplicateThem', async () => {
    window.history.replaceState(null, '', `/prenota/?cz=${encodeURIComponent('/booking?parent=evil&lang=de&v=9&guests=3')}`);
    const element = widget('booking', { 'sync-url': 'true' });
    await loadLoader();
    const query = new URL(frameOf(element).src).searchParams;

    expect(query.getAll('parent')).toEqual([PAGE_ORIGIN]);
    expect(query.getAll('lang')).toEqual(['it']);
    expect(query.getAll('v')).toEqual(['1']);
    expect(query.get('guests')).toBe('3');
  });

  it.each([
    ['a page of the app', '/admin'],
    ['a path that climbs', '/property/../../admin'],
    ['an address of another site', 'https://evil.example/booking'],
    ['an address that borrows the scheme', '//evil.example/booking'],
    ['a script', 'javascript:alert(1)'],
    ['a script after a path', '/booking?x=javascript:alert(1)'],
    ['a tag in the query', '/booking?x=<script>alert(1)</script>'],
    ['a fragment in the query', '/booking?x=1#top'],
    ['a path that is not of this widget', '/guest-access'],
  ])('embedLoader_syncUrl_rejectsForeignPaths_OnLoad_%s', async (_label, value) => {
    window.history.replaceState(null, '', `/prenota/?cz=${encodeURIComponent(value)}`);
    const element = widget('booking', { 'sync-url': 'true' });
    await loadLoader();

    expect(new URL(frameOf(element).src).pathname).toBe('/embed/booking');
    expect(frameOf(element).src).not.toContain('evil');
    expect(frameOf(element).src).not.toContain('script');
  });

  it('embedLoader_syncUrl_AStateIsOnlyRestoredWhenTheWidgetAsksForIt', async () => {
    window.history.replaceState(null, '', `/prenota/?cz=${encodeURIComponent('/property/casa-mare')}`);
    const element = widget('booking');
    await loadLoader();

    expect(new URL(frameOf(element).src).pathname).toBe('/embed/booking');
  });

  it.each([
    ['property', { property: 'casa-mare' }, '/booking', '/embed/property/casa-mare'],
    ['property', { property: 'casa-mare' }, '/property/other-home', '/embed/property/other-home'],
    ['guest-access', {}, '/booking', '/embed/guest-access'],
    ['guest-access', {}, '/guest-access', '/embed/guest-access'],
  ])('embedLoader_syncUrl_%s_RestoresOnlyItsOwnPages_%s', async (kind, attributes, restored, expected) => {
    window.history.replaceState(null, '', `/prenota/?cz=${encodeURIComponent(restored)}`);
    const element = widget(kind, { ...attributes, 'sync-url': 'true' });
    await loadLoader();

    expect(new URL(frameOf(element).src).pathname).toBe(expected);
  });
});

describe('the link that takes the place of a frame (AC7)', () => {
  const SITE = 'https://prenota.quokka360.com';

  it('embedLoader_Fallback_After8SecondsWithoutReady_ShowsTheLinkToTheSite', async () => {
    vi.useFakeTimers();
    const element = widget('booking');
    await loadLoader();

    vi.advanceTimersByTime(7999);
    expect(linkOf(element)).toBeNull();

    vi.advanceTimersByTime(1);
    const link = linkOf(element) as HTMLAnchorElement;
    expect(link.textContent).toBe('Prenota su prenota.quokka360.com');
    expect(link.href).toBe(`${SITE}/?lang=it&utm_source=agency-site&utm_medium=embed`);
    // The frame is still there, and now in sight: it may be slow, not dead.
    expect(frameOf(element).style.visibility).toBe('');
    expect(placeholderOf(element)).toBeNull();
  });

  it.each([
    ['booking', {}, 'Book on prenota.quokka360.com', '/'],
    ['property', { property: 'casa-mare' }, 'Book on prenota.quokka360.com', '/property/casa-mare'],
    ['guest-access', {}, 'Manage your booking on prenota.quokka360.com', '/my-bookings'],
  ])('embedLoader_Fallback_%s_InEnglish_Says_%s', async (kind, attributes, text, path) => {
    vi.useFakeTimers();
    const element = widget(kind, { ...attributes, lang: 'en' });
    await loadLoader();

    vi.advanceTimersByTime(8000);

    const link = linkOf(element) as HTMLAnchorElement;
    expect(link.textContent).toBe(text);
    expect(link.href).toBe(`${SITE}${path}?lang=en&utm_source=agency-site&utm_medium=embed`);
  });

  it.each([
    ['booking', {}, 'Prenota su prenota.quokka360.com', '/'],
    ['property', { property: 'casa-mare' }, 'Prenota su prenota.quokka360.com', '/property/casa-mare'],
    ['guest-access', {}, 'Gestisci la tua prenotazione su prenota.quokka360.com', '/my-bookings'],
  ])('embedLoader_Fallback_%s_InItalian_Says_%s', async (kind, attributes, text, path) => {
    vi.useFakeTimers();
    const element = widget(kind, attributes);
    await loadLoader();

    vi.advanceTimersByTime(8000);

    const link = linkOf(element) as HTMLAnchorElement;
    expect(link.textContent).toBe(text);
    expect(link.href).toBe(`${SITE}${path}?lang=it&utm_source=agency-site&utm_medium=embed`);
  });

  it.each([
    ['booking', {}, '/book/villa-rossi'],
    ['property', { property: 'casa-mare' }, '/book/villa-rossi/property/casa-mare'],
    ['guest-access', {}, '/book/villa-rossi/my-bookings'],
  ])('embedLoader_Fallback_%s_OnTheCasaZenDomain_GoesUnderBookAndTheOrg', async (kind, attributes, path) => {
    vi.useFakeTimers();
    const element = widget(kind, { ...attributes, base: 'https://app.casazen.example', org: 'villa-rossi' });
    await loadLoader();

    vi.advanceTimersByTime(8000);

    const link = linkOf(element) as HTMLAnchorElement;
    expect(link.href).toBe(`https://app.casazen.example${path}?lang=it&utm_source=agency-site&utm_medium=embed`);
    expect(link.textContent).toContain('app.casazen.example');
  });

  it('embedLoader_Fallback_CarriesTheStayOfThePageAndSaysWhereTheGuestCameFrom', async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/prenota?checkin=2026-12-01&checkout=2026-12-05&guests=3&utm_source=newsletter&utm_medium=email&utm_campaign=natale&code=SECRET');
    const element = widget('booking');
    await loadLoader();

    vi.advanceTimersByTime(8000);

    const query = new URL((linkOf(element) as HTMLAnchorElement).href).searchParams;
    expect(Object.fromEntries(query)).toEqual({
      checkin: '2026-12-01',
      checkout: '2026-12-05',
      guests: '3',
      utm_source: 'agency-site',
      utm_medium: 'embed',
      utm_campaign: 'natale',
      lang: 'it',
    });
  });

  it('embedLoader_Fallback_TheLinkGoesAwayWhenReadyArrivesLate', async () => {
    vi.useFakeTimers();
    const element = widget('booking');
    await loadLoader();
    vi.advanceTimersByTime(8000);
    expect(linkOf(element)).not.toBeNull();

    post(frameOf(element), buildEmbedMessage('ready', { widget: 'booking' }));

    expect(linkOf(element)).toBeNull();
    expect(element.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('embedLoader_Fallback_ReadyInTime_NeverShowsTheLink', async () => {
    vi.useFakeTimers();
    const element = widget('booking');
    await loadLoader();

    vi.advanceTimersByTime(3000);
    post(frameOf(element), buildEmbedMessage('ready', { widget: 'booking' }));
    vi.advanceTimersByTime(60000);

    expect(linkOf(element)).toBeNull();
  });

  it('embedLoader_Fallback_AnErrorOfTheFrame_ShowsTheLinkAtOnce', async () => {
    const element = widget('booking');
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('error', { code: 'not_found' }));

    expect(linkOf(element)?.textContent).toBe('Prenota su prenota.quokka360.com');
    expect(element.querySelectorAll('a')).toHaveLength(1);
  });

  it('embedLoader_Fallback_SeveralFailuresShowOneLink', async () => {
    vi.useFakeTimers();
    const element = widget('booking');
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('error', { code: 'disabled' }));
    post(frameOf(element), buildEmbedMessage('error', { code: 'load_failed' }));
    vi.advanceTimersByTime(8000);

    expect(element.querySelectorAll('a')).toHaveLength(1);
  });

  it('embedLoader_Fallback_AnErrorFromAnotherWindow_IsIgnored', async () => {
    const element = widget('booking');
    await loadLoader();

    post(frameOf(element), buildEmbedMessage('error', { code: 'not_found' }), BASE, window);
    post(frameOf(element), buildEmbedMessage('error', { code: 'not_found' }), 'https://evil.example');

    expect(linkOf(element)).toBeNull();
  });

  it('embedLoader_Fallback_AnInvalidBase_ShowsTheLinkAtOnceWithTheText', async () => {
    const element = widget('guest-access', { base: 'http://prenota.quokka360.com', lang: 'en' });
    await loadLoader();

    const link = linkOf(element) as HTMLAnchorElement;
    expect(link.textContent).toBe('Manage your booking on prenota.quokka360.com');
    expect(link.href).toBe(`${SITE}/my-bookings?lang=en&utm_source=agency-site&utm_medium=embed`);
  });

  it('embedLoader_Fallback_TheLinkIsALinkOfThePageNotAScript', async () => {
    const element = widget('booking', { base: 'javascript:alert(1)' });
    await loadLoader();

    const link = linkOf(element) as HTMLAnchorElement;
    expect(link.protocol).toBe('https:');
    expect(link.getAttribute('href')).not.toMatch(/^javascript:/i);
  });
});

describe('the search bar is loaded when a page has one (AC7)', () => {
  const searchTag = () => document.querySelector<HTMLScriptElement>('script[src]');

  it('embedLoader_Search_LoadsSearchJsFromTheFolderOfTheScriptOnceAndCallsTheRegisteredMount', async () => {
    const first = widget('search', {
      target: '/prenota/',
      destinations: '[{"id":"lugano","label":"Lugano"}]',
      'max-guests': '8',
      theme: '{"primary":"#0a7d5a"}',
      lang: 'en',
    });
    const second = widget('search');
    await loadLoader({ src: `${SCRIPT_URL}?ver=3`, nonce: 'abc123' });

    const tags = document.querySelectorAll('script[src]');
    expect(tags).toHaveLength(1);
    const tag = searchTag() as HTMLScriptElement;
    expect(tag.src).toBe(`${BASE}/embed/v1/search.js`);
    expect(tag.async).toBe(true);
    expect(tag.nonce).toBe('abc123');

    // The file runs: it registers its function with the loader, then the browser says it loaded.
    const mount = vi.fn();
    api().register('search', mount);
    tag.dispatchEvent(new Event('load'));

    expect(mount).toHaveBeenCalledTimes(2);
    expect(mount).toHaveBeenNthCalledWith(1, first, {
      lang: 'en',
      target: '/prenota/',
      destinations: '[{"id":"lugano","label":"Lugano"}]',
      theme: { primary: '#0a7d5a' },
      maxGuests: '8',
      base: BASE,
      org: '',
    });
    expect(mount).toHaveBeenNthCalledWith(2, second, { lang: 'it', target: null, destinations: null, theme: undefined, maxGuests: null, base: BASE, org: '' });
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('embedLoader_Search_AddedAfterTheFileLoaded_IsMountedAtOnceAndLoadsNothingMore', async () => {
    await loadLoader();
    const early = widget('search');
    await Promise.resolve();
    const mount = vi.fn();
    api().register('search', mount);
    searchTag()?.dispatchEvent(new Event('load'));
    expect(mount).toHaveBeenCalledTimes(1);

    const late = widget('search', { 'max-guests': '4' });
    await Promise.resolve();

    expect(early).toBeTruthy();
    expect(mount).toHaveBeenCalledTimes(2);
    expect(mount.mock.calls[1][0]).toBe(late);
    expect(document.querySelectorAll('script[src]')).toHaveLength(1);
  });

  it('embedLoader_Search_OnTheCasaZenDomain_PassesTheBaseAndTheOrg', async () => {
    widget('search', { base: 'https://app.casazen.example', org: 'villa-rossi' });
    await loadLoader();
    const mount = vi.fn();
    api().register('search', mount);

    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount.mock.calls[0][1]).toMatchObject({ base: 'https://app.casazen.example', org: 'villa-rossi' });
    // `search.js` is the one of the script, not of the base: the loader and the bar always travel together.
    expect((searchTag() as HTMLScriptElement).src).toBe(`${BASE}/embed/v1/search.js`);
  });

  it('embedLoader_Search_WhenTheFileFails_ShowsTheLinkInEveryBar', async () => {
    const first = widget('search');
    const second = widget('search', { lang: 'en' });
    await loadLoader();

    searchTag()?.dispatchEvent(new Event('error'));

    expect(linkOf(first)?.textContent).toBe('Prenota su prenota.quokka360.com');
    expect(linkOf(second)?.textContent).toBe('Book on prenota.quokka360.com');
    expect(linkOf(second)?.href).toBe(`${BASE}/?lang=en&utm_source=agency-site&utm_medium=embed`);
  });

  it('embedLoader_Search_WhenTheFileLoadsButNeverRegisters_ShowsTheLink', async () => {
    const element = widget('search');
    await loadLoader();

    searchTag()?.dispatchEvent(new Event('load'));

    expect(linkOf(element)).not.toBeNull();
  });

  it('embedLoader_Search_AfterAFailure_AnotherBarShowsTheLinkAndTheFileIsNotAskedAgain', async () => {
    await loadLoader();
    widget('search');
    await Promise.resolve();
    searchTag()?.dispatchEvent(new Event('error'));

    const later = widget('search');
    await Promise.resolve();

    expect(linkOf(later)).not.toBeNull();
    expect(document.querySelectorAll('script[src]')).toHaveLength(1);
  });

  it('embedLoader_Search_WhenTheMountThrows_ShowsTheLinkAndKeepsTheOthers', async () => {
    const broken = widget('search');
    const fine = widget('search');
    await loadLoader();
    const mount = vi.fn().mockImplementationOnce(() => {
      throw new Error('boom');
    });

    api().register('search', mount);

    expect(linkOf(broken)).not.toBeNull();
    expect(mount).toHaveBeenCalledTimes(2);
    expect(mount.mock.calls[1][0]).toBe(fine);
  });

  it('embedLoader_Search_WithAnInvalidBase_ShowsTheLinkAndLoadsNothing', async () => {
    const element = widget('search', { base: 'http://prenota.quokka360.com' });
    await loadLoader();

    expect(linkOf(element)).not.toBeNull();
    expect(document.querySelectorAll('script[src]')).toHaveLength(0);
  });

  it('embedLoader_Register_AWidgetOfAnotherName_IsMountedByScan', async () => {
    await loadLoader();
    const mount = vi.fn();
    api().register('stars', mount);
    const element = widget('stars');
    await Promise.resolve();

    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount.mock.calls[0][0]).toBe(element);
    expect(document.querySelectorAll('script[src]')).toHaveLength(0);
  });
});

describe('what the loader never touches', () => {
  it('embedLoader_FullFlow_TouchesNoStorageCookieOrNetwork', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const cookie = vi.spyOn(document, 'cookie', 'set');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const open = vi.fn();
    vi.stubGlobal('XMLHttpRequest', open);
    const beacon = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });
    vi.stubGlobal('location', { ...window.location, assign: vi.fn() });
    const element = widget('booking', { datalayer: 'true', 'sync-url': 'true' });
    await loadLoader();
    const frame = frameOf(element);

    post(frame, buildEmbedMessage('ready', { widget: 'booking' }));
    post(frame, buildEmbedMessage('resize', { height: 800 }));
    post(frame, buildEmbedMessage('event', { name: 'view_item', params: {} }));
    post(frame, buildEmbedMessage('url', { path: '/booking', query: 'guests=2' }));
    post(frame, buildEmbedMessage('navigate', { url: CHECKOUT, target: 'top' }));
    post(frame, buildEmbedMessage('error', { code: 'not_found' }));

    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(cookie).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, 'sendBeacon');
  });

  it('embedLoader_Style_IsWrittenThroughTheCssomNeverAsAnAttributeOrAStyleElement', async () => {
    const setAttribute = vi.spyOn(Element.prototype, 'setAttribute');
    const element = widget('booking');
    await loadLoader();

    expect(setAttribute.mock.calls.filter(([name]) => String(name).toLowerCase() === 'style')).toHaveLength(0);
    expect(document.querySelectorAll('style')).toHaveLength(0);
    expect(element.querySelectorAll('style')).toHaveLength(0);
  });
});
