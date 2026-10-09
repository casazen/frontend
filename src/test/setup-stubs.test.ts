import { afterEach, describe, expect, it, vi } from 'vitest';

// The browser APIs that jsdom lacks and that setup.ts stands in for, once for all the test files (UI-00).
describe('shared jsdom stubs of src/test/setup.ts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ResizeObserver_Used_AcceptsEveryCallAndDoesNothing', () => {
    const observer = new ResizeObserver(() => undefined);

    expect(() => {
      observer.observe(document.body);
      observer.unobserve(document.body);
      observer.disconnect();
    }).not.toThrow();
  });

  it('matchMedia_AnyQuery_ReturnsAMediaQueryListThatNeverMatches', () => {
    const list = window.matchMedia('(min-width: 768px)');
    const onChange = () => undefined;

    expect(list.matches).toBe(false);
    expect(list.media).toBe('(min-width: 768px)');
    expect(() => {
      list.addEventListener('change', onChange);
      list.removeEventListener('change', onChange);
    }).not.toThrow();
  });

  it('ResizeObserver_ReplacedByATest_IsTheTestsOwnUntilItIsRestored', () => {
    const shared = window.ResizeObserver;
    class OwnObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', OwnObserver);
    expect(window.ResizeObserver).toBe(OwnObserver);

    vi.unstubAllGlobals();
    expect(window.ResizeObserver).toBe(shared);
  });

  it('matchMedia_ReplacedByATest_IsTheTestsOwn', () => {
    const shared = window.matchMedia;
    const own = vi.fn().mockReturnValue({ matches: true, media: '(min-width: 1px)' });

    window.matchMedia = own;
    try {
      expect(window.matchMedia('(min-width: 1px)').matches).toBe(true);
      expect(own).toHaveBeenCalledWith('(min-width: 1px)');
    } finally {
      window.matchMedia = shared;
    }
  });
});
