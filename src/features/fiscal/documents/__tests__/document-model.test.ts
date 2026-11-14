import { beforeEach, describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import { FISCAL_DOCUMENT_ERROR } from '@/api/fiscal-documents.api';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import { document, draft, importedDocument, swissDetail } from './document-fixtures';
import {
  bookingLinkOf,
  creditProblemOf,
  creditRequestOf,
  criteriaOf,
  DOCUMENT_STATE_KEYS,
  documentActionsOf,
  documentFileName,
  documentsReadOf,
  documentStatesOf,
  documentWriteActionsOf,
  exportBlockOf,
  exportFileName,
  formatDocumentAmount,
  formatDocumentDay,
  hasActiveFilters,
  isAwaitingSdi,
  issuerModeOf,
  NO_FILTERS,
  numberingOf,
  parseCreditAmount,
  periodProblemOf,
  sdiNoteVisibleFor,
  seriesOf,
  unavailabilityOf,
  vatSummaryOf,
} from '../document-model';

const IMPORT_ON = { ...DEFAULT_FEATURE_FLAGS, octorateConnector: true, octorateDocumentImport: true };

function failure(status: number, body: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: body, statusText: '', headers: {}, config });
}

describe('documentStatesOf (every state not completed is shown as such, never as issued)', () => {
  it.each([
    ['not sent to the SDI', { sdiStatus: 'to_send' }, 'toSend', 'warning'],
    ['sent to the SDI, no answer yet', { sdiStatus: 'submitted' }, 'submitted', 'info'],
    ['delivered by the SDI', { sdiStatus: 'delivered' }, 'delivered', 'success'],
    ['refused by the SDI', { sdiStatus: 'rejected', sdiErrorCode: '00305' }, 'rejected', 'danger'],
    ['declared sent outside CasaZen', { sdiStatus: 'manual_declared' }, 'manualDeclared', 'info'],
    ['an SDI state nobody knows', { sdiStatus: 'unknown' }, 'sdiUnavailable', 'neutral'],
    ['a receipt, which does not go to the SDI', { kind: 'Receipt', sdiStatus: 'not_applicable' }, 'issued', 'success'],
    ['a draft', { status: 'Draft', number: null, issueDate: null, sdiStatus: 'not_applicable' }, 'draft', 'neutral'],
    ['a dropped draft', { status: 'Discarded', number: null, issueDate: null }, 'discarded', 'neutral'],
  ])('DocumentStatesOf_%s_IsTheLineOfThatState', (_case, overrides, state, tone) => {
    const { main } = documentStatesOf(document(overrides));

    expect(main.key).toBe(`fiscalDocuments.list.state.${state}`);
    expect(main.tone).toBe(tone);
    // The state is never told by color alone: it always has an icon.
    expect(main.icon).toBeTruthy();
  });

  it('DocumentStatesOf_ASdiRefusal_KeepsTheCodeTheSdiGaveAndIsRed', () => {
    const { main } = documentStatesOf(document({ sdiStatus: 'rejected', sdiErrorCode: '00305' }));

    expect(main).toMatchObject({ tone: 'danger', detail: '00305' });
  });

  it.each([
    ['an SDI state the server added later', { sdiStatus: 'archived' }, 'unrecognizedSdi', 'archived'],
    ['a status the server added later', { status: 'Voided' }, 'unrecognizedStatus', 'Voided'],
  ])('DocumentStatesOf_%s_IsShownAsItCameAndNeverAsAComplete', (_case, overrides, state, code) => {
    const { main } = documentStatesOf(document(overrides));

    expect(main).toMatchObject({ key: `fiscalDocuments.list.state.${state}`, tone: 'neutral', detail: code });
    expect(main.key).not.toMatch(/\.(issued|delivered|paid)$/);
  });

  it('DocumentStatesOf_AnIssuedDocumentThatIsToCollect_HasTwoSeparateLines', () => {
    const states = documentStatesOf(document({ sdiStatus: 'delivered', paymentState: 'ToCollect' }));

    expect(states.main.key).toBe('fiscalDocuments.list.state.delivered');
    expect(states.payment).toMatchObject({ key: 'fiscalDocuments.list.state.toCollect', tone: 'warning' });
    expect(documentStatesOf(document({ paymentState: 'Paid' })).payment?.key).toBe('fiscalDocuments.list.state.paid');
  });

  it('DocumentStatesOf_AnUnknownCollection_SaysNothingAboutCollection', () => {
    expect(documentStatesOf(document({ paymentState: 'Unknown' })).payment).toBeNull();
    expect(documentStatesOf(document({ paymentState: 'Refunded' })).payment).toMatchObject({ key: 'fiscalDocuments.list.state.unrecognizedPayment', tone: 'neutral' });
  });

  it.each([
    ['a draft', { status: 'Draft' }],
    ['a dropped draft', { status: 'Discarded' }],
    ['a credit note', { kind: 'CreditNote' }],
  ])('DocumentStatesOf_%s_HasNoLineAboutCollection', (_case, overrides) => {
    expect(documentStatesOf(document({ ...overrides, paymentState: 'ToCollect' })).payment).toBeNull();
  });

  it('DocumentStatesOf_ADocumentOfTheChannelManager_IsManagedByItAndSaysNothingOfTheSdi', () => {
    const { main, payment } = documentStatesOf(importedDocument({ sdiStatus: 'rejected', paymentState: 'Paid' }));

    expect(main).toMatchObject({ key: 'fiscalDocuments.list.state.channelManaged', tone: 'info' });
    expect(payment?.key).toBe('fiscalDocuments.list.state.paid');
    expect(documentStatesOf(importedDocument()).payment).toBeNull();
  });

  it('DocumentStateKeys_EveryStateThereIs_HasItsWordsInBothLanguages', () => {
    for (const key of DOCUMENT_STATE_KEYS) {
      expect((it_.fiscalDocuments.list.state as Record<string, string>)[key], `it ${key}`).toBeTruthy();
      expect((en.fiscalDocuments.list.state as Record<string, string>)[key], `en ${key}`).toBeTruthy();
    }
    // The model never builds a key that has no words.
    const built = [
      document({ sdiStatus: 'to_send' }),
      document({ sdiStatus: 'submitted' }),
      document({ sdiStatus: 'delivered' }),
      document({ sdiStatus: 'rejected' }),
      document({ sdiStatus: 'manual_declared' }),
      document({ sdiStatus: 'unknown' }),
      document({ sdiStatus: 'not_applicable' }),
      document({ sdiStatus: 'x' }),
      document({ status: 'Draft' }),
      document({ status: 'Discarded' }),
      document({ status: 'x' }),
      document({ paymentState: 'x' }),
      importedDocument(),
    ].flatMap((candidate) => {
      const { main, payment } = documentStatesOf(candidate);
      return [main, payment].filter((state) => state !== null);
    });
    for (const state of built) {
      expect(DOCUMENT_STATE_KEYS).toContain(state.key.replace('fiscalDocuments.list.state.', ''));
    }
  });

  it('IsAwaitingSdi_OnlyAnIssuedDocumentOfCasaZenThatWasSent_WaitsForTheAnswer', () => {
    expect(isAwaitingSdi(document({ sdiStatus: 'submitted' }))).toBe(true);
    expect(isAwaitingSdi(document({ sdiStatus: 'to_send' }))).toBe(false);
    expect(isAwaitingSdi(importedDocument({ sdiStatus: 'submitted' }))).toBe(false);
    expect(isAwaitingSdi(document({ status: 'Draft', sdiStatus: 'submitted' }))).toBe(false);
  });
});

describe('documentActionsOf', () => {
  it('DocumentActionsOf_AnIssuedDocumentOfCasaZen_HasItsPdfAndItsXml', () => {
    expect(documentActionsOf(document(), DEFAULT_FEATURE_FLAGS)).toEqual({ pdf: true, xml: true, readOnly: false, pdfUnavailable: false });
  });

  it('DocumentActionsOf_ADocumentCasaZenHoldsNoXmlOf_HasNoXmlButton', () => {
    expect(documentActionsOf(document({ hasXml: false }), DEFAULT_FEATURE_FLAGS)).toMatchObject({ pdf: true, xml: false });
  });

  it.each([['a draft', 'Draft'], ['a dropped draft', 'Discarded']])('DocumentActionsOf_%s_IsNotADocumentToDownload', (_case, status) => {
    expect(documentActionsOf(document({ status }), DEFAULT_FEATURE_FLAGS)).toMatchObject({ pdf: false, xml: false });
  });

  // Flag rule: the endpoint of the PDF of the channel manager answers 404 while either flag is off, so no request is made and no error is shown.
  it('DocumentActionsOf_AnImportedDocument_IsReadOnlyAndNeverHasAnXml', () => {
    expect(documentActionsOf(importedDocument(), IMPORT_ON)).toEqual({ pdf: true, xml: false, readOnly: true, pdfUnavailable: false });
    expect(documentActionsOf(importedDocument({ hasXml: true }), IMPORT_ON).xml).toBe(false);
  });

  it.each([
    ['both flags off', DEFAULT_FEATURE_FLAGS],
    ['the connector off', { ...IMPORT_ON, octorateConnector: false }],
    ['the import off', { ...IMPORT_ON, octorateDocumentImport: false }],
  ])('DocumentActionsOf_AnImportedDocumentWith_%s_HasNoPdfButtonAndSaysSo', (_case, flags) => {
    expect(documentActionsOf(importedDocument(), flags)).toMatchObject({ pdf: false, readOnly: true, pdfUnavailable: true });
  });

  it('DocumentActionsOf_AnImportedDocumentThatHasNoPdfAtTheChannelManager_SaysSo', () => {
    expect(documentActionsOf(importedDocument({ octoratePdfAvailable: false }), IMPORT_ON)).toMatchObject({ pdf: false, pdfUnavailable: true });
  });
});

describe('unavailabilityOf (a 404 is always "not found", even when the list still holds the row)', () => {
  it.each([
    ['a document that is not found', failure(404, { code: FISCAL_DOCUMENT_ERROR.notFound }), 'document'],
    ['a 404 with no code', failure(404, undefined), 'document'],
    ['an XML the document does not have', failure(404, { code: FISCAL_DOCUMENT_ERROR.xmlUnavailable }), 'xml'],
    // The server also sends it when the channel manager could not be read just now: nothing is taken away, the person may ask again.
    ['a PDF the channel manager could not give', failure(404, { code: FISCAL_DOCUMENT_ERROR.octoratePdfUnavailable }), null],
    ['a failure that is not a 404', failure(500, { code: FISCAL_DOCUMENT_ERROR.notFound }), null],
    ['the schema of the invoice not installed (422)', failure(422, { code: FISCAL_DOCUMENT_ERROR.schemaUnavailable }), null],
    ['an error that is not one of axios', new Error('offline'), null],
  ])('UnavailabilityOf_%s_IsRead', (_case, error, expected) => {
    expect(unavailabilityOf(error)).toBe(expected);
  });
});

describe('filters', () => {
  it('CriteriaOf_WhatIsEmpty_IsLeftOut', () => {
    expect(criteriaOf(NO_FILTERS)).toEqual({});
    expect(criteriaOf({ from: '2026-11-01', to: '', kind: 'Invoice', source: '', status: 'Issued' })).toEqual({ from: '2026-11-01', kind: 'Invoice', status: 'Issued' });
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, source: 'Octorate' })).toBe(true);
  });

  it.each([
    ['no days', '', '', null],
    ['one day', '2026-11-01', '', null],
    ['a period', '2026-11-01', '2026-11-30', null],
    ['one day, both ends', '2026-11-05', '2026-11-05', null],
    ['a first day after the last', '2026-11-30', '2026-11-01', 'order'],
    ['a day before the years the server accepts', '1999-12-31', '', 'range'],
    ['a day after them', '', '2101-01-01', 'range'],
    ['a day that is not one', '2026-02-31', '', 'range'],
  ])('PeriodProblemOf_%s_IsRead', (_case, from, to, expected) => {
    expect(periodProblemOf({ from, to })).toBe(expected);
  });

  // The files hold the issued documents only and do not read the status: with a filter that has nothing to put in them they are not asked.
  it.each([
    ['no filter', NO_FILTERS, null],
    ['the issued ones', { ...NO_FILTERS, status: 'Issued' }, null],
    ['the drafts', { ...NO_FILTERS, status: 'Draft' }, 'status'],
    ['the dropped drafts', { ...NO_FILTERS, status: 'Discarded' }, 'status'],
    ['a period with a problem', { ...NO_FILTERS, from: '2026-12-01', to: '2026-11-01' }, 'period'],
  ])('ExportBlockOf_%s_IsRead', (_case, filters, expected) => {
    expect(exportBlockOf(filters)).toBe(expected);
  });
});

describe('money and days (as the server wrote them)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('FormatDocumentAmount_AnAmount_IsNotRoundedAndKeepsItsOwnCurrency', () => {
    expect(formatDocumentAmount(122.1, 'EUR', 'it').replace(/\s/g, ' ')).toBe('122,10 €');
    expect(formatDocumentAmount(1234.5, 'CHF', 'it').replace(/\s/g, ' ')).toContain('CHF');
    // More decimals than any currency has: a figure the server wrote is never cut by the format.
    expect(formatDocumentAmount(10.005, 'EUR', 'en')).toContain('10.005');
  });

  it('FormatDocumentAmount_AValueThatIsNotACurrencyCode_IsWrittenAfterTheNumberAsItCameNotAsEuro', () => {
    const text = formatDocumentAmount(50, 'EURO', 'it');

    expect(text).toBe('50 EURO');
    expect(text).not.toContain('€');
  });

  it('FormatDocumentDay_ADayOfTheServer_IsNotShiftedByTheTimeZone', () => {
    expect(formatDocumentDay('2026-11-05', 'it')).toContain('5');
    expect(formatDocumentDay('2026-11-05', 'it')).toContain('2026');
    expect(formatDocumentDay('not-a-day', 'it')).toBe('not-a-day');
  });
});

describe('file names (no personal data)', () => {
  it('DocumentFileName_TheServerGaveOne_IsKept', () => {
    expect(documentFileName(document(), 'pdf', `attachment; filename=documento-A-12.pdf; filename*=UTF-8''documento-A-12.pdf`)).toBe('documento-A-12.pdf');
  });

  it('DocumentFileName_NoHeader_IsBuiltFromTheNumberAndNeverFromTheRecipient', () => {
    const name = documentFileName(document({ number: 'A/12', recipientName: 'Mario Rossi' }), 'pdf', null);

    expect(name).toBe('documento-A-12.pdf');
    expect(name).not.toMatch(/mario|rossi/i);
    expect(documentFileName(document({ number: null }), 'xml', undefined)).toBe('documento.xml');
    // A number is never a path.
    expect(documentFileName(document({ number: '../../x/1' }), 'xml', null)).toBe('documento-x-1.xml');
  });

  it('ExportFileName_NoHeader_IsNamedAsTheServerNamesItWithTheMonthOfTheFirstDay', () => {
    expect(exportFileName('csv', { from: '2026-10-15', to: '2026-11-30' }, null)).toBe('documenti-2026-10.csv');
    expect(exportFileName('xlsx', { to: '2026-11-30' }, undefined)).toBe('documenti-2026-11.xlsx');
    expect(exportFileName('csv', {}, null)).toMatch(/^documenti-\d{4}-\d{2}\.csv$/);
    expect(exportFileName('csv', {}, `attachment; filename=documenti-2026-09.csv`)).toBe('documenti-2026-09.csv');
  });
});

describe('reads', () => {
  it.each([
    ['a read that was not asked', { enabled: false, isError: false, status: undefined, hasData: false }, 'idle'],
    ['a read on its way', { enabled: true, isError: false, status: undefined, hasData: false }, 'loading'],
    ['a read that worked', { enabled: true, isError: false, status: undefined, hasData: true }, 'ok'],
    ['a 403', { enabled: true, isError: true, status: 403, hasData: false }, 'forbidden'],
    ['a 500', { enabled: true, isError: true, status: 500, hasData: false }, 'failed'],
    ['a failure with no answer', { enabled: true, isError: true, status: undefined, hasData: false }, 'failed'],
    // A query keeps its old data when a later read fails: the error comes first, and a 404 is "not found" whatever the query still holds.
    ['a 404 while the query still holds rows', { enabled: true, isError: true, status: 404, hasData: true }, 'notFound'],
    ['a 500 while the query still holds rows', { enabled: true, isError: true, status: 500, hasData: true }, 'failed'],
  ])('DocumentsReadOf_%s_IsRead', (_case, input, expected) => {
    expect(documentsReadOf(input)).toBe(expected);
  });

  it('IssuerModeOf_TheSetting_IsReadAndNothingIsClaimedWhenItCouldNotBeRead', () => {
    const context = (mode: string | null) => ({ mode, casazenIssuanceEnabled: true, sdiProviderConfigured: false });

    expect(issuerModeOf(context('Octorate'))).toBe('Octorate');
    expect(issuerModeOf(context('CasaZenDirectOnly'))).toBe('CasaZenDirectOnly');
    expect(issuerModeOf(context('Accountant'))).toBe('Accountant');
    expect(issuerModeOf(context(null))).toBe('unset');
    expect(issuerModeOf(context('SomethingNew'))).toBe('unknown');
    expect(issuerModeOf(undefined)).toBe('unknown');
  });

  it('SdiNoteVisibleFor_OnlyWhenTheSettingSaysThereIsNoChannelAndTheNoteExplainsSomething', () => {
    const noChannel = { mode: 'CasaZenDirectOnly', casazenIssuanceEnabled: true, sdiProviderConfigured: false };
    const channel = { ...noChannel, sdiProviderConfigured: true };

    expect(sdiNoteVisibleFor(noChannel, [])).toBe(true);
    expect(sdiNoteVisibleFor(noChannel, [document({ sdiStatus: 'to_send' })])).toBe(true);
    expect(sdiNoteVisibleFor(noChannel, [document({ sdiStatus: 'delivered' })])).toBe(false);
    expect(sdiNoteVisibleFor(noChannel, [importedDocument({ sdiStatus: 'to_send' })])).toBe(false);
    expect(sdiNoteVisibleFor(channel, [])).toBe(false);
    // A setting that could not be read is never "SDI not available": nothing is claimed.
    expect(sdiNoteVisibleFor(undefined, [])).toBe(false);
  });

  it('BookingLinkOf_OnlyForWhoMayReadBookings', () => {
    expect(bookingLinkOf({ bookingId: 'b-1' }, true)).toBe('/app/short-rent/bookings/b-1');
    expect(bookingLinkOf({ bookingId: 'b-1' }, false)).toBeNull();
    expect(bookingLinkOf({ bookingId: null }, true)).toBeNull();
  });
});

describe('documentWriteActionsOf (what may be changed, by state)', () => {
  const none = { issue: false, refresh: false, discard: false, credit: false };

  it('DocumentWriteActionsOf_WithoutTheRightToChange_IsNothingWhateverTheDocument', () => {
    for (const candidate of [document(), draft(), importedDocument(), draft({ kind: 'CreditNote' })]) expect(documentWriteActionsOf(candidate, false)).toEqual(none);
  });

  it.each([
    ['a draft of CasaZen', draft(), { issue: true, refresh: true, discard: true, credit: false }],
    // A credit note that is a draft is the amounts of the document it credits: it is issued or dropped, never made again from a booking.
    ['a credit note that is a draft', draft({ kind: 'CreditNote' }), { issue: true, refresh: false, discard: true, credit: false }],
    ['an invoice that was issued', document(), { ...none, credit: true }],
    ['a receipt that was issued', document({ kind: 'Receipt' }), { ...none, credit: true }],
    ['a credit note that was issued', document({ kind: 'CreditNote' }), none],
    ['a dropped draft', draft({ status: 'Discarded' }), none],
    ['a document of the channel manager', importedDocument({ status: 'Draft' }), none],
  ])('DocumentWriteActionsOf_%s_IsRead', (_case, candidate, expected) => {
    expect(documentWriteActionsOf(candidate, true)).toEqual(expected);
  });
});

describe('vatSummaryOf (a summary that does not add up to the totals is never drawn)', () => {
  const lines = swissDetail().lines;

  it('VatSummaryOf_TheLinesOfASwissInvoice_AddUpToTheTotalsAndAreGroupedByRate', () => {
    const rows = vatSummaryOf({ lines, taxableBase: 708.11, vatAmount: 27.89 });

    expect(rows).toEqual([
      { ratePercent: 8.1, natureCode: null, taxable: 37, vat: 3 },
      { ratePercent: 3.8, natureCode: null, taxable: 655.11, vat: 24.89 },
      { ratePercent: 0, natureCode: null, taxable: 16, vat: 0 },
    ]);
  });

  it.each([
    ['a VAT of the document that is not the sum of the rows', { taxableBase: 708.11, vatAmount: 27.9 }],
    ['a taxable base of the document that is not the sum of the rows', { taxableBase: 700, vatAmount: 27.89 }],
  ])('VatSummaryOf_%s_IsNotDrawn', (_case, totals) => {
    expect(vatSummaryOf({ lines, ...totals })).toBeNull();
  });

  it('VatSummaryOf_TheVatTheServerStoredOnTheLines_IsWhatIsSummedNotTheOneWorkedOutFromTheRate', () => {
    const stored = lines.map((line) => (line.vatRatePercent === 3.8 ? { ...line, vatAmount: line.lineNumber === 1 ? 21.97 : 2.93 } : line.vatRatePercent === 8.1 ? { ...line, vatAmount: 3 } : { ...line, vatAmount: 0 }));

    expect(vatSummaryOf({ lines: stored, taxableBase: 708.11, vatAmount: 27.9 })?.find((row) => row.ratePercent === 3.8)?.vat).toBe(24.9);
  });

  it('VatSummaryOf_ADocumentWithNoLine_IsNotDrawn', () => {
    expect(vatSummaryOf({ lines: [], taxableBase: 0, vatAmount: 0 })).toBeNull();
  });
});

describe('numbering (the number the next document is expected to get)', () => {
  const issued = [
    { series: '2026', sequenceNumber: 4, number: '2026/4' },
    { series: '2026', sequenceNumber: 3, number: '2026/3' },
    { series: '2025', sequenceNumber: 90, number: '2025/90' },
  ];

  it('SeriesOf_ThePatternOfTheSetting_GivesTheSeriesOfTheYearOfTheIssue', () => {
    expect(seriesOf('', '2026-11-14')).toBe('2026');
    expect(seriesOf('{year}', '2027-01-02')).toBe('2027');
    expect(seriesOf('PM-{year}', '2026-11-14')).toBe('PM-2026');
    expect(seriesOf('A', '2026-11-14')).toBe('A');
  });

  it('SeriesOf_ASettingThatCouldNotBeRead_ClaimsNoSeries', () => {
    expect(seriesOf(null, '2026-11-14')).toBeNull();
    expect(seriesOf(undefined, '2026-11-14')).toBeNull();
  });

  it('NumberingOf_TheIssuedDocumentsOfTheSeries_ExpectsTheNumberAfterTheHighest', () => {
    expect(numberingOf('2026', issued)).toEqual({ series: '2026', last: '2026/4', next: '2026/5' });
  });

  it('NumberingOf_NoIssuedDocumentOfTheSeriesAmongTheOnesRead_ExpectsNothingAndNeverTheFirstNumber', () => {
    // The list may leave documents out (a person who reaches only some of the properties, the newest 100) and the counter of the server starts above the numbers
    // already used: an empty series in what was read is no proof that it is empty there.
    expect(numberingOf('2027', issued)).toEqual({ series: '2027', last: null, next: null });
    expect(numberingOf('2026', [])).toEqual({ series: '2026', last: null, next: null });
  });

  it('NumberingOf_IssuedDocumentsThatCouldNotBeRead_ExpectsNothingAndNeverTheFirstNumber', () => {
    expect(numberingOf('2026', undefined)).toEqual({ series: '2026', last: null, next: null });
  });

  it('NumberingOf_ASeriesThatIsNotKnown_TellsOnlyTheLastNumberIssued', () => {
    expect(numberingOf(null, issued)).toEqual({ series: null, last: '2026/4', next: null });
  });
});

describe('the credit note', () => {
  it.each([
    ['120', 120],
    ['120,5', 120.5],
    ['120.50', 120.5],
    [' 0,01 ', 0.01],
  ])('ParseCreditAmount_%s_IsRead', (text, amount) => {
    expect(parseCreditAmount(text)).toBe(amount);
  });

  // A separator of thousands is not read: a figure is never read as another one.
  it.each(['', '0', '-5', '1.250,00', '12,345', 'abc', '12 EUR'])('ParseCreditAmount_%s_IsNotAnAmount', (text) => {
    expect(parseCreditAmount(text)).toBeNull();
  });

  it('CreditProblemOf_APartAboveTheTotalOrAReasonThatIsMissing_IsToldBeforeTheServerIsAsked', () => {
    expect(creditProblemOf({ scope: 'whole', amount: '', reason: 'Errore' }, 736)).toBeNull();
    expect(creditProblemOf({ scope: 'whole', amount: '', reason: '  ' }, 736)).toBe('reasonRequired');
    expect(creditProblemOf({ scope: 'part', amount: '', reason: 'Errore' }, 736)).toBe('amountInvalid');
    expect(creditProblemOf({ scope: 'part', amount: '736,01', reason: 'Errore' }, 736)).toBe('amountTooHigh');
    expect(creditProblemOf({ scope: 'part', amount: '736', reason: 'Errore' }, 736)).toBeNull();
  });

  it('CreditRequestOf_TheWholeDocument_LeavesTheAmountOutAndAPartSendsIt', () => {
    expect(creditRequestOf({ scope: 'whole', amount: '50', reason: ' Errore ' })).toEqual({ reason: 'Errore' });
    expect(creditRequestOf({ scope: 'part', amount: '50,5', reason: 'Errore' })).toEqual({ amount: 50.5, reason: 'Errore' });
  });
});
