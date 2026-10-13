import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router-dom';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { setHostSite } from '@/lib/host-site';
import { NOT_REDESIGNED_ROUTE_HANDLE, UI_VERSION_STORAGE_KEY } from '@/lib/ui-version';
import { UiVersionSync } from '../ui-version-sync';

const root = document.documentElement;
const dataUi = () => root.getAttribute('data-ui');

/** The shape of the app's routes that matters here: what is not redesigned yet (and its children) is marked. */
function makeRouter(initialPath: string) {
  return createMemoryRouter(
    [
      { path: '/login', element: <div /> },
      { path: '/app/*', element: <div /> },
      { path: '/checkin/:token', element: <div />, handle: NOT_REDESIGNED_ROUTE_HANDLE },
      {
        path: '/book/:orgSlug',
        element: <div />,
        handle: NOT_REDESIGNED_ROUTE_HANDLE,
        children: [
          { index: true, element: <div /> },
          { path: 'property/:propertyId', element: <div /> },
        ],
      },
      {
        element: <div />,
        handle: NOT_REDESIGNED_ROUTE_HANDLE,
        children: [
          { path: '/search', element: <div /> },
          { path: '/legale/privacy', element: <div /> },
        ],
      },
      { path: '/help/ical', element: <div /> },
    ],
    { initialEntries: [initialPath] },
  );
}

function withFlag(uiRedesign: boolean, router: ReturnType<typeof makeRouter>) {
  return (
    <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, uiRedesign }, isLoading: false }}>
      <UiVersionSync router={router} />
    </FeatureFlagsContext.Provider>
  );
}

afterEach(() => {
  root.removeAttribute('data-ui');
  localStorage.clear();
  vi.unstubAllEnvs();
  setHostSite(null);
});

describe('UiVersionSync (data-ui on <html>)', () => {
  it('UiVersionSync_FlagOffNoOverride_LeavesTheAppAsItWas', () => {
    render(withFlag(false, makeRouter('/app/short-rent')));
    expect(root.hasAttribute('data-ui')).toBe(false);
  });

  it('UiVersionSync_BackendFlagOn_SetsTheRedesign', () => {
    render(withFlag(true, makeRouter('/app/short-rent')));
    expect(dataUi()).toBe('v2');
  });

  it('UiVersionSync_QaOverrideInLocalStorage_SetsTheRedesignWithoutTheFlag', () => {
    localStorage.setItem(UI_VERSION_STORAGE_KEY, 'v2');
    render(withFlag(false, makeRouter('/app/short-rent')));
    expect(dataUi()).toBe('v2');
  });

  it('UiVersionSync_BuildFlag_SetsTheRedesignWithoutTheFlag', () => {
    vi.stubEnv('VITE_UI_V2', 'true');
    render(withFlag(false, makeRouter('/app/short-rent')));
    expect(dataUi()).toBe('v2');
  });

  it.each(['/login', '/app/short-rent', '/app/choose-context', '/help/ical', '/somewhere/not/in/the/table'])('UiVersionSync_%s_GetsTheRedesign', (path) => {
    render(withFlag(true, makeRouter(path)));
    expect(dataUi()).toBe('v2');
  });

  it.each(['/book/villa', '/book/villa/property/casa-mare', '/search', '/legale/privacy', '/checkin/abc'])('UiVersionSync_NotRedesigned_%s_NeverGetsIt', (path) => {
    // Not even with the flag on and the QA override set.
    localStorage.setItem(UI_VERSION_STORAGE_KEY, 'v2');
    render(withFlag(true, makeRouter(path)));
    expect(root.hasAttribute('data-ui')).toBe(false);
  });

  it('UiVersionSync_OrgOwnHost_NeverGetsTheRedesign', () => {
    setHostSite({ host: 'www.villa.example', slug: 'villa', displayName: 'Villa' });
    render(withFlag(true, makeRouter('/app/short-rent')));
    expect(root.hasAttribute('data-ui')).toBe(false);
  });

  it('UiVersionSync_NavigatingBetweenTheConsoleAndAPublicPage_FollowsTheRoute', async () => {
    const router = makeRouter('/app/short-rent');
    render(withFlag(true, router));
    expect(dataUi()).toBe('v2');

    await act(async () => {
      await router.navigate('/book/villa/property/casa-mare');
    });
    expect(root.hasAttribute('data-ui')).toBe(false);

    await act(async () => {
      await router.navigate('/login');
    });
    expect(dataUi()).toBe('v2');

    await act(async () => {
      await router.navigate('/search');
    });
    expect(root.hasAttribute('data-ui')).toBe(false);
  });

  it('UiVersionSync_FlagArrivingAfterTheFirstRender_TurnsTheRedesignOnAndOff', () => {
    const router = makeRouter('/app/short-rent');
    const { rerender } = render(withFlag(false, router));
    expect(root.hasAttribute('data-ui')).toBe(false);

    rerender(withFlag(true, router));
    expect(dataUi()).toBe('v2');

    rerender(withFlag(false, router));
    expect(root.hasAttribute('data-ui')).toBe(false);
  });

  it('UiVersionSync_Unmount_RemovesTheAttribute', () => {
    const { unmount } = render(withFlag(true, makeRouter('/app/short-rent')));
    expect(dataUi()).toBe('v2');
    unmount();
    expect(root.hasAttribute('data-ui')).toBe(false);
  });

  it('UiVersionSync_WithoutAFlagsProvider_IsOff', () => {
    // Outside FeatureFlagsProvider (tests, isolated renders) every flag is off.
    render(<UiVersionSync router={makeRouter('/app/short-rent')} />);
    expect(root.hasAttribute('data-ui')).toBe(false);
  });
});
