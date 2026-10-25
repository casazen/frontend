import type { TFunction, i18n as I18nInstance } from 'i18next';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { LeaseNeed } from '@/types';

type Translate = TFunction;
type Exists = Pick<I18nInstance, 'exists' | 'language'>;

const FIELDS = new Set(['firstName', 'lastName', 'fiscalCode', 'citizenship', 'residence', 'contactEmail']);

function amountOf(value: unknown): string | undefined {
  return typeof value === 'number' ? formatCurrency(value) : undefined;
}

function dayOf(value: unknown, language: string): string | undefined {
  return typeof value === 'string' ? formatStayDate(parseStayDate(value), language) : undefined;
}

/**
 * The sentence for a code of the closed list the server sends in `flow.steps[n].needs` and in the checks of the review
 * (`leaseWizard.needs.<code>`). The server sends codes and parameters, never text: the figures in the sentence (the deposit limit, the
 * months of a term) are the ones it sends. A code the interface does not know yet gets a plain sentence, never the code itself.
 */
export function needMessage(t: Translate, i18n: Exists, need: Pick<LeaseNeed, 'code' | 'params'>): string {
  const params = need.params ?? {};
  const count = typeof params.count === 'number' ? params.count : undefined;
  const key = `leaseWizard.needs.${need.code}`;
  if (!i18n.exists(key, count === undefined ? undefined : { count })) return t('leaseWizard.needs.unknown');

  const fields = Array.isArray(params.fields)
    ? new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' }).format(
        params.fields.filter((field): field is string => typeof field === 'string' && FIELDS.has(field)).map((field) => t(`leaseWizard.fields.${field}`)),
      )
    : '';
  const limits = { minMonths: params.minMonths, maxMonths: params.maxMonths };
  const reasonKey = `leaseWizard.reasons.${String(params.reason)}`;

  return t(key, {
    n: typeof params.index === 'number' ? params.index + 1 : undefined,
    fields,
    count,
    max: params.maxRents,
    amount: amountOf(params.maxAmount) ?? amountOf(params.amount),
    rents: params.rents,
    minMonthly: amountOf(params.minMonthly),
    maxMonthly: amountOf(params.maxMonthly),
    months: params.months,
    // The limit of a text (the documentation of a transitory contract) and the inhabitants above which its rent has a band to respect.
    characters: params.maxLength,
    inhabitants: typeof params.inhabitants === 'number' ? new Intl.NumberFormat(i18n.language).format(params.inhabitants) : undefined,
    start: dayOf(params.start, i18n.language),
    end: dayOf(params.end, i18n.language),
    // A review check that names the whole term (start and end) is told in full; the one with the start alone, briefly.
    context: need.code === 'start_ok' && params.end ? 'term' : undefined,
    reason: typeof params.reason === 'string' && i18n.exists(reasonKey) ? t(reasonKey, limits) : '',
  });
}
