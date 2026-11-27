import { z } from 'zod';
import type { ReportPeriod } from '@/api/reports.api';
import { FISCAL_REPORT_CURRENCY, formatMoney } from '@/features/fiscal/fiscal-format';
import type { ReportSource } from '@/features/reports/report-catalog';
import { periodProblem } from '@/features/reports/report-period';
import { parseEuros } from '@/features/supplier/services/lib/service-money';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import type { RecordTouristTaxRemittanceInput, TouristTaxRemittance } from '@/types';

export const TOURIST_TAX_PERIOD_SOURCE: ReportSource = { kind: 'fiscal', report: 'touristTax' };

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

const RECEIPT_TYPES: readonly string[] = ['application/pdf', 'image/jpeg', 'image/png'];
const RECEIPT_EXTENSION = /\.(pdf|jpe?g|png)$/i;

export const RECEIPT_ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';

export const REFERENCE_MAX_LENGTH = 200;
export const NOTES_MAX_LENGTH = 500;

const MAX_AMOUNT_CENTS = 100_000_000_000;

const GROUPED_AMOUNT = /^\d{1,3}(?:(?:\.\d{3})+(?:,\d{1,2})?|(?:,\d{3})+(?:\.\d{1,2})?)$/;

function hasSoundGroups(input: string): boolean {
  const text = input.replace(/[\s€]/g, '');
  const separators = text.match(/[.,]/g)?.length ?? 0;
  return separators < 2 || GROUPED_AMOUNT.test(text);
}

export function formatCents(cents: number, locale: string): string {
  return formatMoney(cents / 100, locale, FISCAL_REPORT_CURRENCY);
}

export function remittanceAmountCents(input: string): number | null {
  if (!hasSoundGroups(input)) return null;
  const { cents } = parseEuros(input);
  return cents !== null && Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_AMOUNT_CENTS ? cents : null;
}

export function remittanceAmountText(input: string): string | null {
  const cents = remittanceAmountCents(input);
  return cents === null ? null : `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export function isReceiptFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type === '' ? RECEIPT_EXTENSION.test(file.name) : RECEIPT_TYPES.includes(file.type);
}

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

export function defaultPaymentValues(comune: string, period: ReportPeriod): RecordPaymentFormValues {
  return { comune, periodFrom: period.from, periodTo: period.to, amount: '', paidOn: todayInRome(), reference: '', notes: '', receipt: null };
}

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

function fileNameWord(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[^ -~]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function receiptFileName(remittance: Pick<TouristTaxRemittance, 'comune' | 'paidOn'>, blob: Pick<Blob, 'type'>): string {
  const extension = RECEIPT_EXTENSIONS.get(blob.type.split(';')[0].trim().toLowerCase());
  const name = ['casazen-ricevuta-imposta-soggiorno', fileNameWord(remittance.comune), remittance.paidOn].filter(Boolean).join('-');
  return extension ? `${name}.${extension}` : name;
}
