import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import type { BookingEditQuote, BookingEditSettlement as SavedSettlement } from '@/types';
import { BookingEditSettlement, BookingEditSettlementResult } from '../booking-edit-settlement';

const quote = (overrides: Partial<BookingEditQuote> = {}): BookingEditQuote => ({
  currency: 'EUR',
  previousTotal: 450,
  newTotal: 520,
  paidSoFar: 450,
  difference: 70,
  action: 'paymentLink',
  amount: 70,
  offlineRefundDue: 0,
  ...overrides,
});

const saved = (overrides: Partial<SavedSettlement> = {}): SavedSettlement => ({
  action: 'refund',
  state: 'done',
  amount: 70,
  offlineRefundDue: 0,
  currency: 'EUR',
  ...overrides,
});

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

describe('BookingEditSettlement (the money before the save, NF-75)', () => {
  it('render_PaymentLink_SaysTheGuestReceivesALinkToPayTheDifference', () => {
    render(<BookingEditSettlement quote={quote()} />);

    expect(screen.getByTestId('booking-edit-settlement-price')).toHaveTextContent(/Il prezzo passa da 450,00\s€ a 520,00\s€/);
    expect(screen.getByTestId('booking-edit-settlement-action')).toHaveTextContent(/L'ospite riceve un link per pagare 70,00\s€/);
    expect(screen.getByTestId('booking-edit-settlement-action')).toHaveAttribute('data-action', 'paymentLink');
  });

  it('render_ChargeSavedCard_SaysTheCardOfTheGuestIsCharged', () => {
    render(<BookingEditSettlement quote={quote({ action: 'chargeSavedCard' })} />);

    expect(screen.getByTestId('booking-edit-settlement-action')).toHaveTextContent(/70,00\s€ vengono addebitati sulla carta salvata dell'ospite/);
  });

  it('render_Refund_SaysTheDifferenceGoesBackOnTheCard', () => {
    render(<BookingEditSettlement quote={quote({ newTotal: 380, difference: -70, action: 'refund' })} />);

    expect(screen.getByTestId('booking-edit-settlement-price')).toHaveTextContent(/Il prezzo passa da 450,00\s€ a 380,00\s€/);
    expect(screen.getByTestId('booking-edit-settlement-action')).toHaveTextContent(/70,00\s€ vengono rimborsati sulla carta dell'ospite/);
  });

  it('render_SamePriceNoMoney_SaysOnlyThatThePriceDoesNotChange', () => {
    render(<BookingEditSettlement quote={quote({ newTotal: 450, difference: 0, action: 'none', amount: 0 })} />);

    expect(screen.getByTestId('booking-edit-settlement-price')).toHaveTextContent('Il prezzo non cambia.');
    expect(screen.queryByTestId('booking-edit-settlement-action')).not.toBeInTheDocument();
  });

  it('render_PriceChangesButNoMoneyMovesOnline_SaysNothingIsPaidFromHere', () => {
    // A booking the host entered (or one paid at the property): the price follows the dates, the money is settled by hand.
    render(<BookingEditSettlement quote={quote({ action: 'none', amount: 0, difference: 70 })} />);

    expect(screen.getByTestId('booking-edit-settlement-action')).toHaveTextContent(/Da qui non parte nessun pagamento/);
  });

  it('render_PartPaidOffline_SaysTheHostGivesItBack', () => {
    render(<BookingEditSettlement quote={quote({ newTotal: 380, action: 'refund', amount: 40, offlineRefundDue: 30 })} />);

    expect(screen.getByTestId('booking-edit-settlement-offline')).toHaveTextContent(/30,00\s€ sono stati pagati fuori da CasaZen.*li restituisci tu/);
  });

  it('render_English_UsesTheEnglishWords', async () => {
    await i18n.changeLanguage('en');
    render(<BookingEditSettlement quote={quote()} />);

    expect(screen.getByTestId('booking-edit-settlement-action')).toHaveTextContent(/The guest receives a link to pay/);
  });
});

describe('BookingEditSettlementResult (the money after the save)', () => {
  it('render_RefundConfirmed_UsesTheWordsOfTheRefundsOfACancellation', () => {
    render(<BookingEditSettlementResult settlement={saved()} />);

    expect(screen.getByText(/Rimborso di 70,00\s€ confermato da Stripe/)).toBeInTheDocument();
  });

  it('render_RefundNotConfirmedYet_IsNeverShownAsConfirmed', () => {
    render(<BookingEditSettlementResult settlement={saved({ state: 'pending' })} />);

    expect(screen.getByText(/Stripe non l'ha ancora confermato/)).toBeInTheDocument();
    expect(screen.queryByText(/confermato da Stripe/)).not.toBeInTheDocument();
  });

  it('render_ChargeConfirmed_SaysTheSavedCardWasCharged', () => {
    render(<BookingEditSettlementResult settlement={saved({ action: 'chargeSavedCard' })} />);

    expect(screen.getByText(/70,00\s€ addebitati sulla carta salvata dell'ospite/)).toBeInTheDocument();
  });

  it('render_ChargeNotConfirmed_IsSaidAsNotConfirmed', () => {
    render(<BookingEditSettlementResult settlement={saved({ action: 'chargeSavedCard', state: 'pending' })} />);

    expect(screen.getByText(/non è ancora confermato/)).toBeInTheDocument();
    expect(screen.queryByText(/70,00\s€ addebitati/)).not.toBeInTheDocument();
  });

  it('render_PaymentLinkSent_SaysTheLinkWasSent', () => {
    render(<BookingEditSettlementResult settlement={saved({ action: 'paymentLink' })} />);

    expect(screen.getByText(/Il link per pagare 70,00\s€ è stato inviato all'ospite/)).toBeInTheDocument();
  });

  it('render_PaymentLinkNotSent_IsSaidAsNotSent', () => {
    render(<BookingEditSettlementResult settlement={saved({ action: 'paymentLink', state: 'pending' })} />);

    expect(screen.getByText(/non è ancora stato inviato/)).toBeInTheDocument();
  });

  it('render_NothingMovedButTheHostOwesWhatWasPaidOffline_SaysSo', () => {
    render(<BookingEditSettlementResult settlement={saved({ action: 'none', state: 'none', amount: 0, offlineRefundDue: 30 })} />);

    expect(screen.getByTestId('booking-edit-settlement-offline')).toHaveTextContent(/Restano 30,00\s€ da restituire all'ospite/);
  });
});
