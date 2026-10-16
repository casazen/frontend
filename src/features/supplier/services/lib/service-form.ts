import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import { z } from 'zod';
import {
  SUPPLIER_SERVICE_WEEKDAYS,
  SUPPLIER_SUPPLEMENT_UNITS,
  type SaveSupplierServiceBody,
  type SupplierService,
  type SupplierServiceSupplement,
  type SupplierServiceWeekday,
  type SupplierSupplementUnit,
} from '@/types/supplier-services';
import type { PriceInput } from './service-labels';
import { SERVICE_LIMITS } from './service-limits';
import { centsToInput, parseEuros } from './service-money';

/** How the supplier asks to be paid: the three ways of the form, over the unit and the quote flag of the API. */
export type PriceMode = 'fixed' | 'hourly' | 'quote';
/** The units a fixed price can have: "per hour" is its own way of asking (`hourly`). */
export type FixedPriceUnit = (typeof FIXED_PRICE_UNITS)[number];

export const FIXED_PRICE_UNITS = ['PerJob', 'PerSet', 'PerSquareMeter'] as const;

/** One supplement in the form: the amounts are what the person typed, the API gets cents. */
export interface SupplementFormValue {
  /** The stable identifier of a supplement that already exists; empty for a new one (it comes from the label when saved). */
  code: string;
  label: string;
  /** Euros, as typed. */
  amount: string;
  per: SupplierSupplementUnit;
  /** The most units a customer can pick, as typed; empty is no limit. */
  max: string;
}

/** The answers of the four steps of the creation and of the page of a service: one set of values for both. */
export interface ServiceFormValues {
  name: string;
  category: string;
  summary: string;
  description: string;
  /** One entry per line. */
  included: string;
  /** One entry per line. */
  excluded: string;
  priceMode: PriceMode;
  fixedUnit: FixedPriceUnit;
  /** Euros, as typed; unused for a service on quote. */
  amount: string;
  pricesIncludeVat: boolean;
  supplements: SupplementFormValue[];
  durationMinutes: number | null;
  /** `null` is the notice of the availability rules. */
  minNoticeHours: number | null;
  weekdays: SupplierServiceWeekday[];
}

/** What a new service starts as: every day (the availability decides the rest), two hours, no price chosen yet. */
export function emptyServiceForm(): ServiceFormValues {
  return {
    name: '',
    category: '',
    summary: '',
    description: '',
    included: '',
    excluded: '',
    priceMode: 'fixed',
    fixedUnit: 'PerJob',
    amount: '',
    pricesIncludeVat: false,
    supplements: [],
    durationMinutes: 120,
    minNoticeHours: null,
    weekdays: [...SUPPLIER_SERVICE_WEEKDAYS],
  };
}

/** The lines of a text box as a list: trimmed, without the blank ones or the repeated ones (as the API does). */
export function splitLines(text: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const key = line.toLocaleLowerCase();
    if (line === '' || seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  return lines;
}

/** A readable identifier for a label: lowercase letters, digits and single hyphens, at most `maxLength` long. */
function slugify(label: string, maxLength: number): string {
  const slug = label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug;
}

/** The code of a new supplement: its label as a slug, with `-2`, `-3`… when another supplement of the service has it. */
function newSupplementCode(label: string, taken: Set<string>): string {
  const base = slugify(label, SERVICE_LIMITS.supplementCodeMaxLength) || 'supplemento';
  let code = base;
  for (let n = 2; taken.has(code); n++) {
    const suffix = `-${n}`;
    code = `${base.slice(0, SERVICE_LIMITS.supplementCodeMaxLength - suffix.length).replace(/-+$/g, '')}${suffix}`;
  }
  taken.add(code);
  return code;
}

/** The supplements of the form as the API wants them: cents, a code for each, no `max` where it makes no sense (a flat amount). */
function toSupplementBodies(rows: readonly SupplementFormValue[]): SupplierServiceSupplement[] {
  const taken = new Set(rows.map((row) => row.code).filter(Boolean));
  return rows.map((row) => {
    const max = row.per === 'flat' || row.max.trim() === '' ? null : Number(row.max);
    return {
      code: row.code || newSupplementCode(row.label, taken),
      label: row.label.trim(),
      amountCents: parseEuros(row.amount).cents ?? 0,
      per: row.per,
      max: max !== null && Number.isFinite(max) ? max : null,
    };
  });
}

const emptyToNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

/**
 * The price the form describes, as the API holds it: a service on quote has no price and the default unit, "per hour" is a
 * unit of its own, a fixed price has the unit that was chosen. The amount is `null` while it is blank or not an amount.
 */
export function priceInputOf(values: Pick<ServiceFormValues, 'priceMode' | 'fixedUnit' | 'amount'>): PriceInput {
  const quote = values.priceMode === 'quote';
  return {
    requiresQuote: quote,
    priceFromCents: quote ? null : parseEuros(values.amount).cents,
    priceUnit: values.priceMode === 'hourly' ? 'PerHour' : quote ? 'PerJob' : values.fixedUnit,
  };
}

/**
 * The body of a save: the whole service, because the API replaces it (a field left out takes its default). A service on
 * quote has no price and the default unit; the days are sent in the week's order. The photos are not part of it: they
 * stay as they are unless `photoUrls` is sent.
 */
export function toServiceBody(values: ServiceFormValues): SaveSupplierServiceBody {
  const price = priceInputOf(values);
  return {
    name: values.name.trim(),
    category: values.category,
    summary: emptyToNull(values.summary),
    description: emptyToNull(values.description),
    priceFromCents: price.priceFromCents,
    priceUnit: price.priceUnit,
    pricesIncludeVat: values.pricesIncludeVat,
    requiresQuote: price.requiresQuote,
    durationMinutes: values.durationMinutes,
    minNoticeHours: values.minNoticeHours,
    weekdays: SUPPLIER_SERVICE_WEEKDAYS.filter((day) => values.weekdays.includes(day)),
    supplements: toSupplementBodies(values.supplements),
    included: splitLines(values.included),
    excluded: splitLines(values.excluded),
  };
}

/**
 * The saved service as the body of a save, with `photoUrls` where the photos change (order, removal). A photo action does
 * not save what is typed in the form but not yet saved: it replaces the photos of the service as the server has it.
 */
export function bodyFromService(service: SupplierService, photoUrls: readonly string[]): SaveSupplierServiceBody {
  return {
    name: service.name,
    category: service.category,
    summary: service.summary,
    description: service.description,
    priceFromCents: service.priceFromCents,
    priceUnit: service.priceUnit,
    pricesIncludeVat: service.pricesIncludeVat,
    requiresQuote: service.requiresQuote,
    durationMinutes: service.durationMinutes,
    minNoticeHours: service.minNoticeHours,
    weekdays: service.weekdays,
    supplements: service.supplements.map((supplement) => ({ ...supplement, max: supplement.max ?? null })),
    included: service.included,
    excluded: service.excluded,
    photoUrls: [...photoUrls],
  };
}

/**
 * The form of a saved service. A service that asks for a quote is "on quote" whatever else it carries (the form has no
 * "from" price for it), and a unit the form has no choice for (per hour on a fixed price) becomes "per job".
 */
export function serviceToForm(service: SupplierService, decimalSeparator: ',' | '.'): ServiceFormValues {
  const priceMode: PriceMode = service.requiresQuote ? 'quote' : service.priceUnit === 'PerHour' ? 'hourly' : 'fixed';
  const fixedUnit = FIXED_PRICE_UNITS.find((unit) => unit === service.priceUnit) ?? 'PerJob';
  return {
    name: service.name,
    category: service.category,
    summary: service.summary ?? '',
    description: service.description ?? '',
    included: service.included.join('\n'),
    excluded: service.excluded.join('\n'),
    priceMode,
    fixedUnit,
    amount: priceMode === 'quote' ? '' : centsToInput(service.priceFromCents, decimalSeparator),
    pricesIncludeVat: service.pricesIncludeVat,
    supplements: service.supplements.map((supplement) => ({
      code: supplement.code,
      label: supplement.label,
      amount: centsToInput(supplement.amountCents, decimalSeparator),
      per: supplement.per,
      max: supplement.max === null || supplement.max === undefined ? '' : String(supplement.max),
    })),
    durationMinutes: service.durationMinutes,
    minNoticeHours: service.minNoticeHours,
    weekdays: service.weekdays,
  };
}

// ─── Rules ────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Issue {
  path: (string | number)[];
  message: string;
}

/** What is wrong with an amount a person typed, as the key of the message; `null` when it is fine. */
function amountProblem(text: string, blankMessage: string): string | null {
  const { cents, problem } = parseEuros(text);
  if (problem === 'blank') return blankMessage;
  if (problem === 'invalid' || cents === null) return 'supplier.services.errors.amountInvalid';
  return cents < 1 || cents > SERVICE_LIMITS.maxAmountCents ? 'supplier.services.errors.amountRange' : null;
}

function addIssues(context: z.RefinementCtx, issues: Issue[]) {
  for (const issue of issues) context.addIssue({ code: 'custom', ...issue });
}

const linesSchema = z.string().superRefine((text, context) => {
  const lines = splitLines(text);
  if (lines.length > SERVICE_LIMITS.maxListItems) context.addIssue({ code: 'custom', message: 'supplier.services.errors.listTooMany' });
  else if (lines.some((line) => line.length > SERVICE_LIMITS.listItemMaxLength)) {
    context.addIssue({ code: 'custom', message: 'supplier.services.errors.listItemTooLong' });
  }
});

const supplementSchema = z
  .object({
    code: z.string(),
    label: z
      .string()
      .trim()
      .min(1, 'supplier.services.errors.supplementLabelRequired')
      .max(SERVICE_LIMITS.supplementLabelMaxLength, 'supplier.services.errors.supplementLabelTooLong'),
    amount: z.string(),
    per: z.enum(SUPPLIER_SUPPLEMENT_UNITS),
    max: z.string(),
  })
  .superRefine((supplement, context) => {
    const issues: Issue[] = [];
    const amount = amountProblem(supplement.amount, 'supplier.services.errors.supplementAmountRequired');
    if (amount) issues.push({ path: ['amount'], message: amount });
    const max = supplement.max.trim();
    // A flat amount is added once: it has no quantity to limit.
    if (supplement.per !== 'flat' && max !== '') {
      const count = Number(max);
      if (!/^\d+$/.test(max) || count < 1 || count > SERVICE_LIMITS.maxSupplementQuantity) {
        issues.push({ path: ['max'], message: 'supplier.services.errors.supplementMaxInvalid' });
      }
    }
    addIssues(context, issues);
  });

/** The first step: what the service is. */
export const serviceStepSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'supplier.services.errors.nameRequired')
    .max(SERVICE_LIMITS.nameMaxLength, 'supplier.services.errors.nameTooLong'),
  category: z.string().min(1, 'supplier.services.errors.categoryRequired'),
  summary: z.string().max(SERVICE_LIMITS.summaryMaxLength, 'supplier.services.errors.summaryTooLong'),
  description: z.string().max(SERVICE_LIMITS.descriptionMaxLength, 'supplier.services.errors.descriptionTooLong'),
  included: linesSchema,
  excluded: linesSchema,
});

/** The second step: the price and its supplements. */
export const priceStepSchema = z
  .object({
    priceMode: z.enum(['fixed', 'hourly', 'quote']),
    fixedUnit: z.enum(FIXED_PRICE_UNITS),
    amount: z.string(),
    pricesIncludeVat: z.boolean(),
    supplements: z.array(supplementSchema).max(SERVICE_LIMITS.maxSupplements, 'supplier.services.errors.supplementsTooMany'),
  })
  .superRefine((values, context) => {
    if (values.priceMode === 'quote') return;
    const problem = amountProblem(values.amount, 'supplier.services.errors.amountRequired');
    if (problem) addIssues(context, [{ path: ['amount'], message: problem }]);
  });

/** The third step: how long it takes and when it is offered. */
export const bookingStepSchema = z.object({
  durationMinutes: z
    .number({ error: 'supplier.services.errors.durationRequired' })
    .int('supplier.services.errors.durationRequired')
    .min(SERVICE_LIMITS.minDurationMinutes, 'supplier.services.errors.durationRequired')
    .max(SERVICE_LIMITS.maxDurationMinutes, 'supplier.services.errors.durationRequired'),
  minNoticeHours: z.number().int().min(0).max(SERVICE_LIMITS.maxNoticeHours).nullable(),
  weekdays: z.array(z.enum(SUPPLIER_SERVICE_WEEKDAYS)).min(1, 'supplier.services.errors.weekdaysRequired'),
});

/**
 * The rules of the three steps at once, for the page of a service where they are one form (the resolver of react-hook-form).
 * Each step is judged on its own schema, so there is one set of rules for both screens, and a problem in one step never
 * hides a problem in another (a rule that crosses fields, such as "an amount unless on quote", does not run on a form
 * that already has a value of the wrong type).
 */
export const serviceFormResolver: Resolver<ServiceFormValues> = async (values, context, options) => {
  const results = await Promise.all(
    [serviceStepSchema, priceStepSchema, bookingStepSchema].map((schema) =>
      (zodResolver(schema) as unknown as Resolver<ServiceFormValues>)(values, context, options),
    ),
  );
  const errors = Object.assign({}, ...results.map((result) => result.errors));
  return Object.keys(errors).length === 0 ? { values, errors: {} } : { values: {}, errors };
};
