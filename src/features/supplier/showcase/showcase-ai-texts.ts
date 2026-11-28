import type { ShowcaseDocument, ShowcaseTextAnswers, ShowcaseTextField, ShowcaseTextSuggestion } from '@/types/supplier-showcase';
import type { DraftPatch } from './use-showcase-draft';

export const SHOWCASE_TEXT_FIELDS: readonly ShowcaseTextField[] = ['tagline', 'intro', 'bio', 'prep'];

export const AI_ANSWER_LIMITS = { about: 400, years: 60, specialties: 200, differentiator: 200 } as const;

export type AiAnswerInputs = Record<keyof ShowcaseTextAnswers, string>;

export type AppliedAi = Partial<Record<ShowcaseTextField, string | string[]>>;

const blank = (value: string | null | undefined) => (value ?? '').trim() === '';

export function answersToSend(inputs: AiAnswerInputs): ShowcaseTextAnswers | undefined {
  const typed = (Object.entries(inputs) as Array<[keyof ShowcaseTextAnswers, string]>)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value !== '');
  return typed.length > 0 ? (Object.fromEntries(typed) as ShowcaseTextAnswers) : undefined;
}

export function suggestedValue(suggestion: ShowcaseTextSuggestion, field: ShowcaseTextField): string | string[] | null {
  if (field === 'prep') return suggestion.prep.length > 0 ? suggestion.prep : null;
  const value = suggestion[field];
  return blank(value) ? null : (value as string);
}

export function suggestedFields(suggestion: ShowcaseTextSuggestion): ShowcaseTextField[] {
  return SHOWCASE_TEXT_FIELDS.filter((field) => suggestedValue(suggestion, field) !== null);
}

export function isWritten(doc: ShowcaseDocument, field: ShowcaseTextField): boolean {
  return field === 'prep' ? (doc.prep ?? []).some((item) => !blank(item)) : !blank(doc[field]);
}

export function defaultChoice(doc: ShowcaseDocument, suggestion: ShowcaseTextSuggestion): ShowcaseTextField[] {
  return suggestedFields(suggestion).filter((field) => !isWritten(doc, field));
}

export interface AiFill {
  patch: DraftPatch;
  inverse: DraftPatch;
  applied: AppliedAi;
}

export function aiFill(doc: ShowcaseDocument, suggestion: ShowcaseTextSuggestion, chosen: readonly ShowcaseTextField[]): AiFill | null {
  const patch: DraftPatch = {};
  const inverse: DraftPatch = {};
  const applied: AppliedAi = {};

  for (const field of SHOWCASE_TEXT_FIELDS) {
    const value = chosen.includes(field) ? suggestedValue(suggestion, field) : null;
    if (value === null) continue;

    if (field === 'prep') {
      patch.prep = value as string[];
      inverse.prep = doc.prep && doc.prep.length > 0 ? doc.prep : null;
    } else {
      patch[field] = value as string;
      inverse[field] = doc[field] ?? null;
    }
    applied[field] = value;
  }

  return Object.keys(patch).length > 0 ? { patch, inverse, applied } : null;
}

export function isAiDraftIntact(doc: ShowcaseDocument, applied: AppliedAi, field: ShowcaseTextField): boolean {
  const mine = applied[field];
  if (mine === undefined) return false;
  if (field === 'prep') {
    const current = doc.prep ?? [];
    return Array.isArray(mine) && mine.length === current.length && mine.every((item, index) => item === current[index]);
  }
  return doc[field] === mine;
}

export function withoutApplied(applied: AppliedAi, fields: readonly ShowcaseTextField[]): AppliedAi {
  const next = { ...applied };
  for (const field of fields) delete next[field];
  return next;
}
