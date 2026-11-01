import { describe, expect, it } from 'vitest';
import type { ShowcaseTextSuggestion } from '@/types/supplier-showcase';
import {
  aiFill,
  answersToSend,
  defaultChoice,
  isAiDraftIntact,
  isWritten,
  suggestedFields,
  suggestedValue,
  withoutApplied,
  type AiAnswerInputs,
} from '../showcase-ai-texts';

const suggestion: ShowcaseTextSuggestion = {
  tagline: 'Pulizie per case vacanza',
  intro: 'Pulizie tra un check-out e un check-in.',
  bio: 'Ci occupiamo di pulizie a Seveso.',
  prep: ['Lascia le chiavi.', 'Metti al sicuro i documenti.'],
  basis: { categories: ['cleaning'], zones: ['Seveso'], services: [], answers: [] },
  rejected: [],
  aiUsed: true,
};

describe('answersToSend: only what the supplier typed goes to the server', () => {
  it('sends the answers that are there, trimmed, and none when nothing was typed', () => {
    const typed: AiAnswerInputs = { about: '  Una piccola squadra.  ', years: '   ', specialties: 'case al lago', differentiator: '' };
    expect(answersToSend(typed)).toEqual({ about: 'Una piccola squadra.', specialties: 'case al lago' });
    expect(answersToSend({ about: '', years: ' ', specialties: '', differentiator: '' })).toBeUndefined();
  });
});

describe('suggestedValue and suggestedFields: what the suggestion holds', () => {
  it('lists the members that have something, in the order of the editor, and skips the dropped ones', () => {
    expect(suggestedFields(suggestion)).toEqual(['tagline', 'intro', 'bio', 'prep']);
    expect(suggestedFields({ ...suggestion, intro: undefined, prep: [] })).toEqual(['tagline', 'bio']);
    expect(suggestedFields({ ...suggestion, tagline: '   ' })).toEqual(['intro', 'bio', 'prep']);
  });

  it('gives the tips as a list and the texts as they are', () => {
    expect(suggestedValue(suggestion, 'prep')).toEqual(suggestion.prep);
    expect(suggestedValue(suggestion, 'bio')).toBe('Ci occupiamo di pulizie a Seveso.');
    expect(suggestedValue({ ...suggestion, prep: [] }, 'prep')).toBeNull();
  });
});

describe('defaultChoice and isWritten: the AI fills the empty members and only offers the written ones', () => {
  it('ticks the members the supplier has not written, and not the ones it has', () => {
    expect(defaultChoice({}, suggestion)).toEqual(['tagline', 'intro', 'bio', 'prep']);
    expect(defaultChoice({ tagline: 'La mia frase', prep: ['Un consiglio'] }, suggestion)).toEqual(['intro', 'bio']);
  });

  it('counts a blank text and blank tips as not written', () => {
    expect(isWritten({ intro: '   ', prep: ['', '  '] }, 'intro')).toBe(false);
    expect(isWritten({ intro: '   ', prep: ['', '  '] }, 'prep')).toBe(false);
    expect(isWritten({ prep: ['', 'Una riga'] }, 'prep')).toBe(true);
  });
});

describe('aiFill: the patch of the draft, its inverse and what to mark', () => {
  it('puts the chosen members in the draft and keeps the inverse of each: what was there, or nothing', () => {
    const fill = aiFill({ tagline: 'La mia frase', prep: ['Vecchio consiglio'] }, suggestion, ['tagline', 'bio', 'prep']);

    expect(fill?.patch).toEqual({ tagline: suggestion.tagline, bio: suggestion.bio, prep: suggestion.prep });
    expect(fill?.inverse).toEqual({ tagline: 'La mia frase', bio: null, prep: ['Vecchio consiglio'] });
    expect(fill?.applied).toEqual({ tagline: suggestion.tagline, bio: suggestion.bio, prep: suggestion.prep });
  });

  it('leaves out the members that were not chosen and the ones the suggestion does not have', () => {
    expect(aiFill({}, suggestion, ['intro'])?.patch).toEqual({ intro: suggestion.intro });
    expect(aiFill({}, { ...suggestion, intro: undefined }, ['intro'])).toBeNull();
    expect(aiFill({}, suggestion, [])).toBeNull();
  });
});

describe('isAiDraftIntact: the mark stays while the member is what the AI wrote', () => {
  it('is true until the supplier changes the text, and for the tips until a row changes', () => {
    const applied = { intro: 'Pulizie a Seveso.', prep: ['Una', 'Due'] };

    expect(isAiDraftIntact({ intro: 'Pulizie a Seveso.' }, applied, 'intro')).toBe(true);
    expect(isAiDraftIntact({ intro: 'Pulizie a Seveso e dintorni.' }, applied, 'intro')).toBe(false);
    expect(isAiDraftIntact({ prep: ['Una', 'Due'] }, applied, 'prep')).toBe(true);
    expect(isAiDraftIntact({ prep: ['Una', 'Due', 'Tre'] }, applied, 'prep')).toBe(false);
    expect(isAiDraftIntact({ prep: ['Una', 'Altra'] }, applied, 'prep')).toBe(false);
  });

  it('is false for a member the AI did not write', () => {
    expect(isAiDraftIntact({ tagline: 'Scritta a mano' }, { intro: 'Una frase.' }, 'tagline')).toBe(false);
  });

  it('forgets the members taken back', () => {
    expect(withoutApplied({ tagline: 'A', intro: 'B' }, ['tagline'])).toEqual({ intro: 'B' });
  });
});
