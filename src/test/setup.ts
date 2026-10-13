import '@testing-library/jest-dom';
import i18n from '@/i18n/config';

// Ensure i18n is initialized before any test renders.
// i18next.init() is idempotent — calling it again after module-level init is a no-op.
// Resources are statically imported in config.ts so this resolves synchronously.
beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.init();
  }
});

// jsdom has neither ResizeObserver (Radix checkboxes, dialogs and popovers measure themselves with it) nor matchMedia
// (media-query hooks, sonner). These inert stand-ins are installed once here, instead of a copy in each test file. A test
// that needs a real behaviour replaces them: `vi.stubGlobal('ResizeObserver', …)`, or assigning `window.matchMedia`.
// Plain properties, writable and configurable on purpose: `vi.stubGlobal` and `vi.unstubAllGlobals` must keep working.
// (The few tests that run in the `node` environment have no window and need neither.)
if (typeof window !== 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  if (typeof window.ResizeObserver === 'undefined') {
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, writable: true, value: ResizeObserverStub });
  }

  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      // No query ever matches: the code under test sees the layout without any media-query specific behaviour.
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
}
