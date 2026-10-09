import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ContextBootstrapDto } from '@/api/contexts';
import type { AppContextKey } from '@/config/route-manifest';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { UserMenu } from '../user-menu';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));

const logout = vi.fn();
const setActiveContext = vi.fn();

function arrange(contextKeys: AppContextKey[], activeContext: AppContextKey | null = contextKeys[0] ?? null) {
  vi.mocked(useAuth).mockReturnValue({
    user: { name: 'Mario Rossi', email: 'mario@example.com' },
    logout,
  } as unknown as ReturnType<typeof useAuth>);
  const contexts: ContextBootstrapDto[] = contextKeys.map((contextKey) => ({
    contextKey,
    displayName: contextKey,
    roleKey: contextKey,
    permissions: [],
    defaultRoute: `/app/${contextKey}`,
  }));
  vi.mocked(useWorkspace).mockReturnValue({
    contexts,
    activeContext,
    isReady: true,
    setActiveContext,
    hasPermission: () => true,
    getDefaultRoute: (key) => `/app/${key}`,
  });
}

function Address() {
  return <p data-testid="address">{useLocation().pathname}</p>;
}

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <UserMenu />
              <Address />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const trigger = () => screen.getByRole('button', { name: /Menu utente/ });

/** The rows of the menu, in order: items, and the choices of the radio groups. */
const rowsOf = (menu: HTMLElement) => [...menu.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')];

/** Opens the menu as a keyboard user does (Radix opens it on a pointer press, which jsdom cannot send). */
async function openMenu() {
  fireEvent.keyDown(trigger(), { key: 'Enter' });
  return screen.findByRole('menu');
}

describe('UserMenu content (UI-05)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  describe('what it offers', () => {
    it('UserMenu_Opened_OffersProfileLanguageAndLogoutInThatOrder', async () => {
      arrange(['short-rent']);
      renderMenu();

      const menu = await openMenu();

      expect(rowsOf(menu).map((row) => row.textContent)).toEqual(['Profilo', 'Italiano', 'English', 'Esci']);
      expect(within(menu).getByText('Mario Rossi')).toBeInTheDocument();
      expect(within(menu).getByText('mario@example.com')).toBeInTheDocument();
    });

    it('UserMenu_Opened_HasNoRowForTheThemeWhichDoesNotExistYet', async () => {
      arrange(['short-rent']);
      renderMenu();

      const menu = await openMenu();

      expect(within(menu).queryByText(/tema|theme|scuro|dark/i)).not.toBeInTheDocument();
    });

    it('UserMenu_Opened_EveryRowIsFingerSizedOnAPhoneAndATouchScreen', async () => {
      arrange(['short-rent', 'long-rent']);
      renderMenu();

      const menu = await openMenu();

      const rows = rowsOf(menu);
      // Profile, two languages, two areas, logout.
      expect(rows).toHaveLength(6);
      for (const row of rows) {
        expect(row).toHaveClass('max-md:min-h-11', 'pointer-coarse:min-h-11');
      }
    });

    it('UserMenu_Trigger_StillTellsWhoseMenuItIs', () => {
      arrange(['short-rent']);
      renderMenu();

      expect(trigger()).toHaveAccessibleName('Menu utente: Mario Rossi');
      expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    });
  });

  describe('profile', () => {
    it.each<[AppContextKey, string]>([
      ['short-rent', '/app/short-rent/profile'],
      ['long-rent', '/app/long-rent/profile'],
      ['admin', '/app/admin/profile'],
      ['supplier', '/app/supplier/profile'],
    ])('UserMenu_Profile_%s_OpensTheProfileOfThatArea', async (area, path) => {
      arrange([area]);
      renderMenu();
      const menu = await openMenu();

      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Profilo' }));

      expect(screen.getByTestId('address')).toHaveTextContent(path);
    });
  });

  describe('language', () => {
    it('UserMenu_Language_ShowsTheNamesInTheirOwnLanguageWithTheCurrentOneChecked', async () => {
      arrange(['short-rent']);
      renderMenu();

      const menu = await openMenu();

      const italian = within(menu).getByRole('menuitemradio', { name: 'Italiano' });
      const english = within(menu).getByRole('menuitemradio', { name: 'English' });
      expect(italian).toHaveAttribute('aria-checked', 'true');
      expect(english).toHaveAttribute('aria-checked', 'false');
      // A screen reader reads each name in its language.
      expect(italian).toHaveAttribute('lang', 'it');
      expect(english).toHaveAttribute('lang', 'en');
    });

    it('UserMenu_ChoosingEnglish_ChangesTheLanguageKeepsTheChoiceAndClosesTheMenu', async () => {
      arrange(['short-rent']);
      renderMenu();
      const menu = await openMenu();

      fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'English' }));

      await waitFor(() => expect(i18n.language).toBe('en'));
      expect(localStorage.getItem('casazen.locale')).toBe('en');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      // The trigger speaks the new language.
      expect(screen.getByRole('button', { name: 'User menu: Mario Rossi' })).toBeInTheDocument();
    });

    it('UserMenu_ChoosingTheLanguageInUse_ChangesNothing', async () => {
      arrange(['short-rent']);
      renderMenu();
      const menu = await openMenu();

      fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Italiano' }));

      expect(i18n.language).toBe('it');
      expect(localStorage.getItem('casazen.locale')).toBeNull();
    });

    it('UserMenu_EnglishUi_ChecksEnglishAndLabelsTheRows', async () => {
      await i18n.changeLanguage('en');
      arrange(['short-rent']);
      renderMenu();

      fireEvent.keyDown(screen.getByRole('button', { name: /User menu/ }), { key: 'Enter' });
      const menu = await screen.findByRole('menu');

      expect(within(menu).getByRole('menuitemradio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
      expect(within(menu).getByText('Language')).toBeInTheDocument();
      expect(within(menu).getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument();
    });
  });

  describe('areas', () => {
    it('UserMenu_OneArea_HasNothingToChooseAndNoRowForIt', async () => {
      arrange(['short-rent']);
      renderMenu();

      const menu = await openMenu();

      expect(within(menu).queryByText('Le tue aree')).not.toBeInTheDocument();
    });

    it('UserMenu_SeveralAreas_ListsThemWithTheCurrentOneChecked', async () => {
      arrange(['short-rent', 'long-rent', 'supplier'], 'long-rent');
      renderMenu();

      const menu = await openMenu();

      expect(within(menu).getByText('Le tue aree')).toBeInTheDocument();
      const areas = ['Affitti brevi', 'Affitti lunghi', 'Portale fornitori'].map((name) => within(menu).getByRole('menuitemradio', { name }));
      expect(areas.map((area) => area.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    });

    it('UserMenu_ChoosingAnotherArea_GoesThere', async () => {
      arrange(['short-rent', 'long-rent'], 'short-rent');
      renderMenu();
      const menu = await openMenu();

      fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Affitti lunghi' }));

      expect(setActiveContext).toHaveBeenCalledWith('long-rent');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('UserMenu_ChoosingTheCurrentArea_StaysWhereItIsAndJustCloses', async () => {
      arrange(['short-rent', 'long-rent'], 'short-rent');
      renderMenu();
      const menu = await openMenu();

      fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Affitti brevi' }));

      expect(setActiveContext).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('logout and keyboard', () => {
    it('UserMenu_Logout_SignsOut', async () => {
      arrange(['short-rent']);
      renderMenu();
      const menu = await openMenu();

      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Esci' }));

      expect(logout).toHaveBeenCalledTimes(1);
    });

    it('UserMenu_Keyboard_ArrowsWalkTheRowsAndEscapeClosesWithTheFocusBackOnTheAvatar', async () => {
      arrange(['short-rent']);
      renderMenu();
      act(() => trigger().focus());
      const menu = await openMenu();

      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      await waitFor(() => expect(within(menu).getByRole('menuitem', { name: 'Profilo' })).toHaveFocus());
      fireEvent.keyDown(within(menu).getByRole('menuitem', { name: 'Profilo' }), { key: 'ArrowDown' });
      await waitFor(() => expect(within(menu).getByRole('menuitemradio', { name: 'Italiano' })).toHaveFocus());
      fireEvent.keyDown(within(menu).getByRole('menuitemradio', { name: 'Italiano' }), { key: 'Escape' });

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      // Radix gives the focus back one tick after the menu is gone.
      await waitFor(() => expect(trigger()).toHaveFocus());
    });

    it('UserMenu_EnterOnALanguageRow_ChoosesItFromTheKeyboard', async () => {
      arrange(['short-rent']);
      renderMenu();
      const menu = await openMenu();
      const english = within(menu).getByRole('menuitemradio', { name: 'English' });
      act(() => english.focus());

      fireEvent.keyDown(english, { key: 'Enter' });

      await waitFor(() => expect(i18n.language).toBe('en'));
    });
  });
});
