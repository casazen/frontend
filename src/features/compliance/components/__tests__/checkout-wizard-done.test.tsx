import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { CheckoutWizardCompleteResult, CheckoutWizardState } from '@/types/compliance.types';
import { CheckoutDone } from '../checkout-wizard-done';

function wizard(alloggiatiSent: boolean): CheckoutWizardState {
  return {
    bookingId: 'b-1',
    bookingStatus: 'CheckedOut',
    currentStep: 'property-ready',
    startedAt: '2026-09-24T09:00:00Z',
    completedAt: '2026-09-24T10:00:00Z',
    steps: [],
    stay: {
      guestName: 'Mario Rossi',
      propertyId: 'p-1',
      propertyName: 'Villa Aurora',
      propertyCity: 'Roma',
      checkInDate: '2026-09-22T00:00:00Z',
      checkOutDate: '2026-09-24T00:00:00Z',
      nights: 2,
      numberOfGuests: 2,
      numberOfAdults: 2,
      numberOfChildren: 0,
      arrivedAt: null,
      source: 'Manual',
      departureConfirmed: true,
    },
    alloggiati: { status: alloggiatiSent ? 'InviatoManualmente' : 'DaInviareManualmente', sent: alloggiatiSent, deadlineAt: '2026-09-22T22:00:00Z', isOverdue: false, dataComplete: true },
    cleaning: { choice: 'Skip', supplierOrgId: null, category: null, notes: null, requestId: null },
    touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: false, collection: 'NotDue' },
    propertyReady: { ready: true, readyAt: null, notes: null },
  };
}

function result(overrides: Partial<CheckoutWizardCompleteResult> & { alloggiatiSent?: boolean } = {}): CheckoutWizardCompleteResult {
  const { alloggiatiSent = true, ...rest } = overrides;
  return {
    propertyReady: true,
    bookingStatus: 'CheckedOut',
    serviceRequestId: null,
    wizard: wizard(alloggiatiSent),
    ...rest,
  };
}

const renderDone = (completion: CheckoutWizardCompleteResult) =>
  render(
    <MemoryRouter>
      <CheckoutDone bookingId="b-1" guestName="Mario Rossi" result={completion} />
    </MemoryRouter>,
  );

const points = () => within(screen.getByRole('region', { name: 'Cosa succede ora' })).getAllByRole('listitem').map((item) => item.textContent);

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

describe('CheckoutDone', () => {
  it('CheckoutDone_StayClosed_ConfirmsItAndNamesTheGuest', () => {
    renderDone(result());

    expect(screen.getByRole('heading', { level: 2, name: 'Il soggiorno è chiuso' })).toBeInTheDocument();
    expect(screen.getByText('Il check-out di Mario Rossi è registrato.')).toBeInTheDocument();
  });

  it('CheckoutDone_PropertyReadyAndNothingElseToSay_HasTwoPoints', () => {
    renderDone(result({ propertyReady: true }));

    expect(points()).toEqual([
      'Nella prenotazione il soggiorno risulta concluso.',
      "L'immobile è segnato come pronto per il prossimo ospite.",
    ]);
  });

  it('CheckoutDone_PropertyNotReady_SaysItStaysAmongTheThingsToDo', () => {
    renderDone(result({ propertyReady: false }));

    expect(points()[1]).toBe("L'immobile non è ancora pronto: resta nel riepilogo compliance finché non lo dichiari pronto.");
  });

  it('CheckoutDone_CleaningRequestCreatedWithTheCheckOut_IsTheThirdPoint', () => {
    renderDone(result({ serviceRequestId: 'sr-1', alloggiatiSent: false }));

    expect(points()).toHaveLength(3);
    expect(points()[2]).toBe('La richiesta di pulizia è stata inviata al fornitore: la trovi nel dettaglio della prenotazione.');
  });

  it('CheckoutDone_AlloggiatiStillToSend_IsTheThirdPointWhenNoCleaningWasAsked', () => {
    renderDone(result({ alloggiatiSent: false }));

    expect(points()).toHaveLength(3);
    expect(points()[2]).toBe('La comunicazione Alloggiati non risulta ancora inviata: controllala dalla scheda della prenotazione.');
  });

  it('CheckoutDone_NeverMoreThanThreePoints', () => {
    renderDone(result({ serviceRequestId: 'sr-1', alloggiatiSent: false, propertyReady: false }));

    expect(points()).toHaveLength(3);
  });

  it('CheckoutDone_TwoWaysOn_BackToTheBookingAndToTheComplianceSummary', () => {
    renderDone(result());

    expect(screen.getByRole('link', { name: 'Torna alla prenotazione' })).toHaveAttribute('href', '/app/short-rent/bookings/b-1');
    expect(screen.getByRole('link', { name: 'Vai agli adempimenti' })).toHaveAttribute('href', '/app/short-rent/compliance');
  });

  it('CheckoutDone_Text_NeverSaysTheCheckOutIsCompletedLikeTheToastDoes', () => {
    // The toast of the completion says it already ("Check-out completato…"), and the journey of the CI looks for that one text:
    // the screen must not repeat it, or the page would have two of them.
    const { container } = renderDone(result({ serviceRequestId: 'sr-1', alloggiatiSent: false, propertyReady: false }));

    expect(container.textContent).not.toMatch(/check-out completato/i);
  });

  it('CheckoutDone_EnglishLanguage_IsTranslated', async () => {
    await i18n.changeLanguage('en');

    renderDone(result());

    expect(screen.getByRole('heading', { level: 2, name: 'The stay is closed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to compliance' })).toBeInTheDocument();
  });
});
