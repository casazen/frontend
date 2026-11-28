import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { expect, vi, type Mock, type MockInstance } from 'vitest';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { buildEmbedMessage, type EmbedMessage, type EmbedMessageType } from '@/embed/protocol';
import { buildEmbedRoutes } from '@/routes/embed-routes';
import type { EmbedHostMode } from '../embed-context';

export const PARENT = 'https://quokka360.com';
export const FRAME_QUERY = `v=1&parent=${encodeURIComponent(PARENT)}`;

type QueryDefaults = NonNullable<DefaultOptions['queries']>;

export function newQueryClient(queries: QueryDefaults = {}): QueryClient {
  // No retry and no wait: a failed read is a failed read at once. `queries` is what else the app says of every query (its own client keeps an answer for five minutes).
  return new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 1, ...queries } } });
}

/** What the client of the app says of every query that does not say otherwise (`lib/query-client.ts`): an answer is kept for five minutes and never asked again on mount. */
export const APP_QUERY_DEFAULTS: QueryDefaults = { staleTime: 5 * 60 * 1000, refetchOnMount: false };

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

export interface FramingPage {
  window: { postMessage: Mock };
  posts: () => [EmbedMessage, string][];
  sent: (type?: EmbedMessageType) => EmbedMessage[];
  attach: () => Promise<void>;
  restore: () => void;
}

const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');

export function frameInsideAPage(): FramingPage {
  const parent = { postMessage: vi.fn() };
  Object.defineProperty(window, 'parent', { configurable: true, writable: true, value: parent });

  const posts = () => parent.postMessage.mock.calls as [EmbedMessage, string][];
  return {
    window: parent,
    posts,
    sent: (type) => posts().map(([message]) => message).filter((message) => type === undefined || message.type === type),
    attach: async () => {
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

export interface MemorySpies {
  calls: () => string[];
  restore: () => void;
}

export function spyOnTheBrowserMemory(): MemorySpies {
  const spies: [string, MockInstance][] = [
    ...(['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const).map((name): [string, MockInstance] => [`Storage.${name}`, vi.spyOn(Storage.prototype, name)]),
    ['Storage.length', vi.spyOn(Storage.prototype, 'length', 'get')],
    ['document.cookie (read)', vi.spyOn(Document.prototype, 'cookie', 'get')],
    ['document.cookie (write)', vi.spyOn(Document.prototype, 'cookie', 'set')],
  ];
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
