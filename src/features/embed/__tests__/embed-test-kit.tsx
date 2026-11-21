import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { expect, vi, type Mock, type MockInstance } from 'vitest';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { buildEmbedMessage, type EmbedMessage, type EmbedMessageType } from '@/embed/protocol';
import { buildEmbedRoutes } from '@/routes/embed-routes';
import type { EmbedHostMode } from '../embed-context';

/**
 * What the tests of the three widgets share (E41/F01/US02): the real routes of the widgets in a memory router with the flag on, a stand-in for the page that
 * frames them (the window the widget posts to, and the loader that answers), and the spy on everything a page could write to or read from the browser.
 */

/** The page that frames the widget, and what it names in the address of the frame. */
export const PARENT = 'https://quokka360.com';
/** The two parameters every address of a frame has when a loader made it: the version of the protocol and the origin of the page. */
export const FRAME_QUERY = `v=1&parent=${encodeURIComponent(PARENT)}`;

export function newQueryClient(): QueryClient {
  // No retry and no wait: a failed read is a failed read at once.
  return new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 1 } } });
}

/**
 * The routes of the widgets, as the app has them, with the widgets of the flag `siteEmbed` on (the shell asks the flag and the org before any widget).
 * `afterRouter` runs between the router and the first render: a spy on the browser's memory goes there, because the router itself reads one key of the session
 * storage when it is made (`remix-router-transitions`, in a `try`: a page whose storage is blocked works), as it does on every page of the app, and that is not the widget.
 */
export function renderWidgets(
  entry: string,
  { mode = 'platform', client = newQueryClient(), afterRouter }: { mode?: EmbedHostMode; client?: QueryClient; afterRouter?: () => void } = {},
) {
  const router = createMemoryRouter(buildEmbedRoutes(mode), { initialEntries: [entry] });
  afterRouter?.();
  render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, siteEmbed: true }, isLoading: false }}>
        <RouterProvider router={router} />
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
  return { router, client };
}

// --- the page that frames the widget -------------------------------------------------------------------------------------------------------

/** What a page that frames the widget has: a window to post to, and the way to tell it that the loader of the page answered. */
export interface FramingPage {
  /** `window.parent` of the frame: every message of the widget is posted here, with the origin it was addressed to. */
  window: { postMessage: Mock };
  /** Every message the widget posted to it, with the target origin. */
  posts: () => [EmbedMessage, string][];
  /** The messages of one type (all of them without one). */
  sent: (type?: EmbedMessageType) => EmbedMessage[];
  /** The loader answers with its `config` (once the shell of the frame has told the page `ready`, which is when it listens): the bridge is attached, and the widget takes over the clicks that leave the frame. */
  attach: () => Promise<void>;
  /** The page is no more: the window the test was in before. */
  restore: () => void;
}

const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');

/** This page is in a frame of `PARENT`. Call `restore` (or `vi.unstubAllGlobals` and the like do not reach it) in `afterEach`. */
export function frameInsideAPage(): FramingPage {
  const parent = { postMessage: vi.fn() };
  Object.defineProperty(window, 'parent', { configurable: true, writable: true, value: parent });

  const posts = () => parent.postMessage.mock.calls as [EmbedMessage, string][];
  return {
    window: parent,
    posts,
    sent: (type) => posts().map(([message]) => message).filter((message) => type === undefined || message.type === type),
    attach: async () => {
      // The shell listens for the answer of the loader from the moment it tells the page `ready` (the same pass of its effects): not before.
      await waitFor(() => expect(posts().some(([message]) => message.type === 'ready')).toBe(true));
      const event = new MessageEvent('message', { data: buildEmbedMessage('config', {}) });
      Object.defineProperty(event, 'source', { value: parent });
      Object.defineProperty(event, 'origin', { value: PARENT });
      act(() => {
        window.dispatchEvent(event);
      });
    },
    restore: () => {
      if (originalParent) Object.defineProperty(window, 'parent', originalParent);
    },
  };
}

// --- the browser's memory ---------------------------------------------------------------------------------------------------------------------

export interface MemorySpies {
  /** Every call of the storage of the browser, of the cookie and of IndexedDB, with the name of what was called. */
  calls: () => string[];
  restore: () => void;
}

/** A spy on everything a page can use to keep something in the browser (or to read what an earlier page kept). They let the calls through: any call at all is the failure. */
export function spyOnTheBrowserMemory(): MemorySpies {
  const spies: [string, MockInstance][] = [
    ...(['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const).map((name): [string, MockInstance] => [`Storage.${name}`, vi.spyOn(Storage.prototype, name)]),
    ['Storage.length', vi.spyOn(Storage.prototype, 'length', 'get')],
    ['document.cookie (read)', vi.spyOn(Document.prototype, 'cookie', 'get')],
    ['document.cookie (write)', vi.spyOn(Document.prototype, 'cookie', 'set')],
  ];
  // jsdom has no IndexedDB: a stand-in that only counts.
  const open = vi.fn();
  Object.defineProperty(window, 'indexedDB', { configurable: true, writable: true, value: { open } });
  spies.push(['indexedDB.open', open as unknown as MockInstance]);

  return {
    calls: () => spies.filter(([, spy]) => spy.mock.calls.length > 0).map(([name, spy]) => `${name} x${spy.mock.calls.length}`),
    restore: () => {
      for (const [, spy] of spies) if ('mockRestore' in spy) spy.mockRestore();
      Reflect.deleteProperty(window, 'indexedDB');
    },
  };
}
