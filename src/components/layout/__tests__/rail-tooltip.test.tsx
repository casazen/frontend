import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { tabTo } from '@/test/keyboard';
import { useRailTooltip } from '../rail-tooltip';

function Icon({ enabled = true, label = 'Calendario' }: { enabled?: boolean; label?: string }) {
  const { triggerProps, tooltip } = useRailTooltip(label, enabled);
  return (
    <aside data-testid="rail">
      <button type="button" {...triggerProps}>
        {label}
      </button>
      {tooltip}
    </aside>
  );
}

const button = () => screen.getByRole('button');
const tooltip = () => screen.queryByTestId('rail-tooltip');

describe('useRailTooltip (UI-04b)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('hover', () => {
    it('useRailTooltip_PointerOnTheIcon_ShowsItsNameAndHidesItWhenThePointerLeaves', () => {
      render(<Icon />);
      expect(tooltip()).not.toBeInTheDocument();

      fireEvent.pointerEnter(button(), { pointerType: 'mouse' });
      expect(tooltip()).toHaveTextContent('Calendario');

      fireEvent.pointerLeave(button(), { pointerType: 'mouse' });
      expect(tooltip()).not.toBeInTheDocument();
    });

    it('useRailTooltip_AFinger_ShowsNothing', () => {
      render(<Icon />);

      // A tap has no hover: the name would only flash while the page opens.
      fireEvent.pointerEnter(button(), { pointerType: 'touch' });

      expect(tooltip()).not.toBeInTheDocument();
    });
  });

  describe('keyboard', () => {
    it('useRailTooltip_KeyboardFocusOnTheIcon_ShowsItsName', () => {
      render(<Icon />);

      tabTo(button());

      expect(tooltip()).toHaveTextContent('Calendario');
    });

    it('useRailTooltip_FocusLeavesTheIcon_HidesIt', () => {
      render(<Icon />);
      tabTo(button());

      act(() => button().blur());

      expect(tooltip()).not.toBeInTheDocument();
    });

    it('useRailTooltip_Escape_HidesItWhileTheFocusStaysOnTheIcon', () => {
      render(<Icon />);
      tabTo(button());
      expect(tooltip()).toBeInTheDocument();

      fireEvent.keyDown(document.body, { key: 'Escape' });

      expect(tooltip()).not.toBeInTheDocument();
      expect(button()).toHaveFocus();
    });

    it('useRailTooltip_AnotherKey_LeavesItThere', () => {
      render(<Icon />);
      tabTo(button());

      fireEvent.keyDown(document.body, { key: 'ArrowDown' });

      expect(tooltip()).toBeInTheDocument();
    });

    it('useRailTooltip_FocusThatIsNotTheKeyboards_ShowsNothing', () => {
      render(<Icon />);
      const target = button();
      vi.spyOn(target, 'matches').mockReturnValue(false);

      // A click that gives a button the focus does not call for a tooltip.
      act(() => target.focus());

      expect(tooltip()).not.toBeInTheDocument();
    });

    it('useRailTooltip_BrowserWithoutFocusVisible_TreatsAnyFocusAsTheKeyboards', () => {
      render(<Icon />);
      const target = button();
      vi.spyOn(target, 'matches').mockImplementation(() => {
        throw new SyntaxError('not a valid selector');
      });

      act(() => target.focus());

      expect(tooltip()).toBeInTheDocument();
    });
  });

  describe('where it shows', () => {
    it('useRailTooltip_Shown_IsOutsideTheSidebarAndHiddenFromAssistiveTechnology', () => {
      render(<Icon />);
      tabTo(button());

      const shown = screen.getByTestId('rail-tooltip');
      // In the body: the menu scrolls and clips what overflows it. The icon already has its name for a screen reader.
      expect(shown.parentElement).toBe(document.body);
      expect(screen.getByTestId('rail')).not.toContainElement(shown);
      expect(shown).toHaveAttribute('aria-hidden', 'true');
      expect(shown).toHaveClass('pointer-events-none', 'fixed');
    });

    it('useRailTooltip_Shown_SitsBesideTheEdgeOfTheSidebarAtTheHeightOfTheIcon', () => {
      render(<Icon />);
      vi.spyOn(screen.getByTestId('rail'), 'getBoundingClientRect').mockReturnValue({ right: 72 } as DOMRect);
      vi.spyOn(button(), 'getBoundingClientRect').mockReturnValue({ top: 100, height: 40, right: 60 } as DOMRect);

      tabTo(button());

      // 8 px from the edge of the sidebar (not of the icon, which has the padding of the menu around it); centered on the icon.
      expect(screen.getByTestId('rail-tooltip')).toHaveStyle({ top: '120px', left: '80px' });
    });

    it('useRailTooltip_ScrollingTheMenu_HidesIt', () => {
      render(<Icon />);
      tabTo(button());
      expect(tooltip()).toBeInTheDocument();

      // The menu scrolls inside the sidebar: a scroll event does not bubble, the listener is on the capture phase.
      fireEvent.scroll(screen.getByTestId('rail'));

      expect(tooltip()).not.toBeInTheDocument();
    });

    it('useRailTooltip_LabelChanges_TheShownNameFollows', () => {
      const { rerender } = render(<Icon label="Calendario" />);
      tabTo(button());

      rerender(<Icon label="Calendar" />);

      expect(screen.getByTestId('rail-tooltip')).toHaveTextContent('Calendar');
    });
  });

  describe('one at a time', () => {
    function Two() {
      return (
        <>
          <Icon label="Calendario" />
          <Icon label="Immobili" />
        </>
      );
    }
    const named = (name: string) => screen.getByRole('button', { name });

    it('useRailTooltip_FocusOnOneIconAndPointerOnAnother_ShowsOnlyTheLastOneAskedFor', () => {
      render(<Two />);

      tabTo(named('Calendario'));
      expect(screen.getAllByTestId('rail-tooltip')).toHaveLength(1);
      expect(screen.getByTestId('rail-tooltip')).toHaveTextContent('Calendario');

      fireEvent.pointerEnter(named('Immobili'), { pointerType: 'mouse' });
      expect(screen.getAllByTestId('rail-tooltip')).toHaveLength(1);
      expect(screen.getByTestId('rail-tooltip')).toHaveTextContent('Immobili');
    });

    it('useRailTooltip_PointerLeavesTheOtherIcon_ShowsNothingNotTheOldOne', () => {
      render(<Two />);
      tabTo(named('Calendario'));
      fireEvent.pointerEnter(named('Immobili'), { pointerType: 'mouse' });

      fireEvent.pointerLeave(named('Immobili'), { pointerType: 'mouse' });

      expect(tooltip()).not.toBeInTheDocument();
    });

    it('useRailTooltip_NewFocus_ReplacesTheTooltipOfTheIconThatHadIt', () => {
      render(<Two />);
      tabTo(named('Calendario'));

      tabTo(named('Immobili'));

      expect(screen.getAllByTestId('rail-tooltip')).toHaveLength(1);
      expect(screen.getByTestId('rail-tooltip')).toHaveTextContent('Immobili');
    });

    it('useRailTooltip_IconGoesAwayWhileItShows_LeavesNothingBehind', () => {
      const { unmount } = render(<Two />);
      tabTo(named('Calendario'));
      unmount();

      render(<Icon label="Prenotazioni" />);
      fireEvent.pointerEnter(screen.getByRole('button', { name: 'Prenotazioni' }), { pointerType: 'mouse' });

      expect(screen.getByTestId('rail-tooltip')).toHaveTextContent('Prenotazioni');
    });
  });

  describe('when the sidebar is wide', () => {
    it('useRailTooltip_Disabled_NeverShowsAnything', () => {
      render(<Icon enabled={false} />);

      fireEvent.pointerEnter(button(), { pointerType: 'mouse' });
      expect(tooltip()).not.toBeInTheDocument();
      tabTo(button());
      expect(tooltip()).not.toBeInTheDocument();
    });

    it('useRailTooltip_SidebarGrowsWhileItShows_TheNameGoesAway', () => {
      const { rerender } = render(<Icon enabled />);
      tabTo(button());
      expect(tooltip()).toBeInTheDocument();

      rerender(<Icon enabled={false} />);

      expect(tooltip()).not.toBeInTheDocument();
    });
  });
});
