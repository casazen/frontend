import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { MemoryRouter, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { RouteFocus } from '../route-focus';

/**
 * The focus and the announcement at every change of page (UI-03): a content region with the page of the route in it,
 * and `RouteFocus` beside it, as `AppShellLayout` puts them.
 */
const DESTINATIONS = ['b', 'b2', 'plain', 'slow', 'form'] as const;

function Shell() {
  const mainRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  return (
    <>
      {DESTINATIONS.map((destination) => (
        <button key={destination} type="button" onClick={() => navigate(`/${destination}`)}>
          {`go-${destination}`}
        </button>
      ))}
      <main ref={mainRef} data-testid="main">
        <Outlet />
      </main>
      <RouteFocus mainRef={mainRef} />
    </>
  );
}

/** A page whose heading appears after a delay, like a page that waits for its data before drawing anything. */
function SlowPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 700);
    return () => clearTimeout(id);
  }, []);
  return ready ? <h1>Pagina lenta</h1> : <p>Caricamento</p>;
}

function renderShell() {
  return render(
    <div data-testid="app-root">
      <MemoryRouter initialEntries={['/a']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/a" element={<h1>Pagina A</h1>} />
            <Route path="/b" element={<h1>Pagina B</h1>} />
            <Route path="/b2" element={<h1>Pagina B</h1>} />
            <Route path="/plain" element={<p>Niente titolo</p>} />
            <Route path="/slow" element={<SlowPage />} />
            <Route
              path="/form"
              element={
                <>
                  <h1>Modulo</h1>
                  <input aria-label="Nome" autoFocus />
                </>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </div>,
  );
}

const go = (destination: (typeof DESTINATIONS)[number]) => fireEvent.click(screen.getByText(`go-${destination}`));
const announcer = () => screen.getByTestId('route-announcer');
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('RouteFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('RouteFocus_FirstPage_LeavesTheFocusAndTheAnnouncerAlone', () => {
    renderShell();
    advance(1000);

    expect(document.activeElement).toBe(document.body);
    expect(announcer()).toBeEmptyDOMElement();
  });

  it('RouteFocus_Announcer_IsAPoliteLiveRegionHiddenFromTheEyes', () => {
    renderShell();

    expect(announcer()).toHaveAttribute('aria-live', 'polite');
    expect(announcer()).toHaveAttribute('aria-atomic', 'true');
    expect(announcer()).toHaveClass('sr-only');
  });

  it('RouteFocus_NewPage_FocusesTheHeadingWithoutScrollingAndAnnouncesItsTitle', () => {
    renderShell();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');

    go('b');
    const heading = screen.getByRole('heading', { level: 1, name: 'Pagina B' });

    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    // The announcement follows the focus by a moment: the region is emptied first and filled after.
    expect(announcer()).toBeEmptyDOMElement();
    advance(60);
    expect(announcer()).toHaveTextContent('Pagina B');
  });

  it('RouteFocus_AnnouncedTitle_LeavesThePageAfterAWhile', () => {
    renderShell();

    go('b');
    advance(60);
    expect(announcer()).toHaveTextContent('Pagina B');

    advance(5000);
    expect(announcer()).toBeEmptyDOMElement();
  });

  it('RouteFocus_TwoPagesWithTheSameTitle_AreAnnouncedBoth', () => {
    renderShell();

    go('b');
    advance(60);
    expect(announcer()).toHaveTextContent('Pagina B');

    // Same title as a moment ago: the region is emptied again, or a screen reader would not say it twice.
    go('b2');
    expect(announcer()).toBeEmptyDOMElement();
    advance(60);
    expect(announcer()).toHaveTextContent('Pagina B');
  });

  it('RouteFocus_PageWhoseHeadingComesLate_FocusesItWhenItAppears', () => {
    renderShell();

    go('slow');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByTestId('main')).not.toHaveFocus();

    // The page draws its heading at 700 ms; the next look at the page, 100 ms later, finds it.
    advance(700);
    const heading = screen.getByRole('heading', { level: 1, name: 'Pagina lenta' });
    expect(heading).not.toHaveFocus();
    advance(100);
    expect(heading).toHaveFocus();
    advance(60);
    expect(announcer()).toHaveTextContent('Pagina lenta');
  });

  it('RouteFocus_PageWithoutHeading_FallsBackToTheContentRegionAfterAWhile', () => {
    document.title = 'CasaZen';
    renderShell();

    go('plain');
    expect(screen.getByTestId('main')).not.toHaveFocus();

    advance(5200);
    const main = screen.getByTestId('main');
    expect(main).toHaveFocus();
    expect(main).toHaveAttribute('tabindex', '-1');
    advance(60);
    expect(announcer()).toHaveTextContent('CasaZen');
  });

  it('RouteFocus_PageThatPutTheFocusInsideItsContent_KeepsItButStillAnnouncesTheTitle', () => {
    renderShell();

    go('form');

    expect(screen.getByLabelText('Nome')).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: 'Modulo' })).not.toHaveFocus();
    advance(60);
    expect(announcer()).toHaveTextContent('Modulo');
  });

  it('RouteFocus_ModalStillHidingThePage_WaitsUntilTheAppIsVisibleToAssistiveTechnology', () => {
    renderShell();
    // What Radix does to the app while a dialog (the mobile menu) is open or closing.
    const root = screen.getByTestId('app-root');
    root.setAttribute('aria-hidden', 'true');

    go('b');
    const heading = screen.getByRole('heading', { level: 1, name: 'Pagina B', hidden: true });
    advance(300);
    expect(heading).not.toHaveFocus();

    root.removeAttribute('aria-hidden');
    advance(150);
    expect(heading).toHaveFocus();
    advance(60);
    expect(announcer()).toHaveTextContent('Pagina B');
  });

  it('RouteFocus_ModalStillOpenWhenTheWaitRunsOut_LeavesTheFocusThereAndTakesTheHeadingWhenTheAppIsVisibleAgain', () => {
    renderShell();
    const root = screen.getByTestId('app-root');
    root.setAttribute('aria-hidden', 'true');

    go('b');
    const heading = screen.getByRole('heading', { level: 1, name: 'Pagina B', hidden: true });
    // A dialog that stays open longer than the wait: the heading is already in the page.
    advance(5200);
    expect(heading).not.toHaveFocus();
    expect(screen.getByTestId('main')).not.toHaveFocus();
    expect(announcer()).toBeEmptyDOMElement();

    root.removeAttribute('aria-hidden');
    advance(150);
    expect(heading).toHaveFocus();
    advance(60);
    expect(announcer()).toHaveTextContent('Pagina B');
  });

  it('RouteFocus_ModalStillOpenWhenTheWaitRunsOutAndThePageHasNoHeading_DoesNotFocusTheHiddenContent', () => {
    document.title = 'CasaZen';
    renderShell();
    const root = screen.getByTestId('app-root');
    root.setAttribute('aria-hidden', 'true');

    go('plain');
    advance(5200);
    expect(screen.getByTestId('main')).not.toHaveFocus();
    expect(announcer()).toBeEmptyDOMElement();

    root.removeAttribute('aria-hidden');
    // The wait for a heading starts once the app is visible again.
    advance(150);
    expect(screen.getByTestId('main')).not.toHaveFocus();
    advance(5200);
    expect(screen.getByTestId('main')).toHaveFocus();
    advance(60);
    expect(announcer()).toHaveTextContent('CasaZen');
  });

  it('RouteFocus_OtherNavigationBeforeTheHeadingShowsUp_AbandonsTheFirstWait', () => {
    renderShell();

    go('slow');
    go('b');

    const heading = screen.getByRole('heading', { level: 1, name: 'Pagina B' });
    expect(heading).toHaveFocus();
    advance(2000);
    // The page left behind never takes the focus back.
    expect(heading).toHaveFocus();
  });
});
