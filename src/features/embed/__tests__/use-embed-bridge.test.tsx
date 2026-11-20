import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { buildEmbedMessage, parseEmbedMessage, type EmbedMessage, type EmbedMessageType } from '@/embed/protocol';
import { buildEmbedRoutes } from '@/routes/embed-routes';
import type { PublicOrgDto } from '@/types';
import { embedWidgetHandle, useEmbed } from '../embed-context';
import { EmbedShell } from '../embed-shell';
import { useEmbedBridge, type EmbedBridge } from '../use-embed-bridge';

/**
 * The bridge between the frame and the page of the agency's website (E41/F01/US01/T02, NF-145). What costs something when it is wrong is the
 * security of the conversation: a message goes only to the origin the address named and a message is believed only from the window that frames
 * the page and from that origin. A listener on the page that frames the widget, and every script on it, reads what is sent.
 */
vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getPublicOrg: vi.fn() } }));

const PARENT = 'https://quokka360.com';
const ADDRESS = `v=1&parent=${encodeURIComponent(PARENT)}`;
const CHECKOUT = 'https://app.example.test/book/villa-rossi/property/casa-mare/checkout?checkin=2026-12-01&checkout=2026-12-05&guests=2';

// No color of its own: what the page asks for is what shows.
const ORG: PublicOrgDto = { slug: 'villa-rossi', displayName: 'Villa Rossi', logoUrl: null, themeColor: null, contactEmail: null, publicThemeId: 'mare' };
const getPublicOrg = vi.mocked(publicOrgApi.getPublicOrg);

function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, { status, statusText: '', headers: {}, config, data: {} });
}

// --- the window that frames the page, the animation frames and the size of the wrapper ---------------------------------------------------

const parentWindow = { postMessage: vi.fn() };
const otherWindow = { postMessage: vi.fn() };
const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');

/** This page is in a frame of `parent`. */
function frameInside(parent: unknown) {
  Object.defineProperty(window, 'parent', { configurable: true, writable: true, value: parent });
}

let frames: (FrameRequestCallback | null)[] = [];
const flushFrame = () => {
  const pending = frames;
  frames = [];
  act(() => {
    for (const callback of pending) callback?.(0);
  });
};

class ResizeObserverStub {
  static all: ResizeObserverStub[] = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.all.push(this);
  }
}
/** The browser tells the observers that the size changed. */
const resized = () =>
  act(() => {
    for (const observer of ResizeObserverStub.all) observer.callback([], observer as unknown as ResizeObserver);
  });

let wrapperHeight = 400.4;

beforeEach(async () => {
  getPublicOrg.mockReset();
  getPublicOrg.mockResolvedValue(ORG);
  parentWindow.postMessage.mockReset();
  otherWindow.postMessage.mockReset();
  frames = [];
  ResizeObserverStub.all = [];
  wrapperHeight = 400.4;
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames[id - 1] = null;
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return { height: this.getAttribute('data-testid') === 'embed-shell' ? wrapperHeight : 0 } as DOMRect;
  });
  frameInside(parentWindow);
  await i18n.changeLanguage('it');
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalParent) Object.defineProperty(window, 'parent', originalParent);
  await i18n.changeLanguage('it');
  document.documentElement.lang = 'it';
});

// --- what the widget sees, what the frame sent, what the page sends back ------------------------------------------------------------------

const seen = vi.fn<(bridge: EmbedBridge) => void>();

/** A widget that reads the bridge. */
function BridgeProbe() {
  const bridge = useEmbedBridge();
  const embed = useEmbed();
  useEffect(() => {
    seen(bridge);
  }, [bridge]);
  return (
    <p data-testid="bridge" data-widget={embed?.widget}>
      {`${bridge.active ? 'active' : 'inactive'}-${bridge.attached ? 'attached' : 'detached'}`}
    </p>
  );
}

const bridgeNow = () => seen.mock.lastCall?.[0] as EmbedBridge;

/** Everything the frame posted to `window.parent`, and where to. */
const posts = () => parentWindow.postMessage.mock.calls as [EmbedMessage, string][];
const sent = (type?: EmbedMessageType) => posts().map(([message]) => message).filter((message) => type === undefined || message.type === type);

function renderFramed(entry: string, { siteEmbed = true, routes }: { siteEmbed?: boolean; routes?: RouteObject[] } = {}) {
  seen.mockReset();
  // One layout for the two widgets, as the routes of the app have it: the shell stays mounted when the guest moves from one to the other.
  const router = createMemoryRouter(
    routes ?? [
      {
        element: <EmbedShell mode="platform" />,
        children: [
          { path: '/embed/:orgSlug/booking', handle: embedWidgetHandle('booking'), element: <BridgeProbe /> },
          { path: '/embed/:orgSlug/property/:propertySlugOrId', handle: embedWidgetHandle('property'), element: <BridgeProbe /> },
        ],
      },
    ],
    { initialEntries: [entry] },
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, siteEmbed }, isLoading: false }}>
        <RouterProvider router={router} />
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
  return router;
}

/** A message that reaches the frame from the window `source`, written as `origin`. */
function arrives(data: unknown, { source, origin = PARENT }: { source: unknown; origin?: string }) {
  const event = new MessageEvent('message', { data });
  Object.defineProperty(event, 'source', { value: source });
  Object.defineProperty(event, 'origin', { value: origin });
  act(() => {
    window.dispatchEvent(event);
  });
}

/** The page answers as the loader does. */
const pageSays = (data: unknown) => arrives(data, { source: parentWindow });

const wrapper = () => screen.getByTestId('embed-shell');

describe('what the frame says to the page: ready, error, resize, url', () => {
  it('embedBridge_ready_IsPostedOnceWhenTheShellLeavesLoading_ToTheOriginOfTheParent', async () => {
    let answer: (org: PublicOrgDto) => void = () => undefined;
    getPublicOrg.mockReturnValue(new Promise<PublicOrgDto>((resolveOrg) => (answer = resolveOrg)));
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('embed-shell');

    // Still loading: the page is told nothing yet.
    expect(sent('ready')).toEqual([]);
    expect(sent('error')).toEqual([]);

    await act(async () => answer(ORG));
    await screen.findByTestId('bridge');

    expect(sent('ready')).toEqual([{ source: 'casazen', v: 1, type: 'ready', widget: 'booking' }]);
    expect(posts().find(([message]) => message.type === 'ready')?.[1]).toBe(PARENT);

    // Another render, a configuration, a resize: still one.
    pageSays(buildEmbedMessage('config', { lang: 'en' }));
    wrapperHeight = 800;
    resized();
    flushFrame();
    expect(sent('ready')).toHaveLength(1);
  });

  it.each([
    ['the feature off', '/embed/villa-rossi/booking?' + ADDRESS, { siteEmbed: false }, 'disabled'],
    ['a version this app does not speak', `/embed/villa-rossi/booking?v=2&parent=${encodeURIComponent(PARENT)}`, {}, 'bad_version'],
  ])('embedBridge_error_%s_IsPostedAndNotReady', async (_label, entry, options, code) => {
    renderFramed(entry, options);

    await waitFor(() => expect(sent('error')).toEqual([{ source: 'casazen', v: 1, type: 'error', code }]));
    expect(sent('ready')).toEqual([]);
    expect(getPublicOrg).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'not_found'],
    [500, 'load_failed'],
  ])('embedBridge_error_OrgAnswers%i_Posts_%s', async (status, code) => {
    getPublicOrg.mockRejectedValue(httpError(status));
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);

    await waitFor(() => expect(sent('error')).toEqual([{ source: 'casazen', v: 1, type: 'error', code }]));
    expect(sent('ready')).toEqual([]);
  });

  it('embedBridge_error_AnAddressThatIsNoWidget_PostsNotFoundAndNotReady', async () => {
    // The catch-all of `/embed` (a widget with a wrong path): the page is told, so that it shows its own fallback; nothing is asked of the server.
    renderFramed(`/embed/villa-rossi/booking/extra?${ADDRESS}`, { routes: buildEmbedRoutes('platform') });

    await waitFor(() => expect(sent('error')).toEqual([{ source: 'casazen', v: 1, type: 'error', code: 'not_found' }]));
    expect(sent('ready')).toEqual([]);
    expect(getPublicOrg).not.toHaveBeenCalled();
  });

  it('embedBridge_resize_FollowsTheWrapperWhenItGrowsAndWhenItShrinks', async () => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');
    flushFrame();

    // The height of the wrapper, rounded up.
    expect(sent('resize')).toEqual([{ source: 'casazen', v: 1, type: 'resize', height: 401 }]);

    wrapperHeight = 520.2;
    resized();
    flushFrame();
    expect(sent('resize').map((message) => (message as EmbedMessage<'resize'>).height)).toEqual([401, 521]);

    // A page that gets shorter must get a shorter frame.
    wrapperHeight = 300.2;
    resized();
    flushFrame();
    expect(sent('resize').map((message) => (message as EmbedMessage<'resize'>).height)).toEqual([401, 521, 301]);
  });

  it('embedBridge_resize_AtMostOncePerFrameAndOnlyWhenItChangedByAPixel', async () => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');
    flushFrame();
    const before = sent('resize').length;

    // Three changes before the next frame: one message, with the last height.
    for (const height of [410, 420, 430]) {
      wrapperHeight = height;
      resized();
    }
    flushFrame();
    expect(sent('resize').slice(before)).toEqual([{ source: 'casazen', v: 1, type: 'resize', height: 430 }]);

    // A change that rounds to the same pixel says nothing.
    for (const height of [429.1, 429.9, 430]) {
      wrapperHeight = height;
      resized();
      flushFrame();
    }
    expect(sent('resize')).toHaveLength(before + 1);

    wrapperHeight = 431;
    resized();
    flushFrame();
    expect(sent('resize')).toHaveLength(before + 2);
  });

  it('embedBridge_resize_NeverReadsTheScrollHeightOfTheDocument', async () => {
    // `scrollHeight` of the document cannot go below the height the frame already has: the frame would never shrink.
    let reads = 0;
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => {
        reads += 1;
        return 9999;
      },
    });
    try {
      renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
      await screen.findByTestId('bridge');
      flushFrame();

      expect(reads).toBe(0);
      expect(sent('resize').map((message) => (message as EmbedMessage<'resize'>).height)).toEqual([401]);
    } finally {
      Reflect.deleteProperty(document.documentElement, 'scrollHeight');
    }
  });

  it('embedBridge_resize_TheSourceOfTheShellAndOfTheBridgeNeverUseTheScrollHeightOrTheHeightOfTheWindow', () => {
    for (const file of ['embed-shell.tsx', 'use-embed-bridge.ts']) {
      const code = readFileSync(resolve(process.cwd(), 'src/features/embed', file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/scrollHeight|innerHeight|clientHeight|\b100d?vh\b|min-h-screen/);
    }
  });

  it('embedBridge_resize_StopsObservingWhenTheShellGoes', async () => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');
    const observers = [...ResizeObserverStub.all];

    cleanup();

    expect(observers.length).toBeGreaterThan(0);
    for (const observer of observers) expect(observer.disconnect).toHaveBeenCalled();
  });

  it('embedBridge_url_IsPostedAtEveryChangeOfAddress_WithThePathRelativeToTheBaseAndNothingOfTheFrame', async () => {
    const router = renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');
    // The first address is not a change.
    expect(sent('url')).toEqual([]);

    await act(async () => {
      await router.navigate(
        `/embed/villa-rossi/property/casa-mare?checkin=2026-12-01&guests=2&lang=en&parent=${encodeURIComponent(PARENT)}&v=1&code=ABCDE-FGHIJ&token=gs1.secret&email=guest%40example.com`,
      );
    });

    // `parent`, `v` and `lang` are the frame's own; a code, a token and an address of e-mail are never sent to a page.
    expect(sent('url')).toEqual([{ source: 'casazen', v: 1, type: 'url', path: '/property/casa-mare', query: 'checkin=2026-12-01&guests=2' }]);

    await act(async () => {
      await router.navigate(`/embed/villa-rossi/property/casa-mare?checkin=2026-12-02&${ADDRESS}`);
    });
    expect(sent('url')).toHaveLength(2);
    expect((sent('url')[1] as EmbedMessage<'url'>).query).toBe('checkin=2026-12-02');
  });
});

describe('moving from one widget to another inside the frame', () => {
  it('embedBridge_MovingFromBookingToProperty_KeepsTheConversation_OneReadyAnUrlAndTheBridgeStaysAttached', async () => {
    const router = renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');
    pageSays(buildEmbedMessage('config', {}));
    expect(screen.getByTestId('bridge')).toHaveAttribute('data-widget', 'booking');
    expect(sent('ready')).toHaveLength(1);

    await act(async () => {
      await router.navigate(`/embed/villa-rossi/property/casa-mare?from=booking&checkin=2026-12-01&${ADDRESS}`);
    });

    // The cards of the booking widget lead to the property widget in the same frame: the page hears the new address, and nothing starts again.
    expect(screen.getByTestId('bridge')).toHaveAttribute('data-widget', 'property');
    expect(screen.getByTestId('bridge')).toHaveTextContent('active-attached');
    expect(sent('ready')).toEqual([{ source: 'casazen', v: 1, type: 'ready', widget: 'booking' }]);
    expect(sent('url')).toEqual([{ source: 'casazen', v: 1, type: 'url', path: '/property/casa-mare', query: 'from=booking&checkin=2026-12-01' }]);
  });
});

describe('the frame talks only to the origin the address named (the proof of security)', () => {
  it('embedBridge_neverPostsToAnyOrigin', async () => {
    const router = renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');
    flushFrame();
    act(() => {
      bridgeNow().send.event('view_item_list', { item_list_id: 'search_results', items: [] });
      bridgeNow().send.navigate(CHECKOUT, 'top');
      bridgeNow().send.error('load_failed');
    });
    await act(async () => {
      await router.navigate(`/embed/villa-rossi/property/casa-mare?${ADDRESS}`);
    });

    const calls = posts();
    expect(new Set(calls.map(([message]) => message.type))).toEqual(new Set(['ready', 'resize', 'event', 'navigate', 'error', 'url']));
    for (const [, targetOrigin] of calls) {
      expect(targetOrigin).toBe(PARENT);
      expect(targetOrigin).not.toBe('*');
    }
    // Nobody else was written to, and the page itself was not used as a mailbox.
    expect(otherWindow.postMessage).not.toHaveBeenCalled();
  });

  it('embedBridge_NothingPersonalOrSecret_TravelsInAnyMessageOfTheShell', async () => {
    const router = renderFramed(`/embed/villa-rossi/booking?${ADDRESS}&code=ABCDE-FGHIJ&token=gs1.secret`);
    await screen.findByTestId('bridge');
    flushFrame();
    await act(async () => {
      await router.navigate(`/embed/villa-rossi/property/casa-mare?checkin=2026-12-01&${ADDRESS}&code=ABCDE-FGHIJ&token=gs1.secret&phone=333`);
    });

    const text = JSON.stringify(posts());
    for (const secret of ['ABCDE-FGHIJ', 'gs1.secret', 'phone', 'token', 'code=']) expect(text).not.toContain(secret);
  });

  it('embedBridge_ParentThatIsNotAnOrigin_IsInactive_NothingIsSent', async () => {
    renderFramed(`/embed/villa-rossi/booking?v=1&parent=${encodeURIComponent('https://quokka360.com/prenota/')}`);
    await screen.findByTestId('bridge');
    flushFrame();

    expect(bridgeNow().active).toBe(false);
    expect(screen.getByTestId('bridge')).toHaveTextContent('inactive-detached');
    expect(parentWindow.postMessage).not.toHaveBeenCalled();
  });

  it('embedBridge_NoParent_IsInactive_AndTheWidgetStillRenders', async () => {
    renderFramed('/embed/villa-rossi/booking?v=1');

    expect(await screen.findByTestId('bridge')).toHaveTextContent('inactive-detached');
    expect(parentWindow.postMessage).not.toHaveBeenCalled();
    expect(ResizeObserverStub.all).toHaveLength(0);
  });

  it('embedBridge_PageNotInAFrame_IsInactive_EvenWithAValidParent', async () => {
    // Opened on its own: `window.parent` is the window itself.
    frameInside(window);
    const postToSelf = vi.spyOn(window, 'postMessage');
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);

    expect(await screen.findByTestId('bridge')).toHaveTextContent('inactive-detached');
    flushFrame();
    expect(postToSelf).not.toHaveBeenCalled();
    expect(bridgeNow().send.event).toBeTypeOf('function');
    act(() => bridgeNow().send.navigate(CHECKOUT, 'top'));
    expect(postToSelf).not.toHaveBeenCalled();
  });

  it('embedBridge_Inactive_BelievesNoConfig', async () => {
    renderFramed('/embed/villa-rossi/booking?v=1');
    await screen.findByTestId('bridge');

    pageSays(buildEmbedMessage('config', { theme: { primary: '#0a7d5a' }, lang: 'en' }));

    expect(screen.getByTestId('bridge')).toHaveTextContent('inactive-detached');
    expect(wrapper().style.getPropertyValue('--cz-public-primary')).toBe('');
    expect(i18n.language).toBe('it');
  });
});

describe('what the page says to the frame: config (AC3)', () => {
  it('embedBridge_attached_OnlyAfterAValidConfigFromTheParent', async () => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    expect(await screen.findByTestId('bridge')).toHaveTextContent('active-detached');

    pageSays(buildEmbedMessage('config', {}));

    expect(screen.getByTestId('bridge')).toHaveTextContent('active-attached');
    expect(bridgeNow().attached).toBe(true);
  });

  it.each([
    ['from another window', { source: otherWindow }, buildEmbedMessage('config', { lang: 'en' })],
    ['from no window', { source: null }, buildEmbedMessage('config', { lang: 'en' })],
    ['from the parent with another origin', { source: parentWindow, origin: 'https://evil.example' }, buildEmbedMessage('config', { lang: 'en' })],
    ['from the parent with the origin of a sub-domain', { source: parentWindow, origin: 'https://www.quokka360.com' }, buildEmbedMessage('config', { lang: 'en' })],
    ['from the parent with the same host over http', { source: parentWindow, origin: 'http://quokka360.com' }, buildEmbedMessage('config', { lang: 'en' })],
    ['in a wrong shape (a theme that is text)', { source: parentWindow }, { source: 'casazen', v: 1, type: 'config', theme: 'red' }],
    ['with a wrong source', { source: parentWindow }, { source: 'other', v: 1, type: 'config' }],
    ['with a wrong version', { source: parentWindow }, { source: 'casazen', v: 2, type: 'config' }],
    ['that is not an object', { source: parentWindow }, 'config'],
    ['of another type: a message to the frame is `config` and nothing else', { source: parentWindow }, buildEmbedMessage('resize', { height: 10 })],
    ['of another type: even the ones the frame itself sends', { source: parentWindow }, buildEmbedMessage('navigate', { url: CHECKOUT, target: 'top' })],
  ])('embedBridge_config_ignoresOtherWindowsAndOrigins_%s', async (_label, where, data) => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');

    arrives(data, where);

    // Nothing is believed: not attached, no color, no radius, no font, the language stays.
    expect(screen.getByTestId('bridge')).toHaveTextContent('active-detached');
    expect(bridgeNow().attached).toBe(false);
    expect(wrapper().style.getPropertyValue('--cz-public-primary')).toBe('');
    expect(i18n.language).toBe('it');
    expect(document.documentElement.lang).toBe('it');
  });

  it('embedBridge_config_ignoresAThemeFromAnotherWindow_EvenWithValidValues', async () => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');

    arrives(buildEmbedMessage('config', { theme: { primary: '#0a7d5a', radius: '12px', font: 'classico' }, lang: 'en' }), { source: otherWindow });
    arrives(buildEmbedMessage('config', { theme: { primary: '#0a7d5a', radius: '12px', font: 'classico' }, lang: 'en' }), { source: parentWindow, origin: 'https://evil.example' });

    expect(wrapper().style.getPropertyValue('--cz-public-primary')).toBe('');
    expect(wrapper().style.getPropertyValue('--cz-public-radius')).toBe('');
    expect(wrapper()).not.toHaveAttribute('data-font', 'classico');
    expect(i18n.language).toBe('it');
  });

  it('embedBridge_config_AValidThemeAndLanguage_AreApplied', async () => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');

    pageSays(buildEmbedMessage('config', { theme: { primary: '#0A7D5A', radius: '12px', font: 'Classico' }, lang: 'en-GB' }));

    const style = wrapper().style;
    // The color, with the colors derived from it so that the text on it stays readable; the radius for cards and buttons; the font pair of the site.
    expect(style.getPropertyValue('--cz-public-primary')).toBe('#0a7d5a');
    expect(style.getPropertyValue('--cz-public-on-primary')).not.toBe('');
    expect(style.getPropertyValue('--cz-public-radius')).toBe('12px');
    expect(style.getPropertyValue('--cz-public-btn-radius')).toBe('12px');
    expect(wrapper()).toHaveAttribute('data-font', 'classico');
    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(document.documentElement.lang).toBe('en');
    // The org's own theme stays: the page asks for a look, not for another site.
    expect(wrapper()).toHaveAttribute('data-theme', 'mare');
  });

  it('embedBridge_config_InvalidMembers_AreIgnoredEachOnItsOwn', async () => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');
    const fontBefore = wrapper().getAttribute('data-font');

    // A color that is not hex, a radius of 99 px, a font nobody knows, a language that is neither: nothing changes, and the message still attaches the bridge.
    pageSays(buildEmbedMessage('config', { theme: { primary: 'red', radius: '99px', font: 'comic-sans' }, lang: 'de' }));

    expect(screen.getByTestId('bridge')).toHaveTextContent('active-attached');
    expect(wrapper().style.getPropertyValue('--cz-public-primary')).toBe('');
    expect(wrapper().style.getPropertyValue('--cz-public-radius')).toBe('');
    expect(wrapper().style.getPropertyValue('--cz-public-btn-radius')).toBe('');
    expect(wrapper().getAttribute('data-font')).toBe(fontBefore);
    expect(i18n.language).toBe('it');

    // One bad value does not take the good ones with it.
    pageSays(buildEmbedMessage('config', { theme: { primary: 'javascript:alert(1)', radius: '8px', font: 'moderno' } }));
    expect(wrapper().style.getPropertyValue('--cz-public-primary')).toBe('');
    expect(wrapper().style.getPropertyValue('--cz-public-radius')).toBe('8px');
    expect(wrapper()).toHaveAttribute('data-font', 'moderno');
  });

  it.each([
    ['0px', '0px'],
    ['32px', '32px'],
    ['0.5rem', '0.5rem'],
    ['2rem', '2rem'],
    ['33px', ''],
    ['99px', ''],
    ['2.1rem', ''],
    ['-1px', ''],
    ['12', ''],
    ['12em', ''],
    ['calc(1px + 1px)', ''],
    ['12px; background:red', ''],
    ['', ''],
  ])('embedBridge_config_Radius_%s_Gives_%s', async (radius, expected) => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');

    pageSays(buildEmbedMessage('config', { theme: { radius } }));

    expect(wrapper().style.getPropertyValue('--cz-public-radius')).toBe(expected);
  });

  it('embedBridge_config_ALaterConfig_ChangesWhatItSaysAndKeepsTheRest', async () => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');

    pageSays(buildEmbedMessage('config', { theme: { primary: '#0a7d5a', radius: '12px' } }));
    pageSays(buildEmbedMessage('config', { theme: { radius: '4px' } }));

    expect(wrapper().style.getPropertyValue('--cz-public-primary')).toBe('#0a7d5a');
    expect(wrapper().style.getPropertyValue('--cz-public-radius')).toBe('4px');
  });
});

describe('what a widget can send (AC2)', () => {
  it('embedBridge_send_EventAndNavigate_ArePostedAsTheProtocolWritesThem', async () => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');
    const params = { currency: 'CHF', value: 1200, items: [{ item_id: 'p1', item_name: 'Casa Mare', price: 1200, quantity: 1 }] };

    act(() => {
      bridgeNow().send.event('begin_checkout', params);
      bridgeNow().send.navigate(CHECKOUT, 'top');
    });

    expect(sent('event')).toEqual([{ source: 'casazen', v: 1, type: 'event', name: 'begin_checkout', params }]);
    expect(sent('navigate')).toEqual([{ source: 'casazen', v: 1, type: 'navigate', url: CHECKOUT, target: 'top' }]);
    for (const message of sent()) expect(parseEmbedMessage(message)).toEqual(message);
  });

  it.each([
    ['a relative address', () => bridgeNow().send.navigate('/property/casa-mare/checkout', 'top')],
    ['a script address', () => bridgeNow().send.navigate('javascript:alert(1)', 'top')],
    ['parameters over 4 KB', () => bridgeNow().send.event('view_item', { note: 'x'.repeat(5000) })],
    ['parameters that are not plain JSON', () => bridgeNow().send.event('view_item', { at: new Date(0) })],
  ])('embedBridge_send_%s_IsNotPosted', async (_label, send) => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');
    const before = sent().length;

    act(send);

    expect(sent()).toHaveLength(before);
  });

  it('embedBridge_send_ErrorFromAWidget_IsPosted', async () => {
    renderFramed(`/embed/villa-rossi/booking?${ADDRESS}`);
    await screen.findByTestId('bridge');

    act(() => bridgeNow().send.error('not_found'));

    expect(sent('error')).toEqual([{ source: 'casazen', v: 1, type: 'error', code: 'not_found' }]);
  });

  it('useEmbedBridge_OutsideTheShell_IsInactiveAndSendsNothing', () => {
    function Outside() {
      const bridge = useEmbedBridge();
      return <p data-testid="outside">{`${bridge.active}-${bridge.attached}`}</p>;
    }
    render(<Outside />);

    expect(screen.getByTestId('outside')).toHaveTextContent('false-false');
    expect(parentWindow.postMessage).not.toHaveBeenCalled();
  });
});
