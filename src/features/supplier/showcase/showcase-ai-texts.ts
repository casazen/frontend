import type { ShowcaseDocument, ShowcaseTextAnswers, ShowcaseTextField, ShowcaseTextSuggestion } from '@/types/supplier-showcase';
import type { DraftPatch } from './use-showcase-draft';

/** The members the AI help drafts, in the order of the editor. The guarantee, the people, the strengths, the certifications and the questions are the supplier's own. */
export const SHOWCASE_TEXT_FIELDS: readonly ShowcaseTextField[] = ['tagline', 'intro', 'bio', 'prep'];

/** The bounds of what the supplier may type for the AI: the ones of the server (`ShowcaseTextAnswers`). */
export const AI_ANSWER_LIMITS = { about: 400, years: 60, specialties: 200, differentiator: 200 } as const;

/** What the supplier typed for the AI, as the form holds it. */
export type AiAnswerInputs = Record<keyof ShowcaseTextAnswers, string>;

/** What the supplier took from a suggestion: the value of each member as it went into the draft. */
export type AppliedAi = Partial<Record<ShowcaseTextField, string | string[]>>;

const blank = (value: string | null | undefined) => (value ?? '').trim() === '';

/** The answers to send: only the ones the supplier typed, trimmed; `undefined` when it typed none. */
export function answersToSend(inputs: AiAnswerInputs): ShowcaseTextAnswers | undefined {
  const typed = (Object.entries(inputs) as Array<[keyof ShowcaseTextAnswers, string]>)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value !== '');
  return typed.length > 0 ? (Object.fromEntries(typed) as ShowcaseTextAnswers) : undefined;
}

/** What the suggestion holds for a member, or `null` when it holds nothing (not asked for, or dropped by the server). */
export function suggestedValue(suggestion: ShowcaseTextSuggestion, field: ShowcaseTextField): string | string[] | null {
  if (field === 'prep') return suggestion.prep.length > 0 ? suggestion.prep : null;
  const value = suggestion[field];
  return blank(value) ? null : (value as string);
}

/** The members the suggestion has something for, in the order of the editor. */
export function suggestedFields(suggestion: ShowcaseTextSuggestion): ShowcaseTextField[] {
  return SHOWCASE_TEXT_FIELDS.filter((field) => suggestedValue(suggestion, field) !== null);
}

/** True when the supplier has written something in the member (for the tips, in at least one row). */
export function isWritten(doc: ShowcaseDocument, field: ShowcaseTextField): boolean {
  return field === 'prep' ? (doc.prep ?? []).some((item) => !blank(item)) : !blank(doc[field]);
}

/** The members that go in by default: only where the supplier has written nothing. The others are offered, never forced. */
export function defaultChoice(doc: ShowcaseDocument, suggestion: ShowcaseTextSuggestion): ShowcaseTextField[] {
  return suggestedFields(suggestion).filter((field) => !isWritten(doc, field));
}

/** What taking a suggestion does: the patch of the draft, the inverse that puts back what was there, and what to mark as a draft of the AI. */
export interface AiFill {
  patch: DraftPatch;
  inverse: DraftPatch;
  applied: AppliedAi;
}

/** The patch that puts the chosen members of the suggestion in the draft, or `null` when none of them has anything. */
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

/** True while the member of the draft is still exactly what the AI wrote: the mark "bozza dell'AI" stays until the supplier changes it. */
export function isAiDraftIntact(doc: ShowcaseDocument, applied: AppliedAi, field: ShowcaseTextField): boolean {
  const mine = applied[field];
  if (mine === undefined) return false;
  if (field === 'prep') {
    const current = doc.prep ?? [];
    return Array.isArray(mine) && mine.length === current.length && mine.every((item, index) => item === current[index]);
  }
  return doc[field] === mine;
}

/** The marks without the members in `fields` (taken back, or written again by the supplier). */
export function withoutApplied(applied: AppliedAi, fields: readonly ShowcaseTextField[]): AppliedAi {
  const next = { ...applied };
  for (const field of fields) delete next[field];
  return next;
}
