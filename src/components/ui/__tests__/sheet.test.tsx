import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import i18n from '@/i18n/config';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../sheet';

function Harness({
  side,
  onOpenChange,
}: {
  side?: 'left' | 'right' | 'bottom';
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      <SheetContent side={side} aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Altro</SheetTitle>
        </SheetHeader>
        <button type="button">dentro</button>
      </SheetContent>
    </Sheet>
  );
}

const dialog = () => screen.getByRole('dialog', { name: 'Altro' });
const handle = () => screen.getByTestId('sheet-handle');

/** A finger (or a mouse) pulls the handle down by `distance` px. */
function pull(distance: number, { release = true }: { release?: boolean } = {}) {
  fireEvent.pointerDown(handle(), { pointerId: 1, pointerType: 'touch', clientY: 400 });
  fireEvent.pointerMove(handle(), { pointerId: 1, pointerType: 'touch', clientY: 400 + distance });
  if (release) fireEvent.pointerUp(handle(), { pointerId: 1, pointerType: 'touch', clientY: 400 + distance });
}

describe('Sheet from the bottom (UI-04b)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('layout', () => {
    it('Sheet_Bottom_ComesUpFromTheBottomEdgeAndStaysClearOfTheHomeIndicator', () => {
      render(<Harness side="bottom" />);

      expect(dialog()).toHaveAttribute('data-sheet-side', 'bottom');
      expect(dialog()).toHaveClass('inset-x-0', 'bottom-0', 'h-auto', 'rounded-t-2xl');
      expect(dialog()).toHaveClass('pb-[env(safe-area-inset-bottom)]');
      expect(dialog()).toHaveClass('max-h-[85dvh]');
      expect(dialog()).not.toHaveClass('h-full');
    });

    it('Sheet_Bottom_HasAHandleThatAssistiveTechnologyIgnores', () => {
      render(<Harness side="bottom" />);

      expect(handle()).toHaveAttribute('aria-hidden', 'true');
      expect(handle()).toHaveClass('touch-none');
    });

    it('Sheet_Bottom_HasACloseButtonOfTheSizeOfAFinger', () => {
      render(<Harness side="bottom" />);

      const close = screen.getByRole('button', { name: 'Chiudi' });
      expect(close).toHaveClass('h-11', 'w-11');
    });

    it('Sheet_Bottom_DimsThePageLessThanTheSideSheetsDo', () => {
      render(<Harness side="bottom" />);

      const overlay = document.querySelector('[data-sheet-overlay="bottom"]');
      expect(overlay).toHaveClass('bg-black/50');
      expect(overlay).not.toHaveClass('bg-black/80');
    });

    it.each(['left', 'right'] as const)('Sheet_%sSide_IsAsItWasWithNoHandle', (side) => {
      render(<Harness side={side} />);

      expect(dialog()).toHaveAttribute('data-sheet-side', side);
      expect(dialog()).toHaveClass('h-full', 'inset-y-0');
      expect(screen.queryByTestId('sheet-handle')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Chiudi' })).not.toHaveClass('h-11');
      expect(document.querySelector('[data-sheet-overlay]')).toHaveClass('bg-black/80');
    });
  });

  describe('closing', () => {
    it('Sheet_Bottom_EscapeClosesIt', () => {
      const onOpenChange = vi.fn();
      render(<Harness side="bottom" onOpenChange={onOpenChange} />);

      fireEvent.keyDown(dialog(), { key: 'Escape' });

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Sheet_Bottom_CloseButtonClosesIt', () => {
      const onOpenChange = vi.fn();
      render(<Harness side="bottom" onOpenChange={onOpenChange} />);

      fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('Sheet_Bottom_ATapOnTheDimmedPageClosesIt', async () => {
      const onOpenChange = vi.fn();
      render(<Harness side="bottom" onOpenChange={onOpenChange} />);
      // Radix starts listening for a press outside the sheet one tick after it opens.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      fireEvent.pointerDown(document.querySelector('[data-sheet-overlay="bottom"]') as HTMLElement);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('Sheet_Bottom_IsAModalDialogThatHidesThePageBehindIt', () => {
      const { container } = render(<Harness side="bottom" />);

      expect(dialog()).toHaveAttribute('role', 'dialog');
      expect(container).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('pulling the handle down', () => {
    it('Sheet_PulledByTheHandle_FollowsTheFinger', () => {
      render(<Harness side="bottom" />);

      pull(60, { release: false });

      expect(dialog().style.transform).toBe('translateY(60px)');
      // No easing while it follows the finger, and the closing animation starts from where it is.
      expect(dialog().style.transition).toBe('none');
      expect(dialog().style.getPropertyValue('--sheet-drag')).toBe('60px');
    });

    it('Sheet_PulledUpward_DoesNotMove', () => {
      render(<Harness side="bottom" />);

      pull(-80, { release: false });

      expect(dialog().style.transform).toBe('');
    });

    it('Sheet_PulledFarEnough_Closes', () => {
      vi.useFakeTimers();
      const onOpenChange = vi.fn();
      render(<Harness side="bottom" onOpenChange={onOpenChange} />);

      fireEvent.pointerDown(handle(), { pointerId: 1, pointerType: 'touch', clientY: 400 });
      vi.advanceTimersByTime(900);
      fireEvent.pointerMove(handle(), { pointerId: 1, pointerType: 'touch', clientY: 520 });
      fireEvent.pointerUp(handle(), { pointerId: 1, pointerType: 'touch', clientY: 520 });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('Sheet_PulledALittleSlowly_ComesBack', () => {
      vi.useFakeTimers();
      const onOpenChange = vi.fn();
      render(<Harness side="bottom" onOpenChange={onOpenChange} />);

      fireEvent.pointerDown(handle(), { pointerId: 1, pointerType: 'touch', clientY: 400 });
      vi.advanceTimersByTime(900);
      fireEvent.pointerMove(handle(), { pointerId: 1, pointerType: 'touch', clientY: 460 });
      fireEvent.pointerUp(handle(), { pointerId: 1, pointerType: 'touch', clientY: 460 });

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(dialog().style.transform).toBe('');
      expect(dialog().style.transition).toBe('transform 200ms ease-out');
    });

    it('Sheet_FlickedDownQuickly_ClosesEvenWhenItWentNotFar', () => {
      vi.useFakeTimers();
      const onOpenChange = vi.fn();
      render(<Harness side="bottom" onOpenChange={onOpenChange} />);

      fireEvent.pointerDown(handle(), { pointerId: 1, pointerType: 'touch', clientY: 400 });
      vi.advanceTimersByTime(40);
      fireEvent.pointerMove(handle(), { pointerId: 1, pointerType: 'touch', clientY: 450 });
      fireEvent.pointerUp(handle(), { pointerId: 1, pointerType: 'touch', clientY: 450 });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('Sheet_PullCancelledByTheSystem_ComesBack', () => {
      const onOpenChange = vi.fn();
      render(<Harness side="bottom" onOpenChange={onOpenChange} />);

      pull(200, { release: false });
      fireEvent.pointerCancel(handle(), { pointerId: 1, pointerType: 'touch', clientY: 600 });

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(dialog().style.transform).toBe('');
    });

    it('Sheet_RightClickOnTheHandle_DoesNotStartADrag', () => {
      render(<Harness side="bottom" />);

      fireEvent.pointerDown(handle(), { pointerId: 1, pointerType: 'mouse', button: 2, clientY: 400 });
      fireEvent.pointerMove(handle(), { pointerId: 1, pointerType: 'mouse', clientY: 520 });

      expect(dialog().style.transform).toBe('');
    });

    it('Sheet_OpenedAgainAfterADrag_StartsWhereItShould', () => {
      function Reopen() {
        const [open, setOpen] = useState(true);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              apri
            </button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetContent side="bottom" aria-describedby={undefined}>
                <SheetTitle>Altro</SheetTitle>
              </SheetContent>
            </Sheet>
          </>
        );
      }
      render(<Reopen />);
      pull(300);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'apri' }));

      // A new element: nothing is left of the drag that closed the old one.
      expect(dialog().style.transform).toBe('');
    });
  });
});
