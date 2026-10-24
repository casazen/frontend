import { z } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { isValidFiscalCode } from '@/lib/fiscal-code';
import { isStayDate } from '@/lib/stay-dates';
import type { DataStep } from './wizard-model';

/**
 * The checks of the form, step by step, for the FORMAT of what is typed: a fiscal code that cannot be one, an address that is not an
 * address, an amount that is not an amount, a date that is not a day. Whether the step is COMPLETE is the server's to say
 * (`flow.needs`), so an empty field is never a format error here. Messages are i18n keys, translated where they are shown.
 */

const empty = (value: string) => value.trim() === '';

const EMAIL = z.string().email();
const AMOUNT = /^\d+(\.\d{1,2})?$/;

const party = z.object({
  fiscalCode: z.string().refine((value) => empty(value) || isValidFiscalCode(value), 'leaseWizard.validation.fiscalCode'),
  citizenship: z.string().refine((value) => empty(value) || /^[A-Za-z]{2}$/.test(value.trim()), 'leaseWizard.validation.citizenship'),
  contactEmail: z.string().refine((value) => empty(value) || EMAIL.safeParse(value.trim()).success, 'leaseWizard.validation.email'),
});

/** An amount written with at most two decimals (the field is a number input: the decimal point is a dot). */
const amount = (positive: boolean, message: string) =>
  z.string().refine((value) => {
    const text = value.trim();
    return text === '' || (AMOUNT.test(text) && (!positive || Number(text) > 0));
  }, message);

const day = (message: string) => z.string().refine((value) => empty(value) || isStayDate(value), message);

export const STEP_SCHEMAS: Record<DataStep, z.ZodType<unknown, FieldValues>> = {
  1: z.object({ propertyId: z.string().min(1, 'leaseWizard.validation.property') }),
  2: z.object({ landlords: z.array(party), tenants: z.array(party) }),
  3: z.object({
    monthlyRent: amount(true, 'leaseWizard.validation.rent'),
    securityDeposit: amount(false, 'leaseWizard.validation.deposit'),
  }),
  4: z
    .object({ startDate: day('leaseWizard.validation.date'), endDate: day('leaseWizard.validation.date') })
    .refine((value) => empty(value.startDate) || empty(value.endDate) || value.endDate > value.startDate, {
      message: 'leaseWizard.validation.endAfterStart',
      path: ['endDate'],
    }),
};
