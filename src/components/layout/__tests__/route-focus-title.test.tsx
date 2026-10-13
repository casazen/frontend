import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { MemoryRouter, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import i18n from '@/i18n/config';
import { usePageTitle } from '@/hooks/use-page-title';
import { AppShellContext } from '../app-shell-context';
import { PageHeader } from '../page-header';
import { RouteFocus } from '../route-focus';

/**
 * UI-05: a page without a heading is announced by the title of the tab (`RouteFocus`), which is now the title of the page
 * with the name of its area and not "CasaZen" on every page.
 */
function Shell() {
  const mainRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('/senza-titolo')}>
        go-untitled
      </button>
      <button type="button" onClick={() => navigate('/con-testata')}>
        go-header
      </button>
      <main ref={mainRef}>
        <Outlet />
      </main>
      <RouteFocus mainRef={mainRef} />
    </>
  );
}

/** A page that has a name for the tab and no heading (a custom screen). */
function PageWithoutHeading() {
  usePageTitle('Riepilogo');
  return <p>Niente h1</p>;
}

function renderApp() {
  return render(
    <AppShellContext.Provider value={{ contextKey: 'short-rent' }}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<h1>Home</h1>} />
            <Route path="/senza-titolo" element={<PageWithoutHeading />} />
            <Route path="/con-testata" element={<PageHeader title="Prenotazioni" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppShellContext.Provider>,
  );
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('RouteFocus and the title of the page (UI-05)', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    document.title = 'CasaZen';
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.title = 'CasaZen';
  });

  it('RouteFocus_PageWithoutHeadingButWithATitle_AnnouncesTheTitleWithItsAreaNotJustTheBrand', () => {
    renderApp();

    fireEvent.click(screen.getByText('go-untitled'));
    advance(5200);
    advance(60);

    expect(screen.getByTestId('route-announcer')).toHaveTextContent('Riepilogo · Affitti brevi · CasaZen');
  });

  it('RouteFocus_PageWithAHeader_AnnouncesTheHeadingAsItAlwaysDid', () => {
    renderApp();

    fireEvent.click(screen.getByText('go-header'));
    advance(160);

    expect(screen.getByTestId('route-announcer')).toHaveTextContent(/^Prenotazioni$/);
    // The tab, meanwhile, carries the full title.
    expect(document.title).toBe('Prenotazioni · Affitti brevi · CasaZen');
  });
});
