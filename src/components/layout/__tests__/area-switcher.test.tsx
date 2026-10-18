import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import type { ContextBootstrapDto } from '@/api/contexts';
import type { AppContextKey } from '@/config/route-manifest';
import { AreaSwitcher } from '../area-switcher';

vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));

import { useWorkspace } from '@/hooks/use-workspace';

function context(contextKey: AppContextKey): ContextBootstrapDto {
  // The name the backend sends is not the one the user sees any more.
  return { contextKey, displayName: `backend ${contextKey}`, roleKey: contextKey, permissions: [], defaultRoute: `/app/${contextKey}` };
}

const setActiveContext = vi.fn();
let organization: string | null = 'Casa Rossi Srl';

function arrange(contextKeys: AppContextKey[], org: string | null = 'Casa Rossi Srl') {
  organization = org;
  vi.mocked(useWorkspace).mockReturnValue({
    contexts: contextKeys.map(context),
    activeContext: contextKeys[0] ?? null,
    isReady: true,
    setActiveContext,
    hasPermission: () => true,
    getDefaultRoute: (key) => `/app/${key}`,
  });
}

/** The shell reads the organization once and hands its name down. */
function renderSwitcher(contextKey: AppContextKey, props: { collapsed?: boolean } = {}) {
  return render(<AreaSwitcher contextKey={contextKey} organizationName={organization} {...props} />);
}

function openByKeyboard(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
}

describe('AreaSwitcher (UI-04a)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  describe('with a single area', () => {
    it('AreaSwitcher_OneArea_IsOnlyTheHeadingOfTheSidebar', () => {
      arrange(['supplier']);
      renderSwitcher('supplier');

      const heading = screen.getByTestId('area-header');
      expect(within(heading).getByText('Portale fornitori')).toBeInTheDocument();
      expect(within(heading).getByText('Casa Rossi Srl')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('area-switcher')).not.toBeInTheDocument();
    });

    it('AreaSwitcher_OneAreaAndNoOrganization_ShowsTheNameAlone', () => {
      arrange(['short-rent'], null);
      renderSwitcher('short-rent');

      expect(within(screen.getByTestId('area-header')).getByText('Affitti brevi')).toBeInTheDocument();
      expect(screen.queryByText('Casa Rossi Srl')).not.toBeInTheDocument();
    });
  });

  describe('with several areas', () => {
    it('AreaSwitcher_SeveralAreas_IsAMenuButtonThatNamesTheCurrentArea', () => {
      arrange(['short-rent', 'long-rent']);
      renderSwitcher('short-rent');

      const trigger = screen.getByRole('button', { name: 'Area attuale: Affitti brevi. Cambia area' });
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      // The visible text is part of the accessible name (WCAG 2.5.3): name and organization.
      expect(trigger).toHaveTextContent('Affitti brevi');
      expect(trigger).toHaveTextContent('Casa Rossi Srl');
    });

    it('AreaSwitcher_Opened_ListsOnlyTheAreasOfTheUserInOrderWithTheirDescription', async () => {
      // Contexts in a different order than the selector, and the backend names are not shown.
      arrange(['admin', 'supplier', 'short-rent']);
      renderSwitcher('supplier');
      openByKeyboard(screen.getByTestId('area-switcher'));

      const menu = await screen.findByRole('menu');
      // Radix names the menu after the button that opens it.
      expect(menu).toHaveAccessibleName('Area attuale: Portale fornitori. Cambia area');
      expect(screen.getByTestId('area-switcher')).toHaveAttribute('aria-expanded', 'true');
      const options = within(menu).getAllByRole('menuitemradio');
      expect(options.map((option) => option.getAttribute('data-testid'))).toEqual([
        'area-option-short-rent',
        'area-option-supplier',
        'area-option-admin',
      ]);
      expect(options[0]).toHaveTextContent('Affitti brevi');
      expect(options[0]).toHaveTextContent('Prenotazioni, calendario, prezzi e sito diretto');
      expect(options[1]).toHaveTextContent('Portale fornitori');
      expect(options[1]).toHaveTextContent('Richieste, disponibilità, servizi e vetrina');
      expect(within(menu).queryByText(/backend/)).not.toBeInTheDocument();
      expect(within(menu).queryByText(/Affitti lunghi/)).not.toBeInTheDocument();
    });

    it('AreaSwitcher_Opened_TicksTheCurrentAreaAndStartsTheFocusOnIt', async () => {
      arrange(['short-rent', 'long-rent', 'supplier']);
      renderSwitcher('long-rent');
      openByKeyboard(screen.getByTestId('area-switcher'));

      const current = await screen.findByRole('menuitemradio', { name: /Affitti lunghi/ });
      expect(current).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('menuitemradio', { name: /Affitti brevi/ })).toHaveAttribute('aria-checked', 'false');
      await waitFor(() => expect(current).toHaveFocus());
    });

    it('AreaSwitcher_ChoosingAnotherArea_OpensIt', async () => {
      arrange(['short-rent', 'long-rent']);
      renderSwitcher('short-rent');
      openByKeyboard(screen.getByTestId('area-switcher'));

      const other = await screen.findByRole('menuitemradio', { name: /Affitti lunghi/ });
      other.focus();
      fireEvent.keyDown(other, { key: 'Enter' });

      await waitFor(() => expect(setActiveContext).toHaveBeenCalledWith('long-rent'));
      expect(setActiveContext).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    });

    it('AreaSwitcher_ChoosingTheCurrentArea_JustClosesTheMenu', async () => {
      arrange(['short-rent', 'long-rent']);
      renderSwitcher('short-rent');
      openByKeyboard(screen.getByTestId('area-switcher'));

      const current = await screen.findByRole('menuitemradio', { name: /Affitti brevi/ });
      current.focus();
      fireEvent.keyDown(current, { key: 'Enter' });

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(setActiveContext).not.toHaveBeenCalled();
    });

    it('AreaSwitcher_ArrowKeys_MoveTheFocusBetweenTheAreas', async () => {
      arrange(['short-rent', 'long-rent', 'supplier']);
      renderSwitcher('short-rent');
      openByKeyboard(screen.getByTestId('area-switcher'));

      const first = await screen.findByRole('menuitemradio', { name: /Affitti brevi/ });
      await waitFor(() => expect(first).toHaveFocus());
      fireEvent.keyDown(first, { key: 'ArrowDown' });
      await waitFor(() => expect(screen.getByRole('menuitemradio', { name: /Affitti lunghi/ })).toHaveFocus());
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
      await waitFor(() => expect(screen.getByRole('menuitemradio', { name: /Portale fornitori/ })).toHaveFocus());
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' });
      await waitFor(() => expect(screen.getByRole('menuitemradio', { name: /Affitti lunghi/ })).toHaveFocus());
    });

    it('AreaSwitcher_Escape_ClosesTheMenuAndGivesTheFocusBackToTheButton', async () => {
      arrange(['short-rent', 'long-rent']);
      renderSwitcher('short-rent');
      const trigger = screen.getByTestId('area-switcher');
      openByKeyboard(trigger);

      const current = await screen.findByRole('menuitemradio', { name: /Affitti brevi/ });
      await waitFor(() => expect(current).toHaveFocus());
      fireEvent.keyDown(current, { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(setActiveContext).not.toHaveBeenCalled();
    });

    it('AreaSwitcher_EnglishUi_ShowsTheEnglishNamesAndDescriptions', async () => {
      await i18n.changeLanguage('en');
      arrange(['short-rent', 'supplier']);
      renderSwitcher('short-rent');

      expect(screen.getByRole('button', { name: 'Current area: Short-term rentals. Change area' })).toBeInTheDocument();
      openByKeyboard(screen.getByTestId('area-switcher'));
      const menu = await screen.findByRole('menu');
      expect(within(menu).getByText('Supplier portal')).toBeInTheDocument();
      expect(within(menu).getByText('Requests, availability, services and showcase')).toBeInTheDocument();
    });

    it('AreaSwitcher_Collapsed_KeepsOnlyTheIconButStillSaysWhereTheUserIs', () => {
      arrange(['short-rent', 'long-rent']);
      renderSwitcher('short-rent', { collapsed: true });

      const trigger = screen.getByRole('button', { name: 'Area attuale: Affitti brevi. Cambia area' });
      expect(trigger).not.toHaveTextContent('Affitti brevi');
      expect(trigger).not.toHaveTextContent('Casa Rossi Srl');
      expect(trigger.querySelector('svg')).not.toBeNull();
    });

    it('AreaSwitcher_CurrentAreaIcon_CarriesTheAccentOfTheArea', () => {
      arrange(['short-rent', 'long-rent']);
      const { container } = renderSwitcher('short-rent');

      const tile = container.querySelector('[data-area]');
      expect(tile).toHaveAttribute('data-area', 'short-rent');
      // The accent is `--color-primary`, which the area sets on <html> (UI-01).
      expect(tile).toHaveClass('bg-primary', 'text-primary-foreground');
    });
  });
});
