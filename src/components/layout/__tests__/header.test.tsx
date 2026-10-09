import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import type { AppContextKey } from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import { stubViewportWidth } from '@/test/viewport';
import { AppShellContext } from '../app-shell-context';
import { Header } from '../header';

vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));
// The parts of the header that read the user and the organization have their own tests.
vi.mock('@/components/auth/user-menu', () => ({ UserMenu: () => <button type="button" data-testid="user-menu-trigger" /> }));
vi.mock('@/components/org/org-badge', () => ({ OrgBadge: () => <div data-testid="org-badge" /> }));

function renderHeader(props: React.ComponentProps<typeof Header> = {}, { contextKey }: { contextKey?: AppContextKey } = {}) {
  vi.mocked(useWorkspace).mockReturnValue({ isReady: true } as unknown as ReturnType<typeof useWorkspace>);
  const header = <Header {...props} />;
  return render(contextKey ? <AppShellContext.Provider value={{ contextKey }}>{header}</AppShellContext.Provider> : header);
}

describe('Header (UI-05)', () => {
  beforeEach(async () => {
    stubViewportWidth(1280);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('what is always there', () => {
    it('Header_Rendered_HasTheOrganizationAndTheProfileAndNothingElse', () => {
      renderHeader();

      const header = screen.getByRole('banner');
      expect(within(header).getByTestId('org-badge')).toBeInTheDocument();
      expect(within(header).getByTestId('user-menu-trigger')).toBeInTheDocument();
      // Nothing that is not built yet leaves a box, a placeholder or a button that does nothing.
      expect(within(header).queryAllByRole('button')).toHaveLength(1);
      expect(within(header).queryByTestId('header-search')).not.toBeInTheDocument();
    });

    it('Header_Rendered_HasNoMenuButtonAndNoLanguageSwitch', () => {
      renderHeader();

      // The menu of the phone is "Altro" of the bottom bar, the language is in the menu of the profile.
      expect(screen.queryByRole('button', { name: 'Apri menu di navigazione' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('language-switcher')).not.toBeInTheDocument();
    });

    it('Header_Rendered_IsTheStickyBannerOfTheOneHeightOfTheApp', () => {
      renderHeader();

      const header = screen.getByRole('banner');
      expect(header.tagName).toBe('HEADER');
      expect(header).toHaveClass('sticky', 'top-0');
      // The height is said once, in `globals.css`.
      expect(header).toHaveClass('h-[var(--header-height)]');
      expect(header.className).not.toMatch(/(^|\s)h-16(\s|$)/);
    });
  });

  // `data-testid="app-ready"` (UI-00) is guarded by header-app-ready.test.tsx: not repeated here.

  describe('the places where the other functions plug in', () => {
    it('Header_FunctionsThatExist_AreMountedInTheirPlaces', () => {
      renderHeader({
        search: <button type="button">Cerca</button>,
        notifications: <button type="button">Notifiche</button>,
        help: <button type="button">Aiuto</button>,
      });

      const header = screen.getByRole('banner');
      const buttons = within(header).getAllByRole('button').map((button) => button.textContent || button.getAttribute('data-testid'));
      // The search first (it grows), then the bell, the help and, last, the profile.
      expect(buttons).toEqual(['Cerca', 'Notifiche', 'Aiuto', 'user-menu-trigger']);
      expect(within(screen.getByTestId('header-search')).getByRole('button', { name: 'Cerca' })).toBeInTheDocument();
    });

    it.each([
      ['search', { search: <button type="button">Cerca</button> }, 'Cerca'],
      ['notifications', { notifications: <button type="button">Notifiche</button> }, 'Notifiche'],
      ['help', { help: <button type="button">Aiuto</button> }, 'Aiuto'],
    ])('Header_Only%s_MountsOnlyThatOne', (_name, props, label) => {
      renderHeader(props);

      const labels = within(screen.getByRole('banner'))
        .getAllByRole('button')
        .map((button) => button.textContent)
        .filter(Boolean);
      expect(labels).toEqual([label]);
    });
  });

  describe('where the user is', () => {
    it('Header_Phone_NamesTheAreaWhereTheSidebarIsNotThere', () => {
      stubViewportWidth(390);
      renderHeader({}, { contextKey: 'long-rent' });

      expect(screen.getByTestId('header-area')).toHaveTextContent('Affitti lunghi');
    });

    it('Header_PhoneOutsideAShell_HasNoAreaToName', () => {
      stubViewportWidth(390);
      renderHeader();

      expect(screen.queryByTestId('header-area')).not.toBeInTheDocument();
    });

    it.each([768, 1024, 1280])('Header_%ipxWide_LeavesTheNameOfTheAreaToTheSidebar', (width) => {
      stubViewportWidth(width);
      renderHeader({}, { contextKey: 'short-rent' });

      expect(screen.queryByTestId('header-area')).not.toBeInTheDocument();
    });

    it('Header_AreaOnAPhone_IsOnlyALabelNotAButton', () => {
      stubViewportWidth(390);
      renderHeader({}, { contextKey: 'supplier' });

      const label = screen.getByTestId('header-area');
      expect(within(label).queryByRole('button')).not.toBeInTheDocument();
      expect(within(label).queryByRole('link')).not.toBeInTheDocument();
    });
  });
});
