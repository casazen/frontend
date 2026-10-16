import { lazy, useEffect } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { stubViewportWidth } from '@/test/viewport';
import { DetailDrawerHost } from '../detail-drawer-host';
import { takeOpener } from '../detail-opener';
import { registerDetail, type DetailContentProps, type DetailTitleProps } from '../detail-registry';
import { useDetailDrawer, type DetailDrawerApi } from '../use-detail-drawer';

/** What the test pages can reach, so that a test can call the hook the way a feature would. */
const handle: { drawer?: DetailDrawerApi } = {};
let failing = false;

function ProbeTitle({ id }: DetailTitleProps) {
  return <>Prenotazione {id}</>;
}

function ProbeContent({ id, close }: DetailContentProps) {
  const drawer = useDetailDrawer();
  const query = useQuery({ queryKey: ['probe', id], queryFn: async () => ({ guest: `Ospite ${id}` }) });
  if (!query.data) return <p>Carico i dati…</p>;
  return (
    <div>
      <p>{query.data.guest}</p>
      <label>
        Nota
        <input data-testid="note" />
      </label>
      <button type="button" onClick={close}>
        Chiudi dal contenuto
      </button>
      <button type="button" onClick={() => drawer.open('probe-wide', 'z-9')}>
        Vai all&apos;altro
      </button>
    </div>
  );
}

function Bomb({ id }: DetailContentProps) {
  if (failing) throw new Error('the content failed');
  return <p>Ripreso {id}</p>;
}

const LazyContent = lazy(async () => ({ default: ({ id }: DetailContentProps) => <p>Contenuto pigro {id}</p> }));

function EmptyTitle() {
  return null;
}

function Page() {
  const drawer = useDetailDrawer();
  const location = useLocation();
  useEffect(() => {
    handle.drawer = drawer;
  });
  return (
    <div>
      <h1>Pagina</h1>
      <button type="button" onClick={(event) => drawer.open('probe', 'abc-1', { opener: event.currentTarget })}>
        Apri
      </button>
      <button type="button" onClick={(event) => drawer.open('probe-wide', 'w-2', { opener: event.currentTarget })}>
        Apri largo
      </button>
      <output data-testid="where">{location.pathname + location.search}</output>
    </div>
  );
}

function Shell() {
  return (
    <>
      <Outlet />
      <DetailDrawerHost />
    </>
  );
}

function renderPage(initial = '/app/page') {
  const router = createMemoryRouter(
    [
      {
        element: <Shell />,
        children: [
          { path: '/app/page', element: <Page /> },
          { path: '/app/other', element: <p>Un&apos;altra pagina</p> },
        ],
      },
    ],
    { initialEntries: [initial] },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const where = () => screen.getByTestId('where').textContent;
/** Radix starts listening for a press outside the dialog one tick after it opens. */
const afterTick = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

describe('Detail drawer (UI-15)', () => {
  const undo: Array<() => void> = [];

  beforeAll(() => {
    undo.push(
      registerDetail('probe', { title: ProbeTitle, Content: ProbeContent, pageHref: (id) => `/app/other?from=${id}` }),
      registerDetail('probe-wide', { title: 'detailDrawer.fallbackTitle', Content: ProbeContent, width: 'wide' }),
      registerDetail('probe-boom', { title: 'detailDrawer.fallbackTitle', Content: Bomb }),
      registerDetail('probe-lazy', { title: 'detailDrawer.fallbackTitle', Content: LazyContent }),
      registerDetail('probe-untitled', { title: EmptyTitle, Content: ProbeContent }),
    );
  });

  afterAll(() => {
    while (undo.length > 0) undo.pop()?.();
  });

  beforeEach(async () => {
    await i18n.changeLanguage('it');
    handle.drawer = undefined;
    failing = false;
  });

  afterEach(async () => {
    cleanup();
    // The focus scope of a dialog that was open says goodbye one tick after it unmounts: let it, before the next test starts.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    takeOpener();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('what the address asks for', () => {
    it('DetailDrawerHost_NoDrawerInTheAddress_DrawsNothing', () => {
      renderPage();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Pagina' })).toBeInTheDocument();
      expect(handle.drawer?.current).toBeNull();
    });

    it('DetailDrawerHost_AddressWithARegisteredKind_OpensItWithItsTitleAndItsContent', async () => {
      renderPage('/app/page?chip=pending&detail=probe:abc-1');

      const dialog = await screen.findByRole('dialog', { name: 'Prenotazione abc-1' });
      expect(await within(dialog).findByText('Ospite abc-1')).toBeInTheDocument();
      expect(handle.drawer?.current).toEqual({ kind: 'probe', id: 'abc-1' });
      expect(where()).toBe('/app/page?chip=pending&detail=probe:abc-1');
    });

    it('DetailDrawerHost_AKindNobodyRegistered_OpensNothingAndBreaksNothing', () => {
      renderPage('/app/page?detail=nessuno:1');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Pagina' })).toBeInTheDocument();
      expect(handle.drawer?.current).toBeNull();
    });

    it.each(['probe:../../admin', 'probe:a b', 'probe', 'PROBE:1', 'probe:'])(
      'DetailDrawerHost_%j_IsNotAValidDrawerAndOpensNothing',
      (value) => {
        renderPage(`/app/page?detail=${encodeURIComponent(value)}`);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(handle.drawer?.current).toBeNull();
      },
    );

    it('DetailDrawerHost_AKindThatRegistersAfterTheFirstRender_OpensTheDrawerTheAddressAskedFor', async () => {
      renderPage('/app/page?detail=late-kind:7');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      let unregister: () => void = () => undefined;
      act(() => {
        unregister = registerDetail('late-kind', { title: 'detailDrawer.fallbackTitle', Content: ProbeContent });
      });

      expect(await screen.findByRole('dialog', { name: 'Dettaglio' })).toBeInTheDocument();
      unregister();
    });

    it('DetailDrawerHost_AddressChangesToAnotherDrawer_KeepsThePanelAndMountsTheContentAgain', async () => {
      const router = renderPage('/app/page?detail=probe:abc-1');
      const dialog = await screen.findByRole('dialog', { name: 'Prenotazione abc-1' });
      await within(dialog).findByText('Ospite abc-1');

      await act(async () => {
        await router.navigate('/app/page?detail=probe:xyz-2');
      });

      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(await within(dialog).findByText('Ospite xyz-2')).toBeInTheDocument();
      expect(dialog).toHaveAccessibleName('Prenotazione xyz-2');
    });
  });

  describe('opening and closing', () => {
    it('useDetailDrawer_OpenFromAButtonOutsideAnyList_ShowsTheDrawerAndWritesTheAddress', async () => {
      renderPage('/app/page?chip=pending');

      fireEvent.click(screen.getByRole('button', { name: 'Apri' }));

      const dialog = await screen.findByRole('dialog', { name: 'Prenotazione abc-1' });
      expect(await within(dialog).findByText('Ospite abc-1')).toBeInTheDocument();
      expect(where()).toBe('/app/page?chip=pending&detail=probe:abc-1');
    });

    it('useDetailDrawer_OpenAKindNobodyRegistered_DoesNothingAndSaysFalse', () => {
      renderPage('/app/page');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      let result: boolean | undefined;
      act(() => {
        result = handle.drawer?.open('nessuno', '1');
      });

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(where()).toBe('/app/page');
    });

    it('useDetailDrawer_OpenWithAnIdThatCouldCarryAPath_IsRefused', () => {
      renderPage('/app/page');
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      let result: boolean | undefined;
      act(() => {
        result = handle.drawer?.open('probe', '../../admin');
      });

      expect(result).toBe(false);
      expect(where()).toBe('/app/page');
    });

    it('DetailDrawerHost_Back_ClosesTheDrawer', async () => {
      const router = renderPage('/app/page?chip=pending');
      fireEvent.click(screen.getByRole('button', { name: 'Apri' }));
      await screen.findByRole('dialog');

      await act(async () => {
        await router.navigate(-1);
      });

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(router.state.location.search).toBe('?chip=pending');
    });

    it('DetailDrawerHost_EscapeAfterOpeningFromAButton_GoesBackSoTheHistoryHasNoSecondEntry', async () => {
      const router = renderPage('/app/page?chip=pending');
      fireEvent.click(screen.getByRole('button', { name: 'Apri' }));
      fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(router.state.historyAction).toBe('POP');
      expect(where()).toBe('/app/page?chip=pending');
    });

    it('DetailDrawerHost_CloseOfADrawerFromASharedLink_ReplacesTheEntryAndStaysOnThePage', async () => {
      const router = renderPage('/app/page?chip=pending&detail=probe:abc-1');
      fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(router.state.historyAction).toBe('REPLACE');
      expect(where()).toBe('/app/page?chip=pending');
    });

    it('DetailDrawerHost_CloseButton_Closes', async () => {
      renderPage('/app/page?detail=probe:abc-1');

      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Chiudi' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(where()).toBe('/app/page');
    });

    it('DetailDrawerHost_ContentCallsClose_ClosesTheDrawer', async () => {
      renderPage('/app/page?detail=probe:abc-1');

      fireEvent.click(await screen.findByRole('button', { name: 'Chiudi dal contenuto' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('DetailDrawerHost_APressOutsideTheDrawer_Closes', async () => {
      renderPage('/app/page?detail=probe:abc-1');
      await screen.findByRole('dialog');
      await afterTick();

      fireEvent.pointerDown(document.querySelector('[data-state="open"].fixed.inset-0') as HTMLElement);

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('DetailDrawerHost_APressOnAToast_DoesNotCloseTheDrawerTheActionWasTakenIn', async () => {
      renderPage('/app/page?detail=probe:abc-1');
      await screen.findByRole('dialog');
      await afterTick();
      const toaster = document.createElement('ol');
      toaster.setAttribute('data-sonner-toaster', 'true');
      const undoButton = document.createElement('button');
      toaster.append(undoButton);
      document.body.append(toaster);

      fireEvent.pointerDown(undoButton);
      await afterTick();

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      toaster.remove();
    });

    it('DetailDrawerHost_OpeningAnotherWhileOneIsOpen_SwapsItAndOneBackClosesWhicheverIsThere', async () => {
      const router = renderPage('/app/page?chip=pending');
      fireEvent.click(screen.getByRole('button', { name: 'Apri' }));
      fireEvent.click(await screen.findByRole('button', { name: "Vai all'altro" }));

      await waitFor(() => expect(where()).toBe('/app/page?chip=pending&detail=probe-wide:z-9'));
      expect(router.state.historyAction).toBe('REPLACE');
      expect(screen.getAllByRole('dialog')).toHaveLength(1);

      await act(async () => {
        await router.navigate(-1);
      });

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(router.state.location.search).toBe('?chip=pending');
    });

    it('DetailDrawerHost_FollowingTheLinkToTheFullPage_LeavesTheDrawerBehind', async () => {
      renderPage('/app/page?detail=probe:abc-1');
      const link = await screen.findByRole('link', { name: 'Apri la scheda completa' });
      expect(link).toHaveAttribute('href', '/app/other?from=abc-1');

      fireEvent.click(link);

      expect(await screen.findByText("Un'altra pagina")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('DetailDrawerHost_AKindWithoutAPage_HasNoFullPageLink', async () => {
      renderPage('/app/page?detail=probe-wide:w-2');
      await screen.findByRole('dialog');

      expect(screen.queryByRole('link', { name: 'Apri la scheda completa' })).not.toBeInTheDocument();
    });
  });

  describe('the focus', () => {
    it('DetailDrawerHost_Opened_PutsTheFocusOnTheContainerOfTheContentNotOnAControl', async () => {
      renderPage('/app/page?detail=probe:abc-1');
      await screen.findByRole('dialog');

      await waitFor(() => expect(screen.getByTestId('detail-drawer-body')).toHaveFocus());
    });

    it('DetailDrawerHost_Closed_GivesTheFocusBackToTheButtonThatOpenedIt', async () => {
      renderPage('/app/page');
      const opener = screen.getByRole('button', { name: 'Apri' });
      opener.focus();
      fireEvent.click(opener);
      fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(opener).toHaveFocus());
    });

    it('DetailDrawerHost_OpenedBySwappingDrawers_StillGivesTheFocusBackToTheFirstOpener', async () => {
      renderPage('/app/page');
      const opener = screen.getByRole('button', { name: 'Apri' });
      fireEvent.click(opener);
      fireEvent.click(await screen.findByRole('button', { name: "Vai all'altro" }));
      await waitFor(() => expect(where()).toContain('probe-wide:z-9'));

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      await waitFor(() => expect(opener).toHaveFocus());
    });

    it('DetailDrawerHost_TheOpenerIsGoneWhenItCloses_DoesNotBreak', async () => {
      renderPage('/app/page');
      const opener = screen.getByRole('button', { name: 'Apri' });
      opener.focus();
      fireEvent.click(opener);
      const dialog = await screen.findByRole('dialog');
      opener.remove();

      fireEvent.keyDown(dialog, { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('DetailDrawerHost_Tab_StaysInsideTheDrawerAndGoesRoundFromTheLastControlToTheFirst', async () => {
      renderPage('/app/page?detail=probe:abc-1');
      const dialog = await screen.findByRole('dialog');
      await within(dialog).findByText('Ospite abc-1');
      const first = within(dialog).getByTestId('note');
      const last = within(dialog).getByRole('button', { name: 'Chiudi' });

      last.focus();
      fireEvent.keyDown(last, { key: 'Tab' });
      expect(first).toHaveFocus();

      fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
      expect(last).toHaveFocus();
    });
  });

  describe('one element for the phone and for the desktop', () => {
    it('DetailDrawerHost_Classes_AreASheetFromTheBottomUnderMdAndAPanelAtTheRightFromMd', async () => {
      renderPage('/app/page?detail=probe:abc-1');
      const dialog = await screen.findByRole('dialog');

      expect(dialog).toHaveAttribute('data-detail-sheet');
      expect(dialog).toHaveClass('max-md:inset-x-0', 'max-md:bottom-0', 'max-md:max-h-[92dvh]', 'max-md:rounded-t-2xl');
      expect(dialog).toHaveClass('md:inset-y-0', 'md:right-0', 'md:max-w-xl');
      // The motion of a panel is for the panel only: a sheet from the bottom moves with its own CSS (`styles/sheet-bottom.css`).
      expect(dialog).toHaveClass('md:data-[state=open]:slide-in-from-right');
      expect(dialog.className).not.toMatch(/(^|\s)(data-\[state=open\]:animate-in|slide-in-from-right)/);
    });

    it('DetailDrawerHost_Handle_IsThereForAFingerAndHiddenFromMd', async () => {
      renderPage('/app/page?detail=probe:abc-1');
      await screen.findByRole('dialog');

      expect(screen.getByTestId('sheet-handle')).toHaveClass('md:hidden');
      expect(screen.getByTestId('sheet-handle')).toHaveAttribute('aria-hidden', 'true');
    });

    it('DetailDrawerHost_Handle_PulledDownCloses', async () => {
      renderPage('/app/page?detail=probe:abc-1');
      const dialog = await screen.findByRole('dialog');
      const grip = screen.getByTestId('sheet-handle');

      fireEvent.pointerDown(grip, { pointerId: 1, pointerType: 'touch', clientY: 400 });
      fireEvent.pointerMove(grip, { pointerId: 1, pointerType: 'touch', clientY: 540 });
      // The sheet follows the finger: it is the drawer itself that is moved.
      expect(dialog.style.transform).toBe('translateY(140px)');
      fireEvent.pointerUp(grip, { pointerId: 1, pointerType: 'touch', clientY: 540 });

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(where()).toBe('/app/page');
    });

    it('DetailDrawerHost_WideKind_GetsTheWiderPanel', async () => {
      renderPage('/app/page?detail=probe-wide:w-2');

      expect(await screen.findByRole('dialog')).toHaveClass('md:max-w-2xl');
    });

    it('DetailDrawerHost_TheWindowCrossesMd_KeepsTheSameElementAndWhatWasTypedInIt', async () => {
      const viewport = stubViewportWidth(390);
      renderPage('/app/page?detail=probe:abc-1');
      const dialog = await screen.findByRole('dialog');
      const note = await within(dialog).findByTestId('note');
      fireEvent.change(note, { target: { value: 'portare il seggiolone' } });

      // The phone is turned (390 px to 844 px) and the window is stretched (to 1280 px).
      act(() => viewport.resize(844));
      act(() => viewport.resize(1280));

      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(within(dialog).getByTestId('note')).toBe(note);
      expect(note).toHaveValue('portare il seggiolone');
    });
  });

  describe('the content', () => {
    it('DetailDrawerHost_ContentLoadingItsData_ShowsAPlaceholderThatIsAnnounced', async () => {
      renderPage('/app/page?detail=probe-lazy:l-1');

      // A lazy content shows the placeholder of the drawer while its chunk comes, then the content.
      expect(await screen.findByText('Contenuto pigro l-1')).toBeInTheDocument();
    });

    it('DetailDrawerHost_ContentThatFails_SaysSoOffersToTryAgainAndTheRestOfThePageSurvives', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      failing = true;
      renderPage('/app/page?detail=probe-boom:b-1');

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Impossibile mostrare il dettaglio');
      // The page is behind the dialog, hidden from assistive technology while it is open.
      expect(screen.getByRole('heading', { name: 'Pagina', hidden: true })).toBeInTheDocument();
      // The drawer still has a name and a way to close.
      expect(screen.getByRole('dialog')).toHaveAccessibleName('Dettaglio');

      failing = false;
      fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));

      expect(await screen.findByText('Ripreso b-1')).toBeInTheDocument();
    });

    it('DetailDrawerHost_TitleAsAKey_IsTranslatedInTheLanguageOfThePage', async () => {
      renderPage('/app/page?detail=probe-wide:w-2');
      expect(await screen.findByRole('dialog', { name: 'Dettaglio' })).toBeInTheDocument();
      cleanup();

      await i18n.changeLanguage('en');
      renderPage('/app/page?detail=probe-wide:w-2');

      expect(await screen.findByRole('dialog', { name: 'Details' })).toBeInTheDocument();
    });

    it('DetailDrawerHost_TitleThatDrawsNothingYet_LeavesTheDrawerWithAGenericName', async () => {
      renderPage('/app/page?detail=probe-untitled:u-1');

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog).toHaveAccessibleName('Dettaglio'));
    });
  });

  describe('accessibility', () => {
    it('DetailDrawerHost_Open_HasNoAxeViolations', async () => {
      renderPage('/app/page?detail=probe:abc-1');
      const dialog = await screen.findByRole('dialog');
      await within(dialog).findByText('Ospite abc-1');

      await expectNoAxeViolations(document.body);
    });

    it('DetailDrawerHost_Open_IsAModalDialogThatHidesThePageBehindIt', async () => {
      renderPage('/app/page?detail=probe:abc-1');
      const dialog = await screen.findByRole('dialog');

      expect(dialog).toHaveAttribute('role', 'dialog');
      expect(screen.getByRole('heading', { name: 'Pagina', hidden: true }).closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('DetailDrawerHost_CloseButton_IsAtLeast44PixelsAndNamedForAScreenReader', async () => {
      renderPage('/app/page?detail=probe:abc-1');
      const close = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Chiudi' });

      expect(close).toHaveClass('size-11');
    });
  });
});
