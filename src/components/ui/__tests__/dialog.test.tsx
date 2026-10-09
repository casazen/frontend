import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogContentProps,
} from '../dialog';

function Harness({
  onOpenChange,
  ...contentProps
}: { onOpenChange?: (open: boolean) => void } & Pick<DialogContentProps, 'sheetOnPhone' | 'handle' | 'className'>) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      <DialogContent data-testid="the-dialog" {...contentProps}>
        <DialogHeader>
          <DialogTitle>Cancella la prenotazione</DialogTitle>
          <DialogDescription>Non si può tornare indietro.</DialogDescription>
        </DialogHeader>
        <label>
          Motivo
          <input name="reason" />
        </label>
        <DialogFooter>
          <button type="button">Indietro</button>
          <button type="button">Cancella</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const dialog = () => screen.getByRole('dialog', { name: 'Cancella la prenotazione' });
const handle = () => screen.getByTestId('sheet-handle');

describe('Dialog responsive (UI-07)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  describe('in the middle of the screen, from `sm` up', () => {
    it('Dialog_Default_StaysCenteredWithTheClassesItAlwaysHad', () => {
      render(<Harness />);

      expect(dialog()).toHaveClass(
        'fixed',
        'left-[50%]',
        'top-[50%]',
        'z-50',
        'grid',
        'w-full',
        'max-w-lg',
        'translate-x-[-50%]',
        'translate-y-[-50%]',
        'gap-4',
        'p-6',
        'sm:rounded-lg',
      );
    });

    it('Dialog_WithItsOwnClasses_TheCallerWinsFromSmUpAsItDidBefore', () => {
      render(<Harness className="max-w-4xl max-h-[90vh] overflow-y-auto" />);

      expect(dialog()).toHaveClass('max-w-4xl', 'max-h-[90vh]', 'overflow-y-auto');
      expect(dialog()).not.toHaveClass('max-w-lg');
    });

    it('Dialog_Default_AnimatesOnlyFromSmUpBecauseUnderSmItMovesAsASheet', () => {
      render(<Harness />);

      expect(dialog()).toHaveClass('sm:data-[state=open]:animate-in', 'sm:data-[state=open]:zoom-in-95');
      expect(dialog()).not.toHaveClass('data-[state=open]:animate-in');
    });

    it('Dialog_SheetOnPhoneOff_AnimatesAtEveryWidthLikeBefore', () => {
      render(<Harness sheetOnPhone={false} />);

      expect(dialog()).toHaveClass('data-[state=open]:animate-in', 'data-[state=open]:zoom-in-95');
      expect(dialog()).not.toHaveClass('sm:data-[state=open]:animate-in');
    });
  });

  describe('a sheet from the bottom, under `sm`', () => {
    it('Dialog_Default_ComesUpFromTheBottomEdgeAndStaysClearOfTheHomeIndicator', () => {
      render(<Harness />);

      expect(dialog()).toHaveAttribute('data-dialog-sheet');
      expect(dialog()).toHaveClass(
        'max-sm:bottom-0',
        'max-sm:left-0',
        'max-sm:right-0',
        'max-sm:top-auto',
        'max-sm:max-w-none',
        'max-sm:translate-x-0',
        'max-sm:translate-y-0',
        'max-sm:rounded-t-2xl',
        'max-sm:border-b-0',
      );
      expect(dialog()).toHaveClass('max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]');
      // Nothing above the bar with the grip and the close button: it is the top of the sheet.
      expect(dialog()).toHaveClass('max-sm:pt-0');
    });

    it('Dialog_Default_IsAsTallAsItsContentUpToMostOfTheScreenAndScrollsInside', () => {
      render(<Harness />);

      expect(dialog()).toHaveClass('max-sm:max-h-[92dvh]', 'max-sm:overflow-y-auto', 'max-sm:overscroll-contain');
    });

    it('Dialog_Default_IsAColumnSoThatItsTopBarCanStickWhileTheContentScrolls', () => {
      render(<Harness />);

      expect(dialog()).toHaveClass('max-sm:flex', 'max-sm:flex-col');
    });

    it('Dialog_SheetOnPhoneOff_KeepsTheCenteredBoxOnAPhoneToo', () => {
      render(<Harness sheetOnPhone={false} />);

      expect(dialog()).not.toHaveAttribute('data-dialog-sheet');
      expect(dialog().className).not.toContain('max-sm:');
      expect(screen.queryByTestId('sheet-handle')).not.toBeInTheDocument();
    });

    it('Dialog_Default_HasAGripThatAssistiveTechnologyIgnoresAndOnlyAPhoneShows', () => {
      render(<Harness />);

      expect(handle()).toHaveAttribute('aria-hidden', 'true');
      expect(handle()).toHaveClass('touch-none', 'sm:hidden');
    });

    it('Dialog_HandleOff_HasNoGripButStillHasTheCloseButton', () => {
      render(<Harness handle={false} />);

      expect(screen.queryByTestId('sheet-handle')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Chiudi' })).toBeInTheDocument();
    });

    it('Dialog_Default_HasOneCloseButtonOfTheSizeOfAFingerOnAPhone', () => {
      render(<Harness />);

      const close = screen.getAllByRole('button', { name: 'Chiudi' });
      expect(close).toHaveLength(1);
      expect(close[0]).toHaveClass('max-sm:h-11', 'max-sm:w-11');
      // Where it has always been from `sm` up.
      expect(close[0]).toHaveClass('absolute', 'right-4', 'top-4');
    });

    it('Dialog_Default_TheTopBarIsLastInTheMarkupSoTheFirstFieldTakesTheFocus', () => {
      render(<Harness />);

      const children = [...dialog().children];
      const close = screen.getByRole('button', { name: 'Chiudi' });
      expect(children.at(-1)).toContainElement(close);
      expect(dialog().querySelector('input')).toHaveFocus();
    });

    it('Dialog_DialogHeader_IsLeftAlignedAndClearOfTheCloseButton', () => {
      render(<Harness />);

      const header = screen.getByText('Cancella la prenotazione').parentElement;
      expect(header).toHaveClass('text-left', 'max-sm:pr-10');
      expect(header).not.toHaveClass('text-center');
    });
  });

  describe('closing and focus', () => {
    it('Dialog_Escape_ClosesIt', () => {
      const onOpenChange = vi.fn();
      render(<Harness onOpenChange={onOpenChange} />);

      fireEvent.keyDown(dialog(), { key: 'Escape' });

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Dialog_CloseButton_ClosesIt', () => {
      const onOpenChange = vi.fn();
      render(<Harness onOpenChange={onOpenChange} />);

      fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('Dialog_TabFromTheLastControl_GoesBackToTheFirstOneInsideAndNeverLeavesIt', () => {
      render(<Harness />);
      const close = screen.getByRole('button', { name: 'Chiudi' });
      close.focus();

      fireEvent.keyDown(close, { key: 'Tab' });

      expect(dialog().contains(document.activeElement)).toBe(true);
      expect(document.activeElement).not.toBe(close);
    });

    // Radix gives the focus back on its own only to a DialogTrigger; most dialogs of the app are opened by a button that sets state.
    it('Dialog_OpenedByAButtonThatSetsState_TheFocusGoesBackToThatButtonWhenItCloses', async () => {
      function OpenedByState() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              apri
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent>
                <DialogTitle>Cancella la prenotazione</DialogTitle>
                <DialogDescription>Non si può tornare indietro.</DialogDescription>
                <button type="button">dentro</button>
              </DialogContent>
            </Dialog>
          </>
        );
      }
      render(<OpenedByState />);
      const opener = screen.getByRole('button', { name: 'apri' });
      opener.focus();
      fireEvent.click(opener);
      await waitFor(() => expect(screen.getByRole('button', { name: 'dentro' })).toHaveFocus());

      fireEvent.keyDown(dialog(), { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: 'apri' })).toHaveFocus());
    });

    it('Dialog_OpenerGoneWhileOpen_NothingBreaksAndTheFocusIsNotForcedAnywhere', async () => {
      function OpenerGone() {
        const [open, setOpen] = useState(false);
        return (
          <>
            {open ? null : (
              <button type="button" onClick={() => setOpen(true)}>
                apri
              </button>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent>
                <DialogTitle>Cancella la prenotazione</DialogTitle>
                <DialogDescription>Non si può tornare indietro.</DialogDescription>
              </DialogContent>
            </Dialog>
          </>
        );
      }
      render(<OpenerGone />);
      const opener = screen.getByRole('button', { name: 'apri' });
      opener.focus();
      fireEvent.click(opener);

      fireEvent.keyDown(dialog(), { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(document.activeElement === document.body || document.activeElement === null).toBe(true);
    });

    it('Dialog_IsAModalDialogThatHidesThePageBehindIt', () => {
      const { container } = render(<Harness />);

      expect(dialog()).toHaveAttribute('role', 'dialog');
      expect(container).toHaveAttribute('aria-hidden', 'true');
    });

    it('Dialog_GripPulledFarEnough_ClosesTheDialogAndItFollowedTheFinger', () => {
      const onOpenChange = vi.fn();
      render(<Harness onOpenChange={onOpenChange} />);

      fireEvent.pointerDown(handle(), { pointerId: 1, pointerType: 'touch', clientY: 400 });
      fireEvent.pointerMove(handle(), { pointerId: 1, pointerType: 'touch', clientY: 470 });
      expect(dialog().style.transform).toBe('translateY(70px)');
      fireEvent.pointerUp(handle(), { pointerId: 1, pointerType: 'touch', clientY: 520 });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('Dialog_GripPulledALittle_ComesBackAndStaysOpen', () => {
      const onOpenChange = vi.fn();
      render(<Harness onOpenChange={onOpenChange} />);

      // 20 px is less than a flick needs, however fast.
      fireEvent.pointerDown(handle(), { pointerId: 1, pointerType: 'touch', clientY: 400 });
      fireEvent.pointerMove(handle(), { pointerId: 1, pointerType: 'touch', clientY: 420 });
      fireEvent.pointerUp(handle(), { pointerId: 1, pointerType: 'touch', clientY: 420 });

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(dialog().style.transform).toBe('');
    });
  });

  describe('accessibility', () => {
    it('Dialog_Open_HasNoAxeViolations', async () => {
      render(<Harness />);

      await expectNoAxeViolations(document.body);
    });

    it('Dialog_OpenWithoutTheSheet_HasNoAxeViolations', async () => {
      render(<Harness sheetOnPhone={false} />);

      await expectNoAxeViolations(document.body);
    });
  });
});
