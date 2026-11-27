import { describe, expect, it } from 'vitest';
import { GUEST_REGISTER_LAYER_KIND, guestRegisterLayerPath, parseGuestRegisterLayerId } from '../guest-register-address';
import { GUEST_REGISTER_MAX_DAYS, defaultRegisterPeriod, guestRegisterFileName, parseGuestRegisterCsv, periodProblemOf } from '../guest-register-model';

const PROPERTY_ID = '5b1c0e5a-7f43-4d7e-9a41-2c6f1d8a9b10';

describe('the period of the guest register (E31/F02/US02/T01, NF-130)', () => {
  it('defaultRegisterPeriod_IsTheLast30DaysEndingTodayOnTheClockOfSwitzerland', () => {
    const period = defaultRegisterPeriod(new Date('2026-11-20T23:30:00Z'));

    expect(period).toEqual({ from: '2026-10-23', to: '2026-11-21' });
    expect(periodProblemOf(period)).toBeNull();
  });

  it.each([
    ['one day', { from: '2026-11-21', to: '2026-11-21' }, null],
    ['a leap year, both ends counted (366 days)', { from: '2024-01-01', to: '2024-12-31' }, null],
    ['366 days, both ends counted, in a year that is not a leap year', { from: '2026-01-01', to: '2027-01-01' }, null],
    ['one day more (367 days)', { from: '2026-01-01', to: '2027-01-02' }, 'tooLong'],
    ['the end before the start', { from: '2026-11-21', to: '2026-11-20' }, 'order'],
    ['a day that is not there yet', { from: '', to: '2026-11-20' }, 'missing'],
    ['a day that is not a day', { from: '2026-02-30', to: '2026-03-10' }, 'missing'],
  ] as const)('periodProblemOf_%s_Says_%s', (_what, period, problem) => {
    expect(periodProblemOf(period)).toBe(problem);
  });

  it('periodProblemOf_TheLimit_IsTheOneOfTheServer', () => {
    expect(GUEST_REGISTER_MAX_DAYS).toBe(366);
  });

  it('guestRegisterFileName_IsTheNameTheServerGives', () => {
    expect(guestRegisterFileName({ from: '2026-01-01', to: '2026-03-31' })).toBe('registro-ospiti-ch-2026-01-01-2026-03-31.csv');
  });
});

describe('the address of the layer of the guest register', () => {
  it('guestRegisterLayerPath_AProperty_IsThePageOfThePropertyWithTheLayerOpenOnIt', () => {
    expect(guestRegisterLayerPath(PROPERTY_ID)).toBe(`/app/short-rent/properties/${PROPERTY_ID}?detail=${GUEST_REGISTER_LAYER_KIND}:${PROPERTY_ID}`);
    expect(parseGuestRegisterLayerId(PROPERTY_ID)).toBe(PROPERTY_ID);
  });

  it.each(['../admin', 'a:b', 'a b', '', 'x'.repeat(65)])('parseGuestRegisterLayerId_%s_IsNotAnIdTheAddressCanHold', (id) => {
    expect(parseGuestRegisterLayerId(id)).toBeNull();
    expect(guestRegisterLayerPath(id)).toBe('/app/short-rent/properties');
  });
});

describe('parseGuestRegisterCsv, the file of the register as the printed sheet reads it', () => {
  const HEADER = 'Arrivo;Partenza;Cognome;Nome;Firma';

  it('parseGuestRegisterCsv_TheFileOfTheServer_IsTheHeaderAndALineForEachGuest', () => {
    const file = `\uFEFF${HEADER}\r\n19.11.2026;22.11.2026;Rossi;Mario;\r\n19.11.2026;22.11.2026;Verdi;Anna;\r\n`;

    expect(parseGuestRegisterCsv(file)).toEqual({
      header: ['Arrivo', 'Partenza', 'Cognome', 'Nome', 'Firma'],
      rows: [
        ['19.11.2026', '22.11.2026', 'Rossi', 'Mario', ''],
        ['19.11.2026', '22.11.2026', 'Verdi', 'Anna', ''],
      ],
    });
  });

  it('parseGuestRegisterCsv_APeriodWithNoGuest_IsTheHeaderAlone', () => {
    expect(parseGuestRegisterCsv(`\uFEFF${HEADER}\r\n`)).toEqual({ header: ['Arrivo', 'Partenza', 'Cognome', 'Nome', 'Firma'], rows: [] });
    expect(parseGuestRegisterCsv('')).toEqual({ header: [], rows: [] });
  });

  it('parseGuestRegisterCsv_ACellWithTheSeparatorAQuoteOrALineBreak_IsQuotedAndReadAsItWasWritten', () => {
    const file = `${HEADER}\r\n19.11.2026;22.11.2026;"Rossi; Bianchi";"Mario ""Gigi""";\r\n19.11.2026;22.11.2026;"due\r\nrighe";Anna;\r\n`;

    const { rows } = parseGuestRegisterCsv(file);
    expect(rows[0]).toEqual(['19.11.2026', '22.11.2026', 'Rossi; Bianchi', 'Mario "Gigi"', '']);
    expect(rows[1]).toEqual(['19.11.2026', '22.11.2026', 'due\r\nrighe', 'Anna', '']);
  });

  it('parseGuestRegisterCsv_TheApostropheThatGuardsAFormula_IsNotPartOfTheText', () => {
    const { rows } = parseGuestRegisterCsv(`${HEADER}\r\n19.11.2026;22.11.2026;'=Rossi;'Ali;\r\n`);

    expect(rows[0]).toEqual(['19.11.2026', '22.11.2026', '=Rossi', "'Ali", '']);
  });

  it('parseGuestRegisterCsv_ALineWithFewerCellsThanTheHeader_IsFilledSoThatEveryLineHasTheSignatureColumn', () => {
    const { rows } = parseGuestRegisterCsv(`${HEADER}\n19.11.2026;22.11.2026;Rossi\n\n`);

    expect(rows).toEqual([['19.11.2026', '22.11.2026', 'Rossi', '', '']]);
  });
});
