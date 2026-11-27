import { afterEach, describe, expect, it, vi } from 'vitest';
import { freezeClock, NOON_UTC } from '@/test/clock';
import {
  MAX_RECEIPT_BYTES,
  defaultPaymentValues,
  isReceiptFile,
  receiptFileName,
  recordPaymentSchema,
  remittanceAmountCents,
  remittanceAmountText,
  toRemittanceInput,
  type RecordPaymentFormValues,
} from '../tourist-tax-model';

// 24 September 2026 is "today" in Rome in these tests.
const TODAY = '2026-09-24';

function payment(overrides: Partial<RecordPaymentFormValues> = {}): RecordPaymentFormValues {
  return {
    comune: 'Milano',
    periodFrom: '2026-07-01',
    periodTo: '2026-09-30',
    amount: '125,50',
    paidOn: '2026-09-20',
    reference: '',
    notes: '',
    receipt: null,
    ...overrides,
  };
}

/** The refusals of the form as `field: message`. */
function refusals(values: RecordPaymentFormValues): string[] {
  const result = recordPaymentSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

afterEach(() => {
  vi.useRealTimers();
});

// NF-100 / money: the API reads `paidAmount` as text with a dot, because a form is read with the culture of the request, where the Italian
// dot is a thousands separator. The host writes the amount the way an Italian does; what goes out is built from the cents, with no float.
describe('remittanceAmountText (NF-100)', () => {
  it.each([
    ['125,50', '125.50'],
    ['125.5', '125.50'],
    ['12.50', '12.50'],
    ['1.250,00', '1250.00'],
    ['1,250.00', '1250.00'],
    ['1.234.567,89', '1234567.89'],
    ['12', '12.00'],
    [' € 7,05 ', '7.05'],
    ['0,01', '0.01'],
    ['1000000000', '1000000000.00'],
  ])('AmountTyped_%s_GoesToTheApiAs_%s', (typed, sent) => {
    expect(remittanceAmountText(typed)).toBe(sent);
  });

  it.each(['', '   ', 'abc', '0', '0,00', '-5', '12,3456', '1000000000,01', '1.250.00', '12.50.30', '1.2.3', '1,250,00'])(
    'AmountTyped_%j_IsNotAPayment',
    (typed) => {
      expect(remittanceAmountText(typed)).toBeNull();
      expect(remittanceAmountCents(typed)).toBeNull();
    },
  );

  it('AmountTyped_PointAndComma_AreReadAsAnItalianWritesThem', () => {
    // The mistake the text exists to avoid: "12.50" read with the Italian culture is 1250. Here it stays twelve euros and fifty cents,
    // and a point followed by exactly three digits groups the thousands (1.250 euros), as the other money fields of the app read it.
    expect(remittanceAmountCents('12.50')).toBe(1250);
    expect(remittanceAmountCents('12,50')).toBe(1250);
    expect(remittanceAmountCents('1.250')).toBe(125000);
  });

  it('AmountTyped_MoreThanOneSeparator_IsReadOnlyWhenTheGroupsAreOfThreeDigits', () => {
    // Money: the reading of the thousands alone takes "1.250.00" for 125000 euros, "12.50.30" for 125030 and "1.2.3" for 123, a payment of
    // a hundred times what the host meant. Only a text grouped like a number is read: three digits per group, one separator for the
    // thousands and the other for the cents.
    expect(remittanceAmountCents('1.250.000')).toBe(125_000_000);
    expect(remittanceAmountCents('1.250.000,50')).toBe(125_000_050);
    expect(remittanceAmountCents('1,250,000.50')).toBe(125_000_050);
    for (const typed of ['1.250.00', '12.50.30', '1.2.3', '1,250,00', '1250.000,00', '1.250,000']) {
      expect(remittanceAmountCents(typed), typed).toBeNull();
    }
  });
});

describe('recordPaymentSchema (NF-100)', () => {
  it('RecordPayment_ValidPayment_PassesWithNoRefusal', () => {
    freezeClock(NOON_UTC);

    expect(refusals(payment())).toEqual([]);
    expect(refusals(payment({ paidOn: TODAY }))).toEqual([]);
  });

  it('RecordPayment_AmountThatIsNotAPayment_IsRefusedOnTheAmount', () => {
    freezeClock(NOON_UTC);

    expect(refusals(payment({ amount: '0' }))).toEqual(['amount: reports.touristTax.record.validation.amountInvalid']);
    expect(refusals(payment({ amount: '' }))).toEqual(['amount: reports.touristTax.record.validation.amountInvalid']);
  });

  it('RecordPayment_AmountWithGroupsThatAreNotOfThreeDigits_IsRefusedOnTheAmount', () => {
    freezeClock(NOON_UTC);

    // Money: a payment of a hundred times what the host meant is refused where it is typed, not recorded.
    for (const amount of ['1.250.00', '12.50.30', '1.2.3']) {
      expect(refusals(payment({ amount })), amount).toEqual(['amount: reports.touristTax.record.validation.amountInvalid']);
    }
    for (const amount of ['125,50', '1.250,00', '12.50']) {
      expect(refusals(payment({ amount })), amount).toEqual([]);
    }
  });

  it('RecordPayment_DayAfterToday_IsRefusedOnTheDayOfPayment', () => {
    freezeClock(NOON_UTC);

    expect(refusals(payment({ paidOn: '2026-09-25' }))).toEqual(['paidOn: reports.touristTax.record.validation.paidOnFuture']);
  });

  it('RecordPayment_PeriodBackwards_IsRefusedOnTheLastDay', () => {
    freezeClock(NOON_UTC);

    expect(refusals(payment({ periodFrom: '2026-09-30', periodTo: '2026-07-01' }))).toEqual([
      'periodTo: reports.touristTax.record.validation.periodOrder',
    ]);
  });

  it('RecordPayment_PeriodOfMoreThanAYear_IsRefusedAndAYearIsNot', () => {
    freezeClock(NOON_UTC);

    // 366 days, both ends included, is the longest the API takes (the rule of the tourist tax report).
    expect(refusals(payment({ periodFrom: '2025-01-01', periodTo: '2026-01-01' }))).toEqual([]);
    expect(refusals(payment({ periodFrom: '2025-01-01', periodTo: '2026-01-02' }))).toEqual([
      'periodTo: reports.touristTax.record.validation.periodTooLong',
    ]);
  });

  it('RecordPayment_MissingDays_AreRefusedOnTheirOwnField', () => {
    freezeClock(NOON_UTC);

    expect(refusals(payment({ periodFrom: '', periodTo: '', paidOn: '' }))).toEqual([
      'periodFrom: reports.touristTax.record.validation.periodFromRequired',
      'periodTo: reports.touristTax.record.validation.periodToRequired',
      'paidOn: reports.touristTax.record.validation.paidOnRequired',
    ]);
  });

  it('RecordPayment_TextsLongerThanTheirColumns_AreRefused', () => {
    freezeClock(NOON_UTC);

    expect(refusals(payment({ reference: 'x'.repeat(201), notes: 'y'.repeat(501) }))).toEqual([
      'reference: reports.touristTax.record.validation.referenceTooLong',
      'notes: reports.touristTax.record.validation.notesTooLong',
    ]);
  });

  it('RecordPayment_Receipt_IsAPdfAJpegOrAPngOfTenMegabytesAtMost', () => {
    freezeClock(NOON_UTC);
    const pdf = new File(['%PDF-1.4'], 'rav.pdf', { type: 'application/pdf' });
    const tooBig = new File(['%PDF-1.4'], 'rav.pdf', { type: 'application/pdf' });
    Object.defineProperty(tooBig, 'size', { value: MAX_RECEIPT_BYTES + 1 });
    const atTheLimit = new File(['%PDF-1.4'], 'rav.pdf', { type: 'application/pdf' });
    Object.defineProperty(atTheLimit, 'size', { value: MAX_RECEIPT_BYTES });

    expect(refusals(payment({ receipt: pdf }))).toEqual([]);
    expect(refusals(payment({ receipt: atTheLimit }))).toEqual([]);
    expect(refusals(payment({ receipt: tooBig }))).toEqual(['receipt: reports.touristTax.record.validation.receiptTooLarge']);
    expect(refusals(payment({ receipt: new File(['MZ'], 'rav.exe', { type: 'application/x-msdownload' }) }))).toEqual([
      'receipt: reports.touristTax.record.validation.receiptType',
    ]);
    expect(refusals(payment({ receipt: new File([], 'rav.pdf', { type: 'application/pdf' }) }))).toEqual([
      'receipt: reports.touristTax.record.validation.receiptEmpty',
    ]);
  });
});

describe('isReceiptFile (NF-100)', () => {
  it.each([
    [{ name: 'a.pdf', type: 'application/pdf' }, true],
    [{ name: 'a.jpg', type: 'image/jpeg' }, true],
    [{ name: 'a.png', type: 'image/png' }, true],
    [{ name: 'scan.JPG', type: '' }, true],
    [{ name: 'scan.exe', type: '' }, false],
    [{ name: 'a.gif', type: 'image/gif' }, false],
    [{ name: 'a.pdf', type: 'application/x-msdownload' }, false],
  ])('File_%j_IsAReceipt_%s', (file, expected) => {
    expect(isReceiptFile(file)).toBe(expected);
  });
});

describe('toRemittanceInput (NF-100)', () => {
  it('ToRemittanceInput_TypedAmount_GoesAsTextWithADotAndTheEmptyTextsStayOut', () => {
    expect(toRemittanceInput(payment({ amount: '1.250,00', reference: '  RAV 0042 ', notes: '   ' }))).toEqual({
      comune: 'Milano',
      periodFrom: '2026-07-01',
      periodTo: '2026-09-30',
      paidAmount: '1250.00',
      paidOn: '2026-09-20',
      reference: 'RAV 0042',
    });
  });

  it('ToRemittanceInput_Receipt_GoesWithThePayment', () => {
    const receipt = new File(['%PDF-1.4'], 'rav.pdf', { type: 'application/pdf' });

    expect(toRemittanceInput(payment({ receipt }))?.receipt).toBe(receipt);
  });

  it('ToRemittanceInput_AmountThatIsNotAPayment_IsNothingToSend', () => {
    expect(toRemittanceInput(payment({ amount: 'abc' }))).toBeNull();
  });
});

describe('defaultPaymentValues (NF-100)', () => {
  it('DefaultPaymentValues_Row_StartsFromTheComuneAndTheDaysOfTheSummary', () => {
    freezeClock(NOON_UTC);

    expect(defaultPaymentValues('Milano', { from: '2026-01-01', to: '2026-12-31' })).toEqual({
      comune: 'Milano',
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
      amount: '',
      paidOn: TODAY,
      reference: '',
      notes: '',
      receipt: null,
    });
  });
});

describe('receiptFileName (NF-100)', () => {
  it.each([
    [{ comune: 'Forlì', paidOn: '2026-10-05' }, 'application/pdf', 'casazen-ricevuta-imposta-soggiorno-forli-2026-10-05.pdf'],
    [{ comune: "Sant'Angelo Lodigiano", paidOn: '2026-10-05' }, 'image/jpeg', 'casazen-ricevuta-imposta-soggiorno-sant-angelo-lodigiano-2026-10-05.jpg'],
    [{ comune: 'Milano', paidOn: '2026-10-05' }, 'image/png', 'casazen-ricevuta-imposta-soggiorno-milano-2026-10-05.png'],
    [{ comune: 'Milano', paidOn: '2026-10-05' }, 'application/pdf; charset=binary', 'casazen-ricevuta-imposta-soggiorno-milano-2026-10-05.pdf'],
    [{ comune: 'Milano', paidOn: '2026-10-05' }, 'application/octet-stream', 'casazen-ricevuta-imposta-soggiorno-milano-2026-10-05'],
  ])('Receipt_%j_As_%s_IsSavedAs_%s', (remittance, type, expected) => {
    expect(receiptFileName(remittance, { type })).toBe(expected);
  });
});
