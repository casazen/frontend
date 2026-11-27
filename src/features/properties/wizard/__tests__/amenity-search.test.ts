import { describe, expect, it } from 'vitest';
import { matchesAmenity } from '../amenity-search';

const WASHER = { label: { it: 'Lavatrice', en: 'Washing machine' } };
const FIRST_AID = { label: { it: 'Kit di primo soccorso', en: 'First-aid kit' } };
const GARAGE = { label: { it: 'Garage', en: 'Garage' } };

describe('the search by word of the amenities (NF-33)', () => {
  it('matchesAmenity_AWordInTheItalianLabel_FindsIt', () => {
    expect(matchesAmenity(WASHER, 'lavatrice')).toBe(true);
    expect(matchesAmenity(WASHER, 'LAVA')).toBe(true);
    expect(matchesAmenity(GARAGE, 'lavatrice')).toBe(false);
  });

  it('matchesAmenity_AWordInTheEnglishLabel_FindsItWhateverTheLanguageOfThePage', () => {
    expect(matchesAmenity(WASHER, 'washing')).toBe(true);
    expect(matchesAmenity(FIRST_AID, 'first aid')).toBe(true);
    expect(matchesAmenity(FIRST_AID, 'first-aid')).toBe(true);
  });

  it('matchesAmenity_EveryWordMustBeThere_AccentsAndSpacesDoNotMatter', () => {
    expect(matchesAmenity(FIRST_AID, 'primo   soccorso')).toBe(true);
    expect(matchesAmenity(FIRST_AID, 'primo garage')).toBe(false);
    expect(matchesAmenity({ label: { it: 'Più camere', en: 'More rooms' } }, 'piu')).toBe(true);
  });

  it('matchesAmenity_ABlankSearch_FindsEverything', () => {
    expect(matchesAmenity(GARAGE, '')).toBe(true);
    expect(matchesAmenity(GARAGE, '   ')).toBe(true);
  });
});
