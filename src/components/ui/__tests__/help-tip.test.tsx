import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { stubViewportWidth } from '@/test/viewport';
import { expectNoAxeViolations } from '@/test/axe';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../dialog';
import { HelpTip, type HelpTipProps } from '../help-tip';

const TEXT = 'Il codice che identifica la casa in tutta Italia.';

function renderTip(props: Partial<HelpTipProps> = {}) {
  return render(
    <MemoryRouter initialEntries={['/app/short-rent/properties']}>
      <Routes>
        <Route
          path="/app/short-rent/properties"
          element={
            <p>
              Codice CIN <HelpTip {...props}>{TEXT}</HelpTip>
            </p>
          }
        />
        <Route path="/app/short-rent/help/cin" element={<p>pagina-cin</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const trigger = (name = 'Maggiori informazioni') => screen.getByRole('button', { name });

/** Radix starts listening for a press outside one tick after something opens. */
const nextTick = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

describe('HelpTip (UI-07)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('the button', () => {
    it('HelpTip_Default_IsAButtonNamedAfterWhatItIsFor', () => {
      renderTip();

      expect(trigger()).toHaveAttribute('type', 'button');
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
      expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    });

    it('HelpTip_WithATitle_TheButtonIsNamedAfterIt', () => {
      renderTip({ title: 'Codice CIN' });

      expect(trigger("Cos'è: Codice CIN")).toBeInTheDocument();
    });

    it('HelpTip_WithALabel_TheLabelWins', () => {
      renderTip({ title: 'Codice CIN', label: 'Spiegazione del CIN' });

      expect(trigger('Spiegazione del CIN')).toBeInTheDocument();
    });

    it('HelpTip_InEnglish_IsNamedInEnglish', async () => {
      await i18n.changeLanguage('en');
      renderTip({ title: 'CIN code' });

      expect(trigger('About: CIN code')).toBeInTheDocument();
    });

    it('HelpTip_Button_HasATargetOf44PxAroundTheSmallIcon', () => {
      renderTip();

      expect(trigger()).toHaveClass('h-5', 'w-5', 'before:-inset-3');
    });

    it('HelpTip_Closed_ShowsNothingAndHoverDoesNotOpenIt', () => {
      renderTip();

      fireEvent.pointerEnter(trigger());
      fireEvent.mouseEnter(trigger());
      fireEvent.mouseOver(trigger());

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
    });
  });

  describe('a bubble, on a tablet or a desktop', () => {
    it('HelpTip_Click_OpensABubbleWithTheTitleAndTheText', () => {
      renderTip({ title: 'Codice CIN' });

      fireEvent.click(trigger("Cos'è: Codice CIN"));

      const bubble = screen.getByRole('dialog', { name: 'Codice CIN' });
      expect(bubble).toHaveTextContent('Codice CIN');
      expect(bubble).toHaveTextContent(TEXT);
      expect(bubble).toHaveAccessibleDescription(TEXT);
      expect(trigger("Cos'è: Codice CIN")).toHaveAttribute('aria-expanded', 'true');
    });

    it('HelpTip_NoTitle_TheBubbleTakesItsNameFromTheButton', () => {
      renderTip();

      fireEvent.click(trigger());

      expect(screen.getByRole('dialog', { name: 'Maggiori informazioni' })).toHaveTextContent(TEXT);
    });

    it('HelpTip_Opened_TheFocusGoesToTheBubbleNotToTheLink', () => {
      renderTip({ learnMoreHref: '/app/short-rent/help/cin' });

      fireEvent.click(trigger());

      expect(screen.getByRole('dialog')).toHaveFocus();
    });

    it('HelpTip_ClickAgain_ClosesIt', async () => {
      renderTip();
      fireEvent.click(trigger());
      await nextTick();

      fireEvent.click(trigger());

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    });

    it('HelpTip_Escape_ClosesItAndTheFocusGoesBackToTheButton', async () => {
      renderTip();
      trigger().focus();
      fireEvent.click(trigger());

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(trigger()).toHaveFocus());
    });

    it('HelpTip_ClickOutside_ClosesIt', async () => {
      renderTip();
      fireEvent.click(trigger());
      await nextTick();

      fireEvent.pointerDown(document.body);

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('HelpTip_Bubble_IsASeparateDialogFromAnySheet', () => {
      renderTip();

      fireEvent.click(trigger());

      expect(screen.getByTestId('help-tip-popover')).toBeInTheDocument();
      expect(screen.queryByTestId('help-tip-sheet')).not.toBeInTheDocument();
    });
  });

  describe('the link "Scopri di più"', () => {
    it('HelpTip_NoHref_HasNoLink', () => {
      renderTip();

      fireEvent.click(trigger());

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('HelpTip_InternalHref_IsALinkOfTheAppThatClosesTheBubbleAndGoesThere', async () => {
      renderTip({ learnMoreHref: '/app/short-rent/help/cin' });
      fireEvent.click(trigger());

      const link = screen.getByRole('link', { name: 'Scopri di più' });
      expect(link).toHaveAttribute('href', '/app/short-rent/help/cin');
      expect(link).not.toHaveAttribute('target');
      fireEvent.click(link);

      expect(await screen.findByText('pagina-cin')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('HelpTip_ExternalHref_OpensInANewTabWithoutGivingTheOpenerAway', () => {
      renderTip({ learnMoreHref: 'https://www.interno.gov.it/cin', learnMoreLabel: 'Leggi la guida' });
      fireEvent.click(trigger());

      const link = screen.getByRole('link', { name: 'Leggi la guida' });
      expect(link).toHaveAttribute('href', 'https://www.interno.gov.it/cin');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('HelpTip_TabFromTheBubble_ReachesTheLink', () => {
      renderTip({ learnMoreHref: '/app/short-rent/help/cin' });
      fireEvent.click(trigger());

      const link = screen.getByRole('link', { name: 'Scopri di più' });
      link.focus();

      expect(link).toHaveFocus();
    });
  });

  describe('a sheet from the bottom, on a phone', () => {
    beforeEach(() => {
      stubViewportWidth(390);
    });

    it('HelpTip_Tap_OpensASheetFromTheBottomWithTheTitleAndTheText', () => {
      renderTip({ title: 'Codice CIN', learnMoreHref: '/app/short-rent/help/cin' });

      fireEvent.click(trigger("Cos'è: Codice CIN"));

      const sheet = screen.getByRole('dialog', { name: 'Codice CIN' });
      expect(sheet).toHaveAttribute('data-sheet-side', 'bottom');
      expect(sheet).toHaveAccessibleDescription(TEXT);
      expect(screen.queryByTestId('help-tip-popover')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Scopri di più' })).toBeInTheDocument();
    });

    it('HelpTip_Sheet_HasAHandleAndACloseButtonOfTheSizeOfAFinger', () => {
      renderTip({ title: 'Codice CIN' });

      fireEvent.click(trigger("Cos'è: Codice CIN"));

      expect(screen.getByTestId('sheet-handle')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Chiudi' })).toHaveClass('h-11', 'w-11');
    });

    it('HelpTip_Sheet_EscapeClosesItAndTheFocusGoesBackToTheButton', async () => {
      renderTip({ title: 'Codice CIN' });
      trigger("Cos'è: Codice CIN").focus();
      fireEvent.click(trigger("Cos'è: Codice CIN"));

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(trigger("Cos'è: Codice CIN")).toHaveFocus());
    });

    it('HelpTip_Sheet_ClosingButtonClosesIt', async () => {
      renderTip();
      fireEvent.click(trigger());

      fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('HelpTip_Sheet_TheLinkClosesItAndGoesThere', async () => {
      renderTip({ learnMoreHref: '/app/short-rent/help/cin' });
      fireEvent.click(trigger());

      fireEvent.click(screen.getByRole('link', { name: 'Scopri di più' }));

      expect(await screen.findByText('pagina-cin')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('HelpTip_TurnedToLandscape_TheOpenTipBecomesABubbleWithTheSameText', async () => {
      const viewport = stubViewportWidth(390);
      renderTip({ title: 'Codice CIN' });
      fireEvent.click(trigger("Cos'è: Codice CIN"));
      expect(screen.getByTestId('help-tip-sheet')).toBeInTheDocument();

      act(() => viewport.resize(900));

      expect(await screen.findByTestId('help-tip-popover')).toHaveTextContent(TEXT);
      expect(screen.queryByTestId('help-tip-sheet')).not.toBeInTheDocument();
    });
  });

  describe('inside a dialog', () => {
    function InsideADialog() {
      return (
        <MemoryRouter>
          <Dialog open>
            <DialogContent>
              <DialogTitle>Collega il calendario</DialogTitle>
              <DialogDescription>Incolla il link.</DialogDescription>
              <label>
                Link iCal <HelpTip title="iCal">Un indirizzo che il calendario aggiorna da solo.</HelpTip>
              </label>
            </DialogContent>
          </Dialog>
        </MemoryRouter>
      );
    }

    it('HelpTip_InADialog_EscapeClosesTheTipFirstAndTheDialogAfterIt', async () => {
      render(<InsideADialog />);
      fireEvent.click(screen.getByRole('button', { name: "Cos'è: iCal" }));
      await nextTick();
      expect(screen.getByRole('dialog', { name: 'iCal' })).toBeInTheDocument();

      fireEvent.keyDown(screen.getByRole('dialog', { name: 'iCal' }), { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'iCal' })).not.toBeInTheDocument());
      // The dialog under it is still there.
      expect(screen.getByRole('dialog', { name: 'Collega il calendario' })).toBeInTheDocument();
    });

    it('HelpTip_OnAPhoneInADialog_TheSheetOpensOverTheDialog', () => {
      stubViewportWidth(390);
      render(<InsideADialog />);

      fireEvent.click(screen.getByRole('button', { name: "Cos'è: iCal" }));

      expect(screen.getByRole('dialog', { name: 'iCal' })).toHaveAttribute('data-sheet-side', 'bottom');
    });
  });

  describe('accessibility', () => {
    it('HelpTip_ClosedAndOpenAsABubble_HaveNoAxeViolations', async () => {
      const { container } = renderTip({ title: 'Codice CIN', learnMoreHref: '/app/short-rent/help/cin' });
      await expectNoAxeViolations(container);

      fireEvent.click(trigger("Cos'è: Codice CIN"));
      await expectNoAxeViolations(document.body);
    });

    it('HelpTip_OpenAsASheetOnAPhone_HasNoAxeViolations', async () => {
      stubViewportWidth(390);
      renderTip({ title: 'Codice CIN', learnMoreHref: '/app/short-rent/help/cin' });

      fireEvent.click(trigger("Cos'è: Codice CIN"));

      await expectNoAxeViolations(document.body);
    });
  });
});
