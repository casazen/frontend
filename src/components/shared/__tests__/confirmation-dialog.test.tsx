import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { ConfirmationDialog } from '../confirmation-dialog';

type Props = Partial<Parameters<typeof ConfirmationDialog>[0]>;

function Harness({ onConfirm = vi.fn(), onOpenChange, ...props }: Props) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        riapri
      </button>
      <ConfirmationDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
        title="Eliminare l'ospite?"
        description="I dati dell'ospite verranno rimossi."
        onConfirm={onConfirm}
        {...props}
      />
    </>
  );
}

const confirmButton = (name = 'Conferma') => screen.getByRole('button', { name });

describe('ConfirmationDialog (UI-07: requireText and consequences)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  describe('as it always was', () => {
    it('ConfirmationDialog_NoNewProps_AsksWithTwoButtonsAndNothingElse', () => {
      render(<Harness />);

      expect(screen.getByRole('dialog', { name: "Eliminare l'ospite?" })).toBeInTheDocument();
      expect(screen.getByText("I dati dell'ospite verranno rimossi.")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Annulla' })).toBeEnabled();
      expect(confirmButton()).toBeEnabled();
      expect(screen.queryByTestId('confirmation-input')).not.toBeInTheDocument();
      expect(screen.queryByTestId('confirmation-consequences')).not.toBeInTheDocument();
    });

    it('ConfirmationDialog_Confirm_RunsTheActionThenCloses', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      const onOpenChange = vi.fn();
      render(<Harness onConfirm={onConfirm} onOpenChange={onOpenChange} />);

      fireEvent.click(confirmButton());

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('ConfirmationDialog_Cancel_ClosesWithoutRunningTheAction', () => {
      const onConfirm = vi.fn();
      const onOpenChange = vi.fn();
      render(<Harness onConfirm={onConfirm} onOpenChange={onOpenChange} />);

      fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('ConfirmationDialog_Loading_DisablesBothButtons', () => {
      render(<Harness isLoading />);

      expect(screen.getByRole('button', { name: 'Annulla' })).toBeDisabled();
      expect(confirmButton()).toBeDisabled();
    });

    it('ConfirmationDialog_CustomLabels_AreUsed', () => {
      render(<Harness confirmLabel="Sì, elimina" cancelLabel="No, torna indietro" variant="destructive" />);

      expect(screen.getByRole('button', { name: 'No, torna indietro' })).toBeInTheDocument();
      expect(confirmButton('Sì, elimina')).toHaveClass('bg-destructive');
    });
  });

  describe('consequences', () => {
    it('ConfirmationDialog_Consequences_AreListedWithAWarningMarkAndANameForTheList', () => {
      render(<Harness consequences={['Le prenotazioni restano', 'Il rimborso va fatto a mano']} />);

      const list = screen.getByRole('list', { name: 'Cosa succede se confermi' });
      const items = screen.getAllByRole('listitem');
      expect(list).toContainElement(items[0]);
      expect(items.map((item) => item.textContent)).toEqual(['Le prenotazioni restano', 'Il rimborso va fatto a mano']);
    });

    it('ConfirmationDialog_NoConsequences_ShowsNoEmptyList', () => {
      render(<Harness consequences={[]} />);

      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  describe('requireText', () => {
    it('ConfirmationDialog_RequireText_TheConfirmButtonWaitsForTheWord', () => {
      render(<Harness requireText="ELIMINA" />);

      expect(screen.getByLabelText('Per confermare scrivi ELIMINA')).toBeInTheDocument();
      expect(confirmButton()).toBeDisabled();

      fireEvent.change(screen.getByTestId('confirmation-input'), { target: { value: 'ELIM' } });
      expect(confirmButton()).toBeDisabled();

      fireEvent.change(screen.getByTestId('confirmation-input'), { target: { value: 'ELIMINA' } });
      expect(confirmButton()).toBeEnabled();
    });

    it('ConfirmationDialog_RequireText_CapitalLettersAndSurroundingSpacesDoNotMatter', () => {
      render(<Harness requireText="ELIMINA" />);

      fireEvent.change(screen.getByTestId('confirmation-input'), { target: { value: '  elimina ' } });

      expect(confirmButton()).toBeEnabled();
    });

    it('ConfirmationDialog_RequireText_TheWordIsInBoldInTheLabel', () => {
      render(<Harness requireText="ELIMINA" />);

      const strong = screen.getByText('ELIMINA');
      expect(strong.tagName).toBe('STRONG');
    });

    it('ConfirmationDialog_RequireTextAndWrongWord_ConfirmDoesNothingNotEvenWithEnter', () => {
      const onConfirm = vi.fn();
      render(<Harness requireText="ELIMINA" onConfirm={onConfirm} />);
      const input = screen.getByTestId('confirmation-input');

      fireEvent.change(input, { target: { value: 'altro' } });
      fireEvent.submit(input.closest('form')!);

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('ConfirmationDialog_RequireTextAndTheRightWord_EnterConfirms', async () => {
      const onConfirm = vi.fn();
      render(<Harness requireText="ELIMINA" onConfirm={onConfirm} />);
      const input = screen.getByTestId('confirmation-input');

      fireEvent.change(input, { target: { value: 'elimina' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    });

    it('ConfirmationDialog_RequireText_WhatWasTypedIsForgottenWhenItOpensAgain', async () => {
      render(<Harness requireText="ELIMINA" />);
      fireEvent.change(screen.getByTestId('confirmation-input'), { target: { value: 'ELIMINA' } });
      fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'riapri' }));

      expect(screen.getByTestId('confirmation-input')).toHaveValue('');
      expect(confirmButton()).toBeDisabled();
    });

    it('ConfirmationDialog_RequireText_TheFieldDoesNotInviteTheBrowserToHelp', () => {
      render(<Harness requireText="ELIMINA" />);

      const input = screen.getByTestId('confirmation-input');
      expect(input).toHaveAttribute('autocomplete', 'off');
      expect(input).toHaveAttribute('autocapitalize', 'off');
      expect(input).toHaveAttribute('spellcheck', 'false');
    });

    it('ConfirmationDialog_RequireTextInEnglish_AsksInEnglish', async () => {
      await i18n.changeLanguage('en');
      render(<Harness requireText="DELETE" />);

      expect(screen.getByLabelText('To confirm, type DELETE')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('ConfirmationDialog_WithEverything_HasNoAxeViolations', async () => {
      render(<Harness requireText="ELIMINA" consequences={['Le prenotazioni restano', 'Il rimborso va fatto a mano']} />);

      await expectNoAxeViolations(document.body);
    });

    it('ConfirmationDialog_Plain_HasNoAxeViolations', async () => {
      render(<Harness />);

      await expectNoAxeViolations(document.body);
    });
  });
});
