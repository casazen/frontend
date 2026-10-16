import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router-dom';
import { setHostSite } from '@/lib/host-site';
import { NOT_REDESIGNED_ROUTE_HANDLE } from '@/lib/ui-version';
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

// `index.html` writes the attribute before the app starts: the sync only takes it off where the app is not redesigned yet.
beforeEach(() => {
  root.setAttribute('data-ui', 'v2');
});

afterEach(() => {
  root.removeAttribute('data-ui');
  setHostSite(null);
});

describe('UiVersionSync (data-ui on <html>)', () => {
  it.each(['/login', '/app/short-rent', '/app/choose-context', '/help/ical', '/somewhere/not/in/the/table'])('UiVersionSync_%s_KeepsTheRedesign', (path) => {
    render(<UiVersionSync router={makeRouter(path)} />);
    expect(dataUi()).toBe('v2');
  });

  it.each(['/book/villa', '/book/villa/property/casa-mare', '/search', '/legale/privacy', '/checkin/abc'])('UiVersionSync_NotRedesigned_%s_TakesItOff', (path) => {
    render(<UiVersionSync router={makeRouter(path)} />);
    expect(root.hasAttribute('data-ui')).toBe(false);
  });

  it('UiVersionSync_OrgOwnHost_TakesItOff', () => {
    setHostSite({ host: 'www.villa.example', slug: 'villa', displayName: 'Villa' });
    render(<UiVersionSync router={makeRouter('/app/short-rent')} />);
    expect(root.hasAttribute('data-ui')).toBe(false);
  });

  it('UiVersionSync_NavigatingBetweenTheConsoleAndAPublicPage_FollowsTheRoute', async () => {
    const router = makeRouter('/app/short-rent');
    render(<UiVersionSync router={router} />);
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

  it('UiVersionSync_Unmount_PutsTheAttributeBack', () => {
    const { unmount } = render(<UiVersionSync router={makeRouter('/search')} />);
    expect(root.hasAttribute('data-ui')).toBe(false);
    unmount();
    expect(dataUi()).toBe('v2');
  });
});
