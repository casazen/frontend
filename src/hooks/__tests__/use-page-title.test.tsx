import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import i18n from '@/i18n/config';
import { AppShellContext } from '@/components/layout/app-shell-context';
import type { AppContextKey } from '@/config/route-manifest';
import { usePageTitle } from '../use-page-title';

function Page({ title }: { title?: string }) {
  usePageTitle(title);
  return null;
}

function inShell(contextKey: AppContextKey, children: React.ReactNode) {
  return <AppShellContext.Provider value={{ contextKey }}>{children}</AppShellContext.Provider>;
}

describe('usePageTitle (UI-05)', () => {
  beforeEach(async () => {
    document.title = 'CasaZen';
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    document.title = 'CasaZen';
  });

  it('usePageTitle_PageInAShell_PutsPageAreaAndBrandOnTheTab', () => {
    render(inShell('short-rent', <Page title="Prenotazioni" />));

    expect(document.title).toBe('Prenotazioni · Affitti brevi · CasaZen');
  });

  it.each<[AppContextKey, string]>([
    ['short-rent', 'Affitti brevi'],
    ['long-rent', 'Affitti lunghi'],
    ['supplier', 'Portale fornitori'],
    ['admin', 'Amministrazione'],
  ])('usePageTitle_%s_NamesItsOwnArea', (contextKey, areaName) => {
    render(inShell(contextKey, <Page title="Profilo" />));

    expect(document.title).toBe(`Profilo · ${areaName} · CasaZen`);
  });

  it('usePageTitle_PageOutsideAShell_HasNoAreaToName', () => {
    render(<Page title="Prenotazioni" />);

    expect(document.title).toBe('Prenotazioni · CasaZen');
  });

  it('usePageTitle_NoTitle_LeavesTheTabAlone', () => {
    render(inShell('short-rent', <Page />));

    expect(document.title).toBe('CasaZen');
  });

  it('usePageTitle_PageLeaves_GivesTheOriginalTitleBack', () => {
    const { unmount } = render(inShell('short-rent', <Page title="Prenotazioni" />));
    expect(document.title).toBe('Prenotazioni · Affitti brevi · CasaZen');

    unmount();

    // A page without a title of its own (a wizard, a page with a custom head) must not inherit the one that left.
    expect(document.title).toBe('CasaZen');
  });

  it('usePageTitle_NewPageReplacesTheOldOne_ShowsTheNewTitle', () => {
    const { rerender } = render(inShell('short-rent', <Page title="Prenotazioni" />));

    rerender(inShell('short-rent', <Page title="Immobili" />));

    expect(document.title).toBe('Immobili · Affitti brevi · CasaZen');
  });

  it('usePageTitle_TwoPagesAtOnce_LatestWinsAndTheEarlierComesBackWhenItGoes', () => {
    function Both({ withInner }: { withInner: boolean }) {
      return (
        <>
          <Page title="Prenotazioni" />
          {withInner ? <Page title="Dettaglio" /> : null}
        </>
      );
    }
    const { rerender, unmount } = render(inShell('short-rent', <Both withInner={false} />));
    expect(document.title).toBe('Prenotazioni · Affitti brevi · CasaZen');

    rerender(inShell('short-rent', <Both withInner />));
    expect(document.title).toBe('Dettaglio · Affitti brevi · CasaZen');

    rerender(inShell('short-rent', <Both withInner={false} />));
    expect(document.title).toBe('Prenotazioni · Affitti brevi · CasaZen');

    unmount();
    expect(document.title).toBe('CasaZen');
  });

  it('usePageTitle_LanguageChanges_TitleFollowsTheAreaName', async () => {
    render(inShell('short-rent', <Page title="Bookings" />));
    expect(document.title).toBe('Bookings · Affitti brevi · CasaZen');

    await act(async () => {
      await i18n.changeLanguage('en');
    });

    expect(document.title).toBe('Bookings · Short-term rentals · CasaZen');
  });
});
