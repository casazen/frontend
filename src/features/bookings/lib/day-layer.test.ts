import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { CalendarDayInfo, CalendarDaysResponse } from '@/types/calendar-days.types';
import { dayCellText, dayLabel, dayPriceWords, formatDayPrice, isPastDay, showsPrice, toDayLayer } from './day-layer';

const nbsp = (text: string) => text.replace(/\s/g, ' ');

function day(changes: Partial<CalendarDayInfo> = {}): CalendarDayInfo {
  return {
    date: '2026-09-12',
    priceCents: 12000,
    priceSource: 'Base',
    minNights: 1,
    closedToArrival: false,
    closedToDeparture: false,
    hasRule: false,
    taken: false,
    ...changes,
  };
}

describe('the day layer of the host calendar (E08/F05/US03/T01)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('formatDayPrice_WholeEuros_HaveNoDecimals_OtherwiseTwo', () => {
    expect(nbsp(formatDayPrice(12000, 'EUR', 'it'))).toBe('120 €');
    expect(nbsp(formatDayPrice(12050, 'EUR', 'it'))).toBe('120,50 €');
    expect(nbsp(formatDayPrice(9999, 'EUR', 'it'))).toBe('99,99 €');
    expect(nbsp(formatDayPrice(15000, 'CHF', 'it'))).toContain('CHF');
  });

  it('dayPriceWords_SaysTheCurrencyInWords', () => {
    expect(nbsp(dayPriceWords(12000, 'EUR', 'it'))).toBe('120 euro');
    expect(nbsp(dayPriceWords(12000, 'EUR', 'en'))).toBe('120 euros');
  });

  it('dayCellText_MinimumStayFromTwoNights_AndNeverAtTheZoomOfAMonth', () => {
    expect(dayCellText(day({ minNights: 2 }), 'EUR', 'it', 14).minNights).toBe(2);
    expect(dayCellText(day({ minNights: 1 }), 'EUR', 'it', 14).minNights).toBeNull();
    expect(dayCellText(day({ minNights: 3 }), 'EUR', 'it', 30).minNights).toBeNull();
    expect(nbsp(dayCellText(day({ minNights: 3 }), 'EUR', 'it', 30).price)).toBe('120 €');
  });

  it('showsPrice_OnlyAFreeNightOfTheFuture', () => {
    expect(showsPrice(day(), '2026-09-12', '2026-09-12')).toBe(true);
    expect(showsPrice(day(), '2026-09-11', '2026-09-12')).toBe(false);
    expect(showsPrice(day({ taken: true }), '2026-09-13', '2026-09-12')).toBe(false);
    expect(showsPrice(undefined, '2026-09-13', '2026-09-12')).toBe(false);
    expect(isPastDay('2026-09-11', '2026-09-12')).toBe(true);
  });

  it('dayLabel_AFreeNight_SaysPriceMinimumClosuresAndRuleInWords', () => {
    const label = dayLabel(
      { date: '2026-09-12', propertyName: 'Appartamento X', today: '2026-09-01', language: 'it', currency: 'EUR', info: day({ minNights: 2, closedToArrival: true, hasRule: true }) },
      i18n.t,
    );
    expect(nbsp(label)).toBe('12 settembre, Appartamento X, 120 euro, minimo 2 notti, arrivi chiusi, regola propria');
  });

  it('dayLabel_APastDayAndATakenNight_SayThatAndNoPrice', () => {
    const past = dayLabel({ date: '2026-09-12', propertyName: 'Appartamento X', today: '2026-09-20', language: 'it', currency: 'EUR', info: day() }, i18n.t);
    expect(past).toBe('12 settembre, Appartamento X, giorno passato');
    const taken = dayLabel({ date: '2026-09-12', propertyName: 'Appartamento X', today: '2026-09-01', language: 'it', currency: 'EUR', info: day({ taken: true }) }, i18n.t);
    expect(taken).toBe('12 settembre, Appartamento X, notte occupata');
  });

  it('dayLabel_WithoutTheLayer_SaysOnlyTheDayAndTheProperty', () => {
    expect(dayLabel({ date: '2026-09-12', propertyName: 'Appartamento X', today: '2026-09-01', language: 'it' }, i18n.t)).toBe('12 settembre, Appartamento X');
  });

  it('toDayLayer_IndexesEveryPropertyByDate_WithItsCurrencyAndMirroring', () => {
    const response: CalendarDaysResponse = {
      today: '2026-09-12',
      properties: [{ propertyId: 'p1', timezone: 'Europe/Rome', currency: 'EUR', mirrored: true, days: [day(), day({ date: '2026-09-13', priceCents: 13000 })] }],
    };
    const layer = toDayLayer(response);
    expect(layer?.get('p1')).toMatchObject({ currency: 'EUR', mirrored: true, timezone: 'Europe/Rome' });
    expect(layer?.get('p1')?.days.get('2026-09-13')?.priceCents).toBe(13000);
    expect(layer?.get('p2')).toBeUndefined();
    expect(toDayLayer(undefined)).toBeUndefined();
  });
});
