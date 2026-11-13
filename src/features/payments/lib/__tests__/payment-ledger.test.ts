import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getManifestEntry, hasEntryPermission, isEntryFeatureEnabled, type RouteManifestEntry } from '@/config/route-manifest';
import i18n from '@/i18n/config';
import { statusLabel } from '@/components/shared/status/status-view';
import { PAYMENT_LEDGER_KINDS, PAYMENT_LEDGER_STATES, type PaymentLedgerLine } from '@/types';
import {
  defaultPeriod,
  documentLinkOf,
  FISCAL_DOCUMENTS_PATH,
  formatLedgerAmount,
  formatLedgerDay,
  formatLedgerFee,
  ledgerBadgeStatus,
  LEDGER_DOCUMENT_CODES,
  ledgerDocumentKey,
  ledgerReadOf,
  ledgerRowsOf,
  ledgerSourceKey,
  periodProblemOf,
  providerCurrencyOf,
} from '../payment-ledger';

// The route of the fiscal documents is another task's: what is asked of it here is controlled by each test, so none of them depends on whether it has landed.
vi.mock('@/config/route-manifest', () => ({
  getManifestEntry: vi.fn(),
  hasEntryPermission: vi.fn(),
  isEntryFeatureEnabled: vi.fn(),
}));

const line = (overrides: Partial<PaymentLedgerLine> = {}): PaymentLedgerLine => ({
  kind: 'Card',
  bookingId: 'b-1',
  bookingCode: 'ABCDE-FGHJK',
  paymentId: 'p-1',
  date: '2026-11-05',
  gross: 100,
  currency: 'EUR',
  state: 'Paid',
  collectedBy: 'Host',
  ...overrides,
});

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
});

describe('formatLedgerAmount (money rule: the figure of the server, in the language of the person and the currency of the line)', () => {
  it('formatLedgerAmount_Euro_ItalianAndEnglishAreWrittenWithTheirOwnSeparators', () => {
    expect(formatLedgerAmount(12345.5, 'EUR', 'it')).toMatch(/^12\.345,50\s€$/);
    expect(formatLedgerAmount(12345.5, 'EUR', 'en')).toBe('€12,345.50');
    // The grouping is the one of the language (Italian has none under five digits): the format is Intl's, nothing of the page's own.
    expect(formatLedgerAmount(1234.5, 'EUR', 'it')).toMatch(/^1234,50\s€$/);
  });

  it('formatLedgerAmount_Francs_AreFrancsAndNeverEuros', () => {
    const chf = formatLedgerAmount(200, 'CHF', 'it');
    expect(chf).toMatch(/^200,00\sCHF$/);
    expect(chf).not.toContain('€');
    expect(formatLedgerAmount(200, 'CHF', 'en')).toMatch(/^CHF\s200\.00$/);
  });

  it('formatLedgerAmount_AFigureWithMoreDecimals_IsNotRoundedToTheCent', () => {
    // What the server sent is what is shown: the format does not cut it.
    expect(formatLedgerAmount(12.345, 'EUR', 'it')).toMatch(/^12,345\s€$/);
    // And a figure that is already to the cent keeps its two decimals.
    expect(formatLedgerAmount(12.5, 'EUR', 'it')).toMatch(/^12,50\s€$/);
  });

  it('formatLedgerAmount_ACurrencyThatIsNotACode_IsWrittenAsItCameAndNeverBecomesEuro', () => {
    expect(formatLedgerAmount(5, '', 'it')).toBe('5');
    expect(formatLedgerAmount(5, 'franchi', 'it')).toBe('5 franchi');
    expect(formatLedgerAmount(5, '', 'it')).not.toContain('€');
  });

  it('formatLedgerAmount_ALanguageTheRuntimeDoesNotKnow_DoesNotCrash', () => {
    expect(formatLedgerAmount(1, 'EUR', 'not a language tag')).toMatch(/^1,00\s€$/);
  });
});

describe('formatLedgerFee (money rule: a commission is a deduction)', () => {
  it('formatLedgerFee_APositiveFee_IsWrittenWithAMinus', () => {
    expect(formatLedgerFee(1.5, 'EUR', 'it')).toMatch(/^-1,50\s€$/);
    expect(formatLedgerFee(1.5, 'EUR', 'en')).toBe('-€1.50');
  });

  it('formatLedgerFee_AFeeTheServerWroteWithAMinus_IsNotTurnedIntoAPlusOrADoubleMinus', () => {
    expect(formatLedgerFee(-1.5, 'EUR', 'it')).toMatch(/^-1,50\s€$/);
  });

  it('formatLedgerFee_Zero_IsZeroAndNeverMinusZero', () => {
    expect(formatLedgerFee(0, 'EUR', 'it')).toMatch(/^0,00\s€$/);
    expect(formatLedgerFee(-0, 'EUR', 'it')).toMatch(/^0,00\s€$/);
  });
});

describe('providerCurrencyOf and formatLedgerDay', () => {
  it('providerCurrencyOf_TheBalanceOfTheProviderWins_ElseTheCurrencyOfTheLine', () => {
    expect(providerCurrencyOf({ providerCurrency: 'EUR', currency: 'CHF' })).toBe('EUR');
    expect(providerCurrencyOf({ providerCurrency: null, currency: 'CHF' })).toBe('CHF');
    expect(providerCurrencyOf({ currency: 'CHF' })).toBe('CHF');
  });

  it('formatLedgerDay_ADay_IsWrittenInTheLanguageOfThePersonAndWhatIsNotADayAsItCame', () => {
    expect(formatLedgerDay('2026-11-05', 'it')).toBe('5 nov 2026');
    expect(formatLedgerDay('2026-11-05', 'en')).toBe('Nov 5, 2026');
    expect(formatLedgerDay('not a day', 'it')).toBe('not a day');
  });
});

describe('the state of a line (money rule: only a line that is paid says collected)', () => {
  const word = (state: string) => statusLabel('payment', ledgerBadgeStatus(state), 'host', i18n.t, i18n);

  it('ledgerBadgeStatus_EveryState_HasItsOwnWordsAndOnlyPaidIsCollected', () => {
    expect(word('Paid')).toBe('Incassato');
    expect(word('ToCollect')).toBe('Da incassare');
    expect(word('Refunded')).toBe('Rimborsato');
    expect(word('PartiallyRefunded')).toBe('Rimborsato in parte');
    expect(word('Failed')).toBe('Non riuscito');
    expect(word('Canceled')).toBe('Annullato');
    for (const state of PAYMENT_LEDGER_STATES.filter((state) => state !== 'Paid')) {
      expect(word(state)).not.toBe('Incassato');
    }
  });

  it('ledgerBadgeStatus_AStateTheClientDoesNotKnow_GoesAsItCameAndIsNeverCollected', () => {
    expect(ledgerBadgeStatus('SomethingNew')).toBe('SomethingNew');
    expect(word('SomethingNew')).toBe('SomethingNew');
    // A name that is a member of every object must not be mistaken for a state.
    expect(ledgerBadgeStatus('constructor')).toBe('constructor');
    expect(ledgerBadgeStatus('toString')).toBe('toString');
  });

  it('ledgerBadgeStatus_English_UsesTheWordsOfThePayments', async () => {
    await i18n.changeLanguage('en');
    expect(statusLabel('payment', ledgerBadgeStatus('ToCollect'), 'host', i18n.t, i18n)).toBe('To collect');
    expect(statusLabel('payment', ledgerBadgeStatus('Paid'), 'host', i18n.t, i18n)).toBe('Collected');
  });
});

describe('ledgerSourceKey (where the money comes from)', () => {
  it('ledgerSourceKey_CardBankTransferCashAndOther_HaveTheirWords', () => {
    expect(ledgerSourceKey(line({ kind: 'Card' }))).toBe('paymentLedger.source.Card');
    expect(ledgerSourceKey(line({ kind: 'BankTransfer' }))).toBe('paymentLedger.source.BankTransfer');
    expect(ledgerSourceKey(line({ kind: 'Cash' }))).toBe('paymentLedger.source.Cash');
    expect(ledgerSourceKey(line({ kind: 'Other' }))).toBe('paymentLedger.source.Other');
  });

  it('ledgerSourceKey_AChannelLine_SaysCollectedByTheChannelOnlyWhenItIsPaidAndTheChannelCollectsIt', () => {
    expect(ledgerSourceKey(line({ kind: 'Ota', collectedBy: 'Channel', state: 'Paid' }))).toBe('paymentLedger.source.OtaCollected');
    // Still to collect: never "Incassato dal canale".
    expect(ledgerSourceKey(line({ kind: 'Ota', collectedBy: 'Channel', state: 'ToCollect' }))).toBe('paymentLedger.source.Ota');
    expect(ledgerSourceKey(line({ kind: 'Ota', collectedBy: 'Unknown', state: 'Paid' }))).toBe('paymentLedger.source.Ota');
    expect(ledgerSourceKey(line({ kind: 'Ota', collectedBy: 'Host', state: 'Paid' }))).toBe('paymentLedger.source.OtaHost');
    expect(ledgerSourceKey(line({ kind: 'Ota', collectedBy: 'Host', state: 'ToCollect' }))).toBe('paymentLedger.source.OtaHost');
  });

  it('ledgerSourceKey_AKindTheClientDoesNotKnow_IsNullSoTheScreenShowsItAsItCame', () => {
    expect(ledgerSourceKey({ kind: 'Crypto' as never, state: 'Paid', collectedBy: 'Host' })).toBeNull();
  });

  it('ledgerTexts_EveryKindEveryCodeOfTheDocument_HaveWordsInBothLanguages', () => {
    const keys = [
      ...PAYMENT_LEDGER_KINDS.map((kind) => `paymentLedger.source.${kind}`),
      'paymentLedger.source.OtaCollected',
      'paymentLedger.source.OtaHost',
      ...(Object.keys(LEDGER_DOCUMENT_CODES) as Array<keyof typeof LEDGER_DOCUMENT_CODES>).flatMap((part) =>
        LEDGER_DOCUMENT_CODES[part].map((code) => ledgerDocumentKey(part, code) as string),
      ),
    ];
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) {
      expect(i18n.exists(key, { lng: 'it' }), `${key} in it`).toBe(true);
      expect(i18n.exists(key, { lng: 'en' }), `${key} in en`).toBe(true);
    }
  });

  it('ledgerDocumentKey_ACodeTheClientHasNoWordsFor_IsNull', () => {
    expect(ledgerDocumentKey('kind', 'Invoice')).toBe('paymentLedger.document.kind.Invoice');
    expect(ledgerDocumentKey('status', 'Issued')).toBe('paymentLedger.document.status.Issued');
    expect(ledgerDocumentKey('paymentState', 'ToCollect')).toBe('paymentLedger.document.paymentState.ToCollect');
    expect(ledgerDocumentKey('kind', 'Hologram')).toBeNull();
    expect(ledgerDocumentKey('status', 'constructor')).toBeNull();
  });
});

describe('documentLinkOf (no link to a page that is not there or that the caller cannot open)', () => {
  const entry = { path: FISCAL_DOCUMENTS_PATH } as RouteManifestEntry;
  const allow = () => true;

  it('documentLinkOf_RouteRegisteredFlagOnAndPermissionHeld_IsThePathOfTheDocuments', () => {
    vi.mocked(getManifestEntry).mockReturnValue(entry);
    vi.mocked(isEntryFeatureEnabled).mockReturnValue(true);
    vi.mocked(hasEntryPermission).mockReturnValue(true);

    expect(documentLinkOf(allow)).toBe(FISCAL_DOCUMENTS_PATH);
    expect(getManifestEntry).toHaveBeenCalledWith(FISCAL_DOCUMENTS_PATH);
  });

  it.each([
    ['the route is not registered', undefined, true, true],
    ['its flag is off', entry, false, true],
    ['the caller lacks what it asks', entry, true, false],
  ])('documentLinkOf_%s_IsNull', (_case, found, flagOn, permitted) => {
    vi.mocked(getManifestEntry).mockReturnValue(found);
    vi.mocked(isEntryFeatureEnabled).mockReturnValue(flagOn);
    vi.mocked(hasEntryPermission).mockReturnValue(permitted);

    expect(documentLinkOf(allow)).toBeNull();
  });
});

describe('ledgerRowsOf', () => {
  it('ledgerRowsOf_LinesOfAChannelWithNoPaymentAndAlike_GetKeysOfTheirOwn', () => {
    const channel = line({ kind: 'Ota', paymentId: null, collectedBy: 'Channel', gross: 50 });
    const rows = ledgerRowsOf([channel, channel, line()]);

    expect(new Set(rows.map((row) => row.key)).size).toBe(3);
    expect(rows[2].key.startsWith('p-1#')).toBe(true);
  });
});

describe('ledgerReadOf (a read that failed is never an empty ledger, and a 404 is never the cached one)', () => {
  it.each([
    [{ enabled: false, isError: false, status: undefined, hasData: false }, 'idle'],
    [{ enabled: false, isError: true, status: 500, hasData: true }, 'idle'],
    [{ enabled: true, isError: false, status: undefined, hasData: false }, 'loading'],
    [{ enabled: true, isError: false, status: undefined, hasData: true }, 'ok'],
    [{ enabled: true, isError: true, status: 500, hasData: false }, 'failed'],
    [{ enabled: true, isError: true, status: undefined, hasData: false }, 'failed'],
    [{ enabled: true, isError: true, status: 403, hasData: false }, 'forbidden'],
    [{ enabled: true, isError: true, status: 404, hasData: false }, 'notFound'],
    // The query keeps its old lines when a later read fails: the error wins.
    [{ enabled: true, isError: true, status: 404, hasData: true }, 'notFound'],
    [{ enabled: true, isError: true, status: 500, hasData: true }, 'failed'],
  ] as const)('ledgerReadOf_%j_Is_%s', (input, expected) => {
    expect(ledgerReadOf(input)).toBe(expected);
  });
});

describe('the period', () => {
  it('defaultPeriod_AnyDay_IsTheWholeMonth', () => {
    expect(defaultPeriod('2026-11-13')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(defaultPeriod('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it.each([
    [{ from: '2026-11-01', to: '2026-11-30' }, null],
    [{ from: '2026-11-05', to: '2026-11-05' }, null],
    [{ from: '2026-11-30', to: '2026-11-01' }, 'order'],
    [{ from: '', to: '2026-11-30' }, 'incomplete'],
    [{ from: '2026-11-01', to: '' }, 'incomplete'],
    [{ from: '2026-13-01', to: '2026-11-30' }, 'incomplete'],
    [{ from: '0001-01-01', to: '2026-11-30' }, 'incomplete'],
    [{ from: '2026-11-01', to: '9999-12-31' }, 'incomplete'],
  ] as const)('periodProblemOf_%j_Is_%s', (period, expected) => {
    expect(periodProblemOf(period)).toBe(expected);
  });
});
