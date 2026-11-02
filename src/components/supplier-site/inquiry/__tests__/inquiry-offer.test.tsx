import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { publicBookingApi, type PublicBookingAccess, type PublicBookingOffer, type PublicBookingView } from '@/api/public-supplier-booking.api';
import { RequestView } from '../../request/request-view';
import type { QuietCall } from '../types';

/**
 * The answer to an offer of a request on measure (SP-12c) is the press that moves money: "Accetta e paga" starts the block of the card, and it
 * must carry the version of the offer the customer read (`offer.sentAt`), so that an offer the supplier replaced meanwhile is never accepted
 * by mistake. Nothing is asked before the press.
 */
const access: PublicBookingAccess = { slug: 'rossi-servizi', code: '7K2XM-9QD4T', email: 'cliente@example.test' };
const none = { canCancel: false, canReschedule: false, canRespondToProposal: false, canRespondToQuote: false, canConfirmOk: false, canReportProblem: false, canWithdrawProblem: false };

const offer: PublicBookingOffer = {
  sentAt: '2026-11-10T08:00:00Z',
  lines: [
    { label: 'Pulizia vetri', quantity: 2, unitAmountCents: 4500, amountCents: 9000 },
    { label: 'Balcone', quantity: 1, unitAmountCents: 2000, amountCents: 2000 },
  ],
  totalCents: 11000,
  currency: 'EUR',
  startUtc: '2099-11-13T08:00:00Z',
  endUtc: '2099-11-13T10:00:00Z',
  startLocal: '2099-11-13T09:00:00+01:00',
  endLocal: '2099-11-13T11:00:00+01:00',
  validUntil: '2099-11-11T08:00:00Z',
  paymentRequired: true,
};

const view: PublicBookingView = {
  publicCode: '7K2XM-9QD4T',
  status: 'Richiesto',
  kind: 'Custom',
  negotiation: 'OfferSent',
  offer,
  service: { name: 'Pulizia vetri', slug: null },
  supplier: { name: 'Rossi Servizi', slug: 'rossi-servizi' },
  startUtc: '2026-11-10T07:00:00Z',
  endUtc: '2026-11-10T07:00:00Z',
  startLocal: '2026-11-10T08:00:00+01:00',
  endLocal: '2026-11-10T08:00:00+01:00',
  place: { city: 'Milano' },
  price: { currency: 'EUR', lines: [] },
  cancellationTerms: { freeUntilUtc: '2026-11-10T07:00:00Z', freeUntilLocal: '2026-11-10T08:00:00+01:00', isFree: true },
  actions: { ...none, canCancel: true, canRespondToOffer: true },
};

/** A quiet call that runs what it is given with the credentials, as the hook of the page does, and answers `outcome`. */
const quietWith = (outcome: Awaited<ReturnType<QuietCall>>) =>
  vi.fn<QuietCall>(async (call) => {
    await call(access);
    return outcome;
  });

function renderView(quiet: QuietCall, shown: PublicBookingView = view) {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <RequestView view={shown} failure={null} pending={false} act={vi.fn().mockResolvedValue(true)} quiet={quiet} />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('La mia richiesta: the offer of a request on measure', () => {
  it('Offer_IsShownWithItsLinesItsTotalAndTheNoteThatTheTimeIsNotReserved', () => {
    renderView(quietWith({ ok: true }));

    const card = screen.getByTestId('supplier-inquiry-offer');
    expect(card).toHaveTextContent('Pulizia vetri');
    expect(card).toHaveTextContent('Balcone');
    expect(card).toHaveTextContent('non è riservato');
  });

  it('AcceptAndPay_NothingIsAskedBeforeThePress_ThenTheVersionOfTheOfferIsSentOnce', async () => {
    const accept = vi.spyOn(publicBookingApi, 'acceptOffer').mockResolvedValue(view);
    const quiet = quietWith({ ok: true });
    renderView(quiet);

    expect(quiet).not.toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('supplier-inquiry-offer-accept'));

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(1));
    expect(accept).toHaveBeenCalledWith(access, offer.sentAt);
  });

  it('NotInterested_TurnsDownTheSameVersion_AndNeverAccepts', async () => {
    const accept = vi.spyOn(publicBookingApi, 'acceptOffer').mockResolvedValue(view);
    const decline = vi.spyOn(publicBookingApi, 'declineOffer').mockResolvedValue(view);
    renderView(quietWith({ ok: true }));

    fireEvent.click(screen.getByTestId('supplier-inquiry-offer-decline'));

    await waitFor(() => expect(decline).toHaveBeenCalledWith(access, offer.sentAt));
    expect(accept).not.toHaveBeenCalled();
  });

  it('AcceptAndPay_TheTimeWentMeanwhile_IsNotOfferedAgainAndTheWayOnIsToWrite', async () => {
    vi.spyOn(publicBookingApi, 'acceptOffer').mockResolvedValue(view);
    renderView(quietWith({ ok: false, failure: { kind: 'slotTaken' } }));

    fireEvent.click(screen.getByTestId('supplier-inquiry-offer-accept'));

    expect(await screen.findByRole('button', { name: 'Scrivi a Rossi Servizi' })).toBeInTheDocument();
    expect(screen.queryByTestId('supplier-inquiry-offer-accept')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('non ti abbiamo addebitato nulla');
    // Turning the offer down stays possible.
    expect(screen.getByTestId('supplier-inquiry-offer-decline')).toBeInTheDocument();
  });

  it('Accept_AnOfferNotPaidInsideCasaZen_SaysSoInTheButton', () => {
    renderView(quietWith({ ok: true }), { ...view, offer: { ...offer, paymentRequired: false } });

    expect(screen.getByTestId('supplier-inquiry-offer-accept')).toHaveTextContent('Accetta l’offerta');
  });

  it('Offer_NobodyCanAnswerAnyMore_HasNoButtons', () => {
    renderView(quietWith({ ok: true }), { ...view, actions: { ...none, canCancel: true } });

    expect(screen.queryByTestId('supplier-inquiry-offer-accept')).toBeNull();
    expect(screen.queryByTestId('supplier-inquiry-offer-decline')).toBeNull();
  });
});
