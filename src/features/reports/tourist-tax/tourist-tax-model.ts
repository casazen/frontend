import { z } from 'zod';
import type { ReportPeriod } from '@/api/reports.api';
import { FISCAL_REPORT_CURRENCY, formatMoney } from '@/features/fiscal/fiscal-format';
import type { ReportSource } from '@/features/reports/report-catalog';
import { periodProblem } from '@/features/reports/report-period';
import { parseEuros } from '@/features/supplier/services/lib/service-money';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import type { RecordTouristTaxRemittanceInput, TouristTaxRemittance } from '@/types';

/**
 * Pure helpers of the tourist tax summary page (NF-100): how a payment typed by the host becomes the form the API reads, which
 * receipts the page accepts, how a downloaded file is named. The figures of the summary are the server's: nothing here adds, subtracts
 * or compares an amount (the only arithmetic is turning the text the host typed into cents and back).
 */

/** The days of the page follow the rule of the tourist tax report: a year at most (the fiscal source of `periodProblem`). */
export const TOURIST_TAX_PERIOD_SOURCE: ReportSource = { kind: 'fiscal', report: 'touristTax' };

/** The largest receipt the API stores (a PDF or a photo of a payment slip). */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/** The kinds of receipt the API accepts, judged there on the content: a PDF, a JPEG or a PNG. */
const RECEIPT_TYPES: readonly string[] = ['application/pdf', 'image/jpeg', 'image/png'];
const RECEIPT_EXTENSION = /\.(pdf|jpe?g|png)$/i;

/** What the file picker offers for the receipt. */
export const RECEIPT_ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';

/** The longest reference and note the API stores (its columns). */
export const REFERENCE_MAX_LENGTH = 200;
export const NOTES_MAX_LENGTH = 500;

/** The largest payment the API takes (one billion euros), in cents. */
const MAX_AMOUNT_CENTS = 100_000_000_000;

/** An amount with more than one separator, written the way thousands are grouped: `1.250,00`, `1,250.00`, `1.234.567`. */
const GROUPED_AMOUNT = /^\d{1,3}(?:(?:\.\d{3})+(?:,\d{1,2})?|(?:,\d{3})+(?:\.\d{1,2})?)$/;

/**
 * `parseEuros` takes as thousands any text that repeats a separator, whatever the size of its groups: `1.250.00` would be 125000
 * euros, `12.50.30` 125030 and `1.2.3` 123, a payment of a hundred times what the host meant. A text with more than one separator is
 * read only when it is grouped like a number: groups of three digits with one separator, then the other one for the cents. A single
 * separator is left to `parseEuros`, which tells thousands (`1.250`) from cents (`12.50`).
 */
function hasSoundGroups(input: string): boolean {
  const text = input.replace(/[\s€]/g, '');
  const separators = text.match(/[.,]/g)?.length ?? 0;
  return separators < 2 || GROUPED_AMOUNT.test(text);
}

/**
 * An amount to read, from the cents the server sends: `1.234,56 €` in Italian, `€1,234.56` in English. The tourist tax of these pages is the Italian one, by comune, paid in euro: the answers carry
 * no currency, so the currency of the Italian tax reports is named here.
 */
export function formatCents(cents: number, locale: string): string {
  return formatMoney(cents / 100, locale, FISCAL_REPORT_CURRENCY);
}

/**
 * The cents an amount typed by the host stands for (`125,50`, `125.5`, `1.250,00`), or null when it is not a payment: blank, not a
 * number, more than two decimals, more than one separator with groups that are not of three digits (`1.250.00`), zero or more than
 * the API takes.
 */
export function remittanceAmountCents(input: string): number | null {
  if (!hasSoundGroups(input)) return null;
  const { cents } = parseEuros(input);
  return cents !== null && Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_AMOUNT_CENTS ? cents : null;
}

/**
 * The amount as the API reads it: euros as text with a dot and two decimals (`1250.00`), built from the cents with no float, or null
 * when the text is not a payment. The API reads the form with the culture of the request, where the Italian dot is a thousands
 * separator: a number or a text with a comma would not be the amount the host typed.
 */
export function remittanceAmountText(input: string): string | null {
  const cents = remittanceAmountCents(input);
  return cents === null ? null : `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/** A receipt the page accepts: a PDF, a JPEG or a PNG by its type (by its name when the system gave it none). */
export function isReceiptFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type === '' ? RECEIPT_EXTENSION.test(file.name) : RECEIPT_TYPES.includes(file.type);
}

/**
 * What the dialog asks before it sends a payment (messages are i18n keys, as in every form). They are the rules the API applies,
 * said where the host can still fix them: the amount above zero to the cent, a period that is not backwards and lasts a year at
 * most, a day of payment that is not after today (Europe/Rome), a receipt that is a PDF, a JPEG or a PNG of 10 MB at most.
 */
export const recordPaymentSchema = z
  .object({
    comune: z.string().trim().min(1, 'reports.touristTax.record.validation.comuneRequired'),
    periodFrom: z.string().refine(isStayDate, 'reports.touristTax.record.validation.periodFromRequired'),
    periodTo: z.string().refine(isStayDate, 'reports.touristTax.record.validation.periodToRequired'),
    amount: z.string().refine((text) => remittanceAmountText(text) !== null, 'reports.touristTax.record.validation.amountInvalid'),
    paidOn: z.string().refine(isStayDate, 'reports.touristTax.record.validation.paidOnRequired'),
    reference: z.string().max(REFERENCE_MAX_LENGTH, 'reports.touristTax.record.validation.referenceTooLong'),
    notes: z.string().max(NOTES_MAX_LENGTH, 'reports.touristTax.record.validation.notesTooLong'),
    receipt: z
      .custom<File | null>((value) => value === null || value instanceof File, 'reports.touristTax.record.validation.receiptType')
      .refine((file) => file === null || isReceiptFile(file), 'reports.touristTax.record.validation.receiptType')
      .refine((file) => file === null || file.size > 0, 'reports.touristTax.record.validation.receiptEmpty')
      .refine((file) => file === null || file.size <= MAX_RECEIPT_BYTES, 'reports.touristTax.record.validation.receiptTooLarge'),
  })
  .superRefine((values, context) => {
    if (isStayDate(values.periodFrom) && isStayDate(values.periodTo)) {
      const problem = periodProblem({ from: values.periodFrom, to: values.periodTo }, TOURIST_TAX_PERIOD_SOURCE);
      if (problem !== null) {
        context.addIssue({
          code: 'custom',
          path: ['periodTo'],
          message:
            problem === 'invalidDates'
              ? 'reports.touristTax.record.validation.periodOrder'
              : 'reports.touristTax.record.validation.periodTooLong',
        });
      }
    }
    if (isStayDate(values.paidOn) && values.paidOn > todayInRome()) {
      context.addIssue({ code: 'custom', path: ['paidOn'], message: 'reports.touristTax.record.validation.paidOnFuture' });
    }
  });

export type RecordPaymentFormValues = z.infer<typeof recordPaymentSchema>;

/** The dialog opens on the comune of the row and on the days of the summary the host is looking at, so the payment shows in it. */
export function defaultPaymentValues(comune: string, period: ReportPeriod): RecordPaymentFormValues {
  return { comune, periodFrom: period.from, periodTo: period.to, amount: '', paidOn: todayInRome(), reference: '', notes: '', receipt: null };
}

/** The payment as the API takes it, or null when the amount is not one (the schema has refused it before this is asked). */
export function toRemittanceInput(values: RecordPaymentFormValues): RecordTouristTaxRemittanceInput | null {
  const paidAmount = remittanceAmountText(values.amount);
  if (paidAmount === null) return null;
  const reference = values.reference.trim();
  const notes = values.notes.trim();
  return {
    comune: values.comune.trim(),
    periodFrom: values.periodFrom,
    periodTo: values.periodTo,
    paidAmount,
    paidOn: values.paidOn,
    ...(reference ? { reference } : {}),
    ...(notes ? { notes } : {}),
    ...(values.receipt ? { receipt: values.receipt } : {}),
  };
}

const RECEIPT_EXTENSIONS = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
]);

/** The name of a comune as a word of a file name: printable ASCII only, lower case, dashes between the words. */
function fileNameWord(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[^ -~]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The name a receipt is saved under: the payment (comune and day) and the extension of what the file really is, which the server
 * decided from its content (the name the host sent is not readable from the browser).
 */
export function receiptFileName(remittance: Pick<TouristTaxRemittance, 'comune' | 'paidOn'>, blob: Pick<Blob, 'type'>): string {
  const extension = RECEIPT_EXTENSIONS.get(blob.type.split(';')[0].trim().toLowerCase());
  const name = ['casazen-ricevuta-imposta-soggiorno', fileNameWord(remittance.comune), remittance.paidOn].filter(Boolean).join('-');
  return extension ? `${name}.${extension}` : name;
}
