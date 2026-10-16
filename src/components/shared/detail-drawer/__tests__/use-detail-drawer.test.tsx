import { useEffect } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { settleDrawer } from '@/test/drawer';
import { DetailDrawerHost } from '../detail-drawer-host';
import { registerDetail } from '../detail-registry';
import { useDetailDrawer, type DetailDrawerApi } from '../use-detail-drawer';

/** What the page can reach, so that a test can call the hook the way a feature would, and keep what it was given. */
const handle: { drawer?: DetailDrawerApi } = {};
const drawer = () => handle.drawer as DetailDrawerApi;

function Page() {
  const api = useDetailDrawer();
  const location = useLocation();
  useEffect(() => {
    handle.drawer = api;
  });
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function Shell({ withHost }: { withHost: boolean }) {
  return (
    <>
      <Outlet />
      {withHost ? <DetailDrawerHost /> : null}
    </>
  );
}

/** The history is [`/app/prev`, `/app/page`…]: a call that goes Back once too often ends on `/app/prev`. */
function renderRouter({ withHost = true, page = '/app/page' }: { withHost?: boolean; page?: string } = {}) {
  const router = createMemoryRouter(
    [
      {
        element: <Shell withHost={withHost} />,
        children: [
          { path: '/app/prev', element: <p>prev</p> },
          { path: '/app/page', element: <Page /> },
        ],
      },
    ],
    { initialEntries: ['/app/prev', page], initialIndex: 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const where = () => screen.getByTestId('where').textContent;
const tick = (ms = 30) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

describe('useDetailDrawer (UI-15)', () => {
  const undo: Array<() => void> = [];

  beforeAll(() => {
    undo.push(registerDetail('probe-h', { title: 'detailDrawer.fallbackTitle', Content: () => <p>dentro</p> }));
  });

  afterAll(() => {
    while (undo.length > 0) undo.pop()?.();
  });

  beforeEach(async () => {
    await i18n.changeLanguage('it');
    handle.drawer = undefined;
  });

  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    await settleDrawer();
  });

  describe('a late or repeated call', () => {
    it('close_KeptThroughAnAwaitAndCalledAfterTheDrawerWasClosed_DoesNothing', async () => {
      const router = renderRouter();
      act(() => {
        drawer().open('probe-h', 'a1');
      });
      await screen.findByRole('dialog');
      // What a content keeps: `await save(); close();`
      const kept = drawer().close;
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await waitFor(() => expect(where()).toBe('/app/page'));
      await tick();

      act(() => kept());
      await tick();

      // Another Back would have left the page for `/app/prev`.
      expect(router.state.location.pathname).toBe('/app/page');
      expect(where()).toBe('/app/page');
    });

    it('close_ACloseFromASharedLinkKeptThroughAnAwait_DoesNotReplaceThePageTheUserWentToSince', async () => {
      const router = renderRouter({ page: '/app/page?detail=probe-h:a1' });
      await screen.findByRole('dialog');
      const kept = drawer().close;
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await waitFor(() => expect(where()).toBe('/app/page'));
      await tick();
      await act(async () => {
        await router.navigate('/app/page?q=other');
      });

      act(() => kept());
      await tick();

      expect(where()).toBe('/app/page?q=other');
    });

    it('close_TwiceBeforeTheAddressHasChanged_GoesBackOnce', async () => {
      renderRouter();
      act(() => {
        drawer().open('probe-h', 'a1');
      });
      await screen.findByRole('dialog');

      // Esc held down, a double tap: two presses reach the same `close` before the router has changed the address.
      act(() => {
        drawer().close();
        drawer().close();
      });

      await waitFor(() => expect(where()).toBe('/app/page'));
      await tick();
      expect(where()).toBe('/app/page');
    });

    it('open_TwiceBeforeTheAddressHasChanged_AddsOneEntryToTheHistory', async () => {
      const router = renderRouter();

      act(() => {
        drawer().open('probe-h', 'a1');
        drawer().open('probe-h', 'a1');
      });
      await screen.findByRole('dialog');
      await act(async () => {
        await router.navigate(-1);
      });

      // One Back closes it: a second entry for the same drawer would have left it open.
      await waitFor(() => expect(where()).toBe('/app/page'));
    });

    it('openAndClose_AreTheSameFunctionsAfterTheAddressChanges_SoAnEffectThatDependsOnThemDoesNotRunAgain', async () => {
      const router = renderRouter();
      const { open, close } = drawer();

      await act(async () => {
        await router.navigate('/app/page?q=1');
      });

      expect(drawer().open).toBe(open);
      expect(drawer().close).toBe(close);
    });
  });

  describe('what counts as a drawer that is open', () => {
    it('open_WhileTheAddressHasADrawerOfAKindNobodyRegistered_PushesAnEntryAndCloseGoesBackToIt', async () => {
      const router = renderRouter({ page: '/app/page?detail=ghost:1' });

      act(() => {
        drawer().open('probe-h', 'a1');
      });
      await screen.findByRole('dialog');
      expect(router.state.historyAction).toBe('PUSH');
      await act(async () => {
        await router.navigate(-1);
      });

      // Nothing was shown, so there was nothing to swap: Back closes the new drawer and lands on the address it was opened from.
      await waitFor(() => expect(where()).toBe('/app/page?detail=ghost:1'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('a page that has no host', () => {
    it('open_NoDetailDrawerHostOnThePage_SaysFalseAndAddsNothingToTheHistory', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const router = renderRouter({ withHost: false });

      let result: boolean | undefined;
      act(() => {
        result = drawer().open('probe-h', 'a1');
      });

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledOnce();
      expect(where()).toBe('/app/page');
      expect(router.state.historyAction).toBe('POP');
    });

    it('DetailDrawerHost_TwoHosts_SaysSoBecauseEveryDrawerWouldBeDrawnTwice', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const router = createMemoryRouter(
        [
          {
            element: (
              <>
                <DetailDrawerHost />
                <DetailDrawerHost />
              </>
            ),
            children: [{ path: '/', element: <p>page</p> }],
          },
        ],
        { initialEntries: ['/'] },
      );

      render(<RouterProvider router={router} />);

      expect(error).toHaveBeenCalledWith(expect.stringContaining('mounted more than once'));
    });
  });
});
