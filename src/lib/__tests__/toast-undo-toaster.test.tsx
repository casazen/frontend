import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { AppToaster } from '@/components/shared/app-toaster';
import { expectNoAxeViolations } from '@/test/axe';
import { toastUndo } from '../toast-undo';

/** `toastUndo` with the real `sonner` and the real `AppToaster` of the app, the way a user meets it. */
describe('toastUndo in the toaster of the app (UI-07)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    act(() => {
      toast.dismiss();
    });
    cleanup();
  });

  it('toastUndo_InTheRealToaster_ShowsTheMessageAndAButtonThatUndoes', async () => {
    const undo = vi.fn();
    render(<AppToaster />);

    act(() => {
      toastUndo('Immobile messo in pausa', { undo });
    });

    expect(await screen.findByText('Immobile messo in pausa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));

    await waitFor(() => expect(undo).toHaveBeenCalledTimes(1));
    // The toast goes away after the action is taken.
    await waitFor(() => expect(screen.queryByText('Immobile messo in pausa')).not.toBeInTheDocument(), { timeout: 3000 });
  });

  it('toastUndo_InTheRealToaster_TheButtonIsReachableFromTheKeyboardAsARealButton', async () => {
    render(<AppToaster />);

    act(() => {
      toastUndo('Fatto', { undo: vi.fn() });
    });

    const button = await screen.findByRole('button', { name: 'Annulla' });
    expect(button.tagName).toBe('BUTTON');
    button.focus();
    expect(button).toHaveFocus();
  });

  it('toastUndo_InTheRealToaster_HasNoAxeViolations', async () => {
    const { container } = render(<AppToaster />);

    act(() => {
      toastUndo('Fatto', { undo: vi.fn(), description: 'Lo puoi annullare per qualche secondo' });
    });
    await screen.findByText('Fatto');

    await expectNoAxeViolations(container.ownerDocument.body);
  });
});
