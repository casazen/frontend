import type { TFunction } from 'i18next';
import type { ConditionDefinition, ConditionGroup } from '@/types/campaign.types';

export type ConditionRule = ConditionGroup['rules'][number];
export type GroupLogic = ConditionGroup['operator'];

export const STAGES = ['upcoming', 'first', 'returning', 'loyal', 'lost'] as const;

export const GUEST_LANGUAGES = ['it', 'en', 'de', 'fr', 'es', 'nl'] as const;

export type FilterKind = 'lastStay' | 'stays' | 'stage' | 'properties' | 'language' | 'country' | 'tag' | 'spend';

const FIELD_OF_KIND: Record<FilterKind, string> = {
  lastStay: 'lastStayAt',
  stays: 'totalStays',
  stage: 'stage',
  properties: 'propertyHistory',
  language: 'language',
  country: 'country',
  tag: 'tag',
  spend: 'totalSpend',
};

export const FILTER_KINDS: readonly FilterKind[] = ['lastStay', 'stays', 'stage', 'properties', 'language', 'country', 'tag', 'spend'];

export type ListFieldId = 'stage' | 'language' | 'country' | 'propertyHistory' | 'tag';
export type StaysMode = 'atLeast' | 'exactly' | 'lessThan';
export type LastStayMode = 'inLast' | 'before' | 'after';
export type SpendMode = 'moreThan' | 'lessThan';

export const kindOfRule = (rule: ConditionRule): FilterKind | null =>
  FILTER_KINDS.find((kind) => FIELD_OF_KIND[kind] === rule.fieldId) ?? null;

export function emptyCondition(operator: GroupLogic = 'AND'): ConditionDefinition {
  return { version: '1.0', groups: [{ operator, rules: [] }] };
}

export function conditionOf(rules: readonly ConditionRule[], operator: GroupLogic = 'AND'): ConditionDefinition {
  return { version: '1.0', groups: [{ operator, rules: [...rules] }] };
}

export const rulesOf = (condition: ConditionDefinition): ConditionRule[] => condition.groups.flatMap((group) => group.rules);

export const logicOf = (condition: ConditionDefinition): GroupLogic => condition.groups[0]?.operator ?? 'AND';

const asList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  return value === null || value === undefined ? [] : [String(value)];
};

const asNumber = (value: unknown): number => {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function staysRule(mode: StaysMode, count: number): ConditionRule {
  if (mode === 'atLeast') return { fieldId: 'totalStays', operator: 'greaterThan', value: Math.max(0, count - 1) };
  return { fieldId: 'totalStays', operator: mode === 'exactly' ? 'equals' : 'lessThan', value: count };
}

export function readStays(rule: ConditionRule): { mode: StaysMode; count: number } | null {
  const number = asNumber(rule.value);
  if (rule.operator === 'greaterThan') return { mode: 'atLeast', count: number + 1 };
  if (rule.operator === 'equals') return { mode: 'exactly', count: number };
  if (rule.operator === 'lessThan') return { mode: 'lessThan', count: number };
  return null;
}

export function lastStayRule(mode: LastStayMode, value: number | string): ConditionRule {
  return { fieldId: 'lastStayAt', operator: mode, value: mode === 'inLast' ? Number(value) : String(value) };
}

export function readLastStay(rule: ConditionRule): { mode: LastStayMode; value: string } | null {
  if (rule.operator === 'inLast' || rule.operator === 'before' || rule.operator === 'after') {
    return { mode: rule.operator, value: asList(rule.value)[0] ?? '' };
  }
  return null;
}

export function spendRule(mode: SpendMode, amount: number): ConditionRule {
  return { fieldId: 'totalSpend', operator: mode === 'moreThan' ? 'greaterThan' : 'lessThan', value: amount };
}

export function readSpend(rule: ConditionRule): { mode: SpendMode; amount: number } | null {
  if (rule.operator === 'greaterThan') return { mode: 'moreThan', amount: asNumber(rule.value) };
  if (rule.operator === 'lessThan') return { mode: 'lessThan', amount: asNumber(rule.value) };
  return null;
}

export function listRule(fieldId: ListFieldId, include: boolean, values: readonly string[]): ConditionRule {
  return { fieldId, operator: include ? 'in' : 'notIn', value: [...values] };
}

export function readList(rule: ConditionRule): { include: boolean; values: string[] } | null {
  if (rule.operator !== 'in' && rule.operator !== 'notIn') return null;
  return { include: rule.operator === 'in', values: asList(rule.value) };
}

export function isEditable(rule: ConditionRule): boolean {
  switch (kindOfRule(rule)) {
    case 'stays':
      return readStays(rule) !== null;
    case 'lastStay':
      return readLastStay(rule) !== null;
    case 'spend':
      return readSpend(rule) !== null;
    case 'stage':
    case 'properties':
    case 'language':
    case 'country':
    case 'tag':
      return readList(rule) !== null;
    default:
      return false;
  }
}

export interface DescribeEnv {
  t: TFunction;
  language: string;
  propertyName: (id: string) => string | undefined;
}

function dateText(value: string, language: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date);
}

function listText(values: readonly string[], language: string): string {
  return new Intl.ListFormat(language, { type: 'conjunction' }).format(values);
}

export function describeRule(rule: ConditionRule, env: DescribeEnv): string {
  const { t, language } = env;
  const values = asList(rule.value);
  const number = asNumber(rule.value);

  switch (rule.fieldId) {
    case 'totalStays':
      if (rule.operator === 'greaterThan') return t('marketingHub.rule.staysAtLeast', { count: number + 1 });
      if (rule.operator === 'equals') return t('marketingHub.rule.staysExactly', { count: number });
      if (rule.operator === 'lessThan') return t('marketingHub.rule.staysLessThan', { count: number });
      if (rule.operator === 'between') return t('marketingHub.rule.staysBetween', { from: values[0], to: values[1] });
      break;
    case 'lastStayAt':
    case 'firstStayAt': {
      const prefix = rule.fieldId === 'lastStayAt' ? 'last' : 'first';
      if (rule.operator === 'inLast') return t(`marketingHub.rule.${prefix}InLast`, { count: number });
      if (rule.operator === 'before') return t(`marketingHub.rule.${prefix}Before`, { date: dateText(values[0] ?? '', language) });
      if (rule.operator === 'after') return t(`marketingHub.rule.${prefix}After`, { date: dateText(values[0] ?? '', language) });
      if (rule.operator === 'between') {
        return t(`marketingHub.rule.${prefix}Between`, {
          from: dateText(values[0] ?? '', language),
          to: dateText(values[1] ?? '', language),
        });
      }
      break;
    }
    case 'totalSpend': {
      const money = (amount: number) =>
        new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
      if (rule.operator === 'greaterThan') return t('marketingHub.rule.spendMore', { amount: money(number) });
      if (rule.operator === 'lessThan') return t('marketingHub.rule.spendLess', { amount: money(number) });
      if (rule.operator === 'between') {
        return t('marketingHub.rule.spendBetween', { from: money(asNumber(values[0])), to: money(asNumber(values[1])) });
      }
      break;
    }
    case 'stage':
      if (rule.operator === 'in' || rule.operator === 'notIn') {
        const labels = values.map((stage) => t(`marketingHub.stage.${stage}`, { defaultValue: stage }).toLocaleLowerCase(language));
        return t(rule.operator === 'in' ? 'marketingHub.rule.stageIn' : 'marketingHub.rule.stageNotIn', { list: listText(labels, language) });
      }
      break;
    case 'language':
      if (rule.operator === 'in' || rule.operator === 'notIn') {
        const labels = values.map((code) => t(`marketingHub.language.${code}`, { defaultValue: code.toUpperCase() }));
        return t(rule.operator === 'in' ? 'marketingHub.rule.languageIn' : 'marketingHub.rule.languageNotIn', { list: listText(labels, language) });
      }
      break;
    case 'country':
      if (rule.operator === 'in' || rule.operator === 'notIn') {
        return t(rule.operator === 'in' ? 'marketingHub.rule.countryIn' : 'marketingHub.rule.countryNotIn', { list: listText(values, language) });
      }
      break;
    case 'propertyHistory':
      if (rule.operator === 'in' || rule.operator === 'notIn') {
        const names = values.map((id) => env.propertyName(id) ?? t('marketingHub.rule.unknownProperty'));
        return t(rule.operator === 'in' ? 'marketingHub.rule.propertyIn' : 'marketingHub.rule.propertyNotIn', { list: listText(names, language) });
      }
      break;
    case 'tag':
      if (rule.operator === 'in' || rule.operator === 'notIn') {
        return t(rule.operator === 'in' ? 'marketingHub.rule.tagIn' : 'marketingHub.rule.tagNotIn', { list: listText(values, language) });
      }
      break;
    default:
      break;
  }

  return t('marketingHub.rule.generic', {
    field: t(`marketingStudio.fields.${rule.fieldId}`, { defaultValue: rule.fieldId }),
    operator: t(`marketingStudio.operators.${rule.operator}`, { defaultValue: rule.operator }),
    value: values.join(', '),
  });
}

export function describeCondition(condition: ConditionDefinition, env: DescribeEnv): string[] {
  return rulesOf(condition).map((rule) => describeRule(rule, env));
}
