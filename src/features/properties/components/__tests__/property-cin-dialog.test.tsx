import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { PropertyCinDialog } from '../property-cin-dialog';

function renderDialog(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(
    <PropertyCinDialog
      propertyId="prop-1"
      open
      onOpenChange={vi.fn()}
      cinStatus="Missing"
      cinCode={null}
      onSave={onSave}
    />,
  );
  return onSave;
}

describe('PropertyCinDialog', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('handleSave_RealCinWithHyphens_SavesNormalizedCin', async () => {
    const onSave = renderDialog();

    fireEvent.change(screen.getByRole('textbox', { name: 'Codice CIN' }), { target: { value: 'it-058091-c2-7g5ffzdz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva CIN' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('IT058091C27G5FFZDZ'));
  });

  it('handleSave_OldInventedFormat_ShowsErrorAndDoesNotSave', async () => {
    const onSave = renderDialog();

    fireEvent.change(screen.getByRole('textbox', { name: 'Codice CIN' }), { target: { value: 'IT-12345-1234567890' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva CIN' }));

    expect(await screen.findByText(/CIN non valido/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Codice CIN' })).toHaveAttribute('aria-invalid', 'true');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('handleSave_Empty_ClearsCin', async () => {
    const onSave = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Salva CIN' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });
});
