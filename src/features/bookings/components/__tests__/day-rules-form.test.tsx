import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import type { CalendarChangeRequest } from '@/types/calendar-changes.types';
import type { CalendarDayInfo } from '@/types/calendar-days.types';
import { DayRulesForm } from '../day-rules-form';

const SELECTION = { propertyId: 'p1', anchor: '2026-09-12', from: '2026-09-12', to: '2026-09-14' };

const day = (changes: Partial<CalendarDayInfo> = {}): CalendarDayInfo => ({
  date: '2026-09-12',
  priceCents: 12000,
  priceSource: 'Base',
  minNights: 1,
  closedToArrival: false,
  closedToDeparture: false,
  hasRule: false,
  taken: false,
  ...changes,
});

function renderForm(props: Partial<Parameters<typeof DayRulesForm>[0]> = {}) {
  const onSubmit = vi.fn<(request: CalendarChangeRequest) => void>();
  render(<DayRulesForm mode="price" selection={SELECTION} currency="EUR" pending={false} error={null} onSubmit={onSubmit} {...props} />);
  return onSubmit;
}

const typePrice = (value: string) => fireEvent.change(screen.getByTestId('day-price-input'), { target: { value } });
const save = () => fireEvent.click(screen.getByTestId('day-rules-submit'));

describe('DayRulesForm: the price (E08/F05/US03/T02, money rule)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('DayRulesForm_PriceSentExactlyAsTyped_Test', () => {
    // `120,5` is sent as 120.5, the number typed and not a rounded or a scaled one.
    const onSubmit = renderForm();
    typePrice('120,5');
    save();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const request = onSubmit.mock.calls[0][0];
    expect(request.price).toEqual({ action: 'Set', value: 120.5 });
    expect(request).toMatchObject({ propertyIds: ['p1'], from: '2026-09-12', to: '2026-09-14' });
    // The amount in the request is the amount the host typed, also on the wire.
    expect(JSON.parse(JSON.stringify(request)).price.value).toBe(120.5);
    // Everything the host did not touch is kept.
    expect(request.minNights).toEqual({ action: 'Keep' });
    expect(request.closedToArrival).toEqual({ action: 'Keep' });
  });

  it.each([
    ['120', 120],
    ['120.50', 120.5],
    ['99,99', 99.99],
    ['0,01', 0.01],
    ['100000', 100000],
  ])('DayRulesForm_PriceTyped_%s_IsSentAs_%s', (typed, expected) => {
    const onSubmit = renderForm();
    typePrice(typed);
    save();

    expect(onSubmit.mock.calls[0][0].price.value).toBe(expected);
  });

  it('DayRulesForm_PriceWithThreeDecimals_IsRefusedBeforeSendingAndNeverRounded', () => {
    const onSubmit = renderForm();
    typePrice('120.505');
    save();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Il prezzo può avere al massimo due decimali.');
  });

  it('DayRulesForm_PriceOfZeroOrOverTheLimit_IsRefusedBeforeSending', () => {
    const onSubmit = renderForm();
    typePrice('0');
    save();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Il prezzo deve essere tra 0,01 e 100.000.');

    typePrice('100000,01');
    save();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Il prezzo deve essere tra 0,01 e 100.000.');
  });

  it('DayRulesForm_NothingTypedNothingCleared_ChangesNothingAndSaysSo', () => {
    const onSubmit = renderForm();
    save();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('day-rules-nothing')).toHaveTextContent('Cambia almeno un valore');
  });

  it('DayRulesForm_BackToTheUsualPrice_IsAClear', () => {
    const onSubmit = renderForm({ days: [day({ priceSource: 'DayRule', priceCents: 15000, hasRule: true })] });
    fireEvent.click(screen.getByTestId('day-rule-clear-price'));
    expect(screen.getByTestId('day-price-input')).toBeDisabled();
    save();

    expect(onSubmit.mock.calls[0][0].price).toEqual({ action: 'Clear' });
  });

  it('DayRulesForm_ShowsTheCurrentPriceAndWhereItComesFrom', () => {
    renderForm({ days: [day({ priceSource: 'DayRule', priceCents: 15000, hasRule: true })] });
    expect((screen.getByTestId('day-price-now').textContent ?? '').replace(/\s/g, ' ')).toBe('Prezzo attuale: 150 € (prezzo che hai impostato sul calendario)');
  });

  it('DayRulesForm_NoNightWithAPriceOfItsOwn_HasNoWayBackToTheUsualPrice', () => {
    renderForm({ days: [day({ priceSource: 'Seasonal' })] });
    expect(screen.queryByTestId('day-rule-clear-price')).not.toBeInTheDocument();
  });

  it('DayRulesForm_WhileARequestIsOnItsWay_EveryButtonAndFieldIsOff', () => {
    renderForm({ pending: true, days: [day({ priceSource: 'DayRule', hasRule: true })] });

    expect(screen.getByTestId('day-rules-submit')).toBeDisabled();
    expect(screen.getByTestId('day-price-input')).toBeDisabled();
    expect(screen.getByTestId('day-rule-clear-price')).toBeDisabled();
  });

  it('DayRulesForm_ARefusalOfTheLastTry_IsShownAboveTheButton', () => {
    renderForm({ error: new Error('boom') });
    expect(screen.getByTestId('day-rules-error')).toHaveTextContent('Non siamo riusciti a salvare la modifica. Riprova.');
  });
});

describe('DayRulesForm: the restrictions (E08/F05/US03/T02)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('DayRulesForm_Restrictions_AreSetOrClearedAndTheRestIsKept', () => {
    const onSubmit = renderForm({ mode: 'restrictions', days: [day({ minNights: 2 })] });

    fireEvent.change(screen.getByLabelText('Soggiorno minimo (notti)'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('day-rule-clear-maxNights'));
    fireEvent.click(screen.getByLabelText('Arrivi chiusi'));
    save();

    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      price: { action: 'Keep' },
      minNights: { action: 'Set', value: 3 },
      maxNights: { action: 'Clear' },
      closedToArrival: { action: 'Set', value: true },
      closedToDeparture: { action: 'Keep' },
      minAdvanceDays: { action: 'Keep' },
      maxAdvanceDays: { action: 'Keep' },
    });
  });

  it('DayRulesForm_ShowsTheCurrentValueOfEachField', () => {
    renderForm({ mode: 'restrictions', days: [day({ minNights: 2, maxNights: 7, closedToArrival: true }), day({ minNights: 2, maxNights: 9 })] });

    expect(screen.getByTestId('day-rule-minNights')).toHaveTextContent('Ora: 2 notti');
    expect(screen.getByTestId('day-rule-maxNights')).toHaveTextContent('Ora: valori diversi nei giorni scelti');
    expect(screen.getByTestId('day-rule-minAdvanceDays')).toHaveTextContent('Ora: nessun limite');
    expect(screen.getByTestId('day-rule-closedToDeparture')).toHaveTextContent('Ora: aperti');
  });

  it('DayRulesForm_AClosureThatIsOn_IsClearedByUncheckingItAndLeftAloneByCheckingItAgain', () => {
    const onSubmit = renderForm({ mode: 'restrictions', days: [day({ closedToDeparture: true })] });
    const box = screen.getByLabelText('Partenze chiuse');
    expect(box).toBeChecked();

    fireEvent.click(box);
    save();
    expect(onSubmit.mock.calls[0][0].closedToDeparture).toEqual({ action: 'Clear' });

    fireEvent.click(screen.getByLabelText('Partenze chiuse'));
    fireEvent.click(screen.getByLabelText('Arrivi chiusi'));
    fireEvent.click(screen.getByLabelText('Arrivi chiusi'));
    save();
    // Back to what the days are now is "leave as it is": with nothing else changed the form is not sent.
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('DayRulesForm_MaximumStayBelowTheMinimum_IsRefusedNextToTheField', () => {
    const onSubmit = renderForm({ mode: 'restrictions' });
    fireEvent.change(screen.getByLabelText('Soggiorno minimo (notti)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Soggiorno massimo (notti)'), { target: { value: '3' } });
    save();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Il soggiorno massimo non può essere inferiore al minimo.')).toBeInTheDocument();
  });
});
