import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { DelegaCaptureDialog } from '../delega-capture-dialog';

function renderDialog(
  onConfirm = vi.fn(),
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <DelegaCaptureDialog
        open
        onOpenChange={vi.fn()}
        tosVersion="2026-08-rli-delega-bozza"
        attestationText="Testo bozza da confermare con legale."
        onConfirm={onConfirm}
      />
    </I18nextProvider>,
  );
}

describe('DelegaCaptureDialog', () => {
  beforeEach(() => {
    void i18n.changeLanguage('it');
  });

  it('keeps submit disabled until the attestation is checked', () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);

    const submit = screen.getByRole('button', { name: i18n.t('leases.rli.confirmSubmit') });
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('leases.rli.attestationCheckbox') }));
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledWith({
      tosVersion: '2026-08-rli-delega-bozza',
      attestationAccepted: true,
    });
  });
});
