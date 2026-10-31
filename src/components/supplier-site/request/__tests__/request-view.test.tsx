import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { PublicBookingView } from '@/api/public-supplier-booking.api';
import { RequestView } from '../request-view';

/**
 * The two presses that move money or stop it (SP-15c-d): "Tutto a posto" releases the funds to the supplier at once and closes the time
 * to complain, "Segnala un problema" stops the release. Neither may happen on the first touch of a button.
 */
const none = { canCancel: false, canReschedule: false, canRespondToProposal: false, canRespondToQuote: false, canConfirmOk: false, canReportProblem: false, canWithdrawProblem: false };

const heldView: PublicBookingView = {
  publicCode: '7K2XM-9QD4T',
  status: 'Completato',
  service: { name: 'Pulizia profonda', slug: 'pulizia-profonda' },
  supplier: { name: 'Rossi Servizi', slug: 'rossi-servizi' },
  startUtc: '2026-11-13T08:00:00Z',
  endUtc: '2026-11-13T10:00:00Z',
  startLocal: '2026-11-13T09:00:00+01:00',
  endLocal: '2026-11-13T11:00:00+01:00',
  place: { city: 'Monza', address: 'Via Roma 12' },
  price: { currency: 'EUR', amountCents: 9000, basis: 'final', lines: [] },
  cancellationTerms: { freeUntilUtc: '2026-11-12T08:00:00Z', freeUntilLocal: '2026-11-12T09:00:00+01:00', isFree: true },
  actions: { ...none, canConfirmOk: true, canReportProblem: true },
  payment: { status: 'held', amountCents: 9000, currency: 'EUR', refundedCents: 0, releaseAtUtc: '2099-11-13T11:00:00Z', releaseAtLocal: '2099-11-13T12:00:00+01:00' },
};

function renderView(view: PublicBookingView, act = vi.fn().mockResolvedValue(true), quiet = vi.fn().mockResolvedValue({ ok: true })) {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <RequestView view={view} failure={null} pending={false} act={act} quiet={quiet} />
      </MemoryRouter>
    </I18nextProvider>,
  );
  return act;
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => cleanup());

describe('La mia richiesta: the money', () => {
  it('TuttoAPosto_FirstPress_OnlyAsksTheQuestion_TheSecondPressMovesTheMoney', () => {
    const act = renderView(heldView);

    fireEvent.click(screen.getByRole('button', { name: 'Tutto a posto' }));

    expect(act).not.toHaveBeenCalled();
    expect(screen.getByTestId('supplier-request-confirm-ok-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sì, è tutto a posto' }));

    expect(act).toHaveBeenCalledTimes(1);
  });

  it('TuttoAPosto_NotOffered_WhenTheServerDoesNotAllowIt', () => {
    renderView({ ...heldView, actions: { ...none, canReportProblem: true } });

    expect(screen.queryByRole('button', { name: 'Tutto a posto' })).toBeNull();
  });

  it('SegnalaUnProblema_WithoutAReason_DoesNotSendAnything_WithOne_SendsOnce', () => {
    const act = renderView(heldView);

    fireEvent.click(screen.getByRole('button', { name: 'Segnala un problema' }));
    fireEvent.click(screen.getByRole('button', { name: 'Invia la segnalazione' }));

    expect(act).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Il lavoro è incompleto'));
    fireEvent.click(screen.getByRole('button', { name: 'Invia la segnalazione' }));

    expect(act).toHaveBeenCalledTimes(1);
  });

  it('SegnalaUnProblema_ReasonOther_NeedsTheWords', () => {
    const act = renderView(heldView);

    fireEvent.click(screen.getByRole('button', { name: 'Segnala un problema' }));
    fireEvent.click(screen.getByLabelText('Altro'));
    fireEvent.click(screen.getByRole('button', { name: 'Invia la segnalazione' }));

    expect(act).not.toHaveBeenCalled();
  });

  it('PaymentBlock_Held_SaysWhoHoldsItAndUntilWhenAProblemCanBeReported_NoDateOfAccounting', () => {
    renderView(heldView);

    const block = screen.getByTestId('supplier-request-payment');
    expect(block).toHaveTextContent('trattiene CasaZen');
    expect(block).toHaveTextContent('Puoi segnalare un problema fino a');
    expect(block.textContent ?? '').not.toMatch(/\b\d+\s*(giorni|giorno)\b/i);
  });
});
