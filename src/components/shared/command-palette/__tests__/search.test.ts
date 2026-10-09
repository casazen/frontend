import { describe, expect, it } from 'vitest';
import {
  MAX_RESULTS_PER_GROUP,
  SUGGESTED,
  countHits,
  highlightRanges,
  mergeRemoteResults,
  normalizeText,
  prepareCommands,
  searchCommands,
  suggestCommands,
} from '../search';
import type { CommandItem } from '../types';
import { item } from './test-context';

const search = (items: CommandItem[], query: string, activeArea: 'short-rent' | 'long-rent' = 'short-rent') =>
  searchCommands(prepareCommands(items), query, { activeArea });

const labels = (groups: ReturnType<typeof search>) => groups.flatMap((group) => group.hits.map((hit) => hit.item.label));

describe('normalizeText', () => {
  it('NormalizeText_CapitalsAccentsAndPunctuation_AreFolded', () => {
    expect(normalizeText('  Città   di  CASTELLO ')).toBe('citta di castello');
    expect(normalizeText('Booking.com, e l’Hotel')).toBe('booking com e l hotel');
    expect(normalizeText('Disponibilità')).toBe('disponibilita');
  });
});

describe('searchCommands (UI-06)', () => {
  it('SearchCommands_NothingToLookFor_FindsNothing', () => {
    const items = [item('a', 'Prenotazioni')];

    expect(search(items, '')).toEqual([]);
    expect(search(items, '   ')).toEqual([]);
    expect(search(items, '...')).toEqual([]);
  });

  it('SearchCommands_PrefixSubstringAndWordStart_AreAllFoundAndTheStartOfTheLabelIsFirst', () => {
    const items = [item('substring', 'Calendario prenotazioni'), item('word', 'Nuova prenotazione'), item('prefix', 'Prenotazioni')];

    expect(labels(search(items, 'preno'))).toEqual(['Prenotazioni', 'Nuova prenotazione', 'Calendario prenotazioni']);
    // In the middle of a word it is found too, below the rest.
    expect(labels(search([...items, item('middle', 'Reprenotare')], 'preno'))).toEqual([
      'Prenotazioni',
      'Nuova prenotazione',
      'Calendario prenotazioni',
      'Reprenotare',
    ]);
  });

  it('SearchCommands_CapitalsAndAccents_DoNotMatter', () => {
    const items = [item('a', 'Disponibilità'), item('b', 'CITTÀ')];

    expect(labels(search(items, 'DISPONIBILITA'))).toEqual(['Disponibilità']);
    expect(labels(search(items, 'citta'))).toEqual(['CITTÀ']);
    expect(labels(search(items, 'città'))).toEqual(['CITTÀ']);
  });

  it('SearchCommands_SingularAndPlural_FindEachOther', () => {
    const items = [item('a', 'Immobili'), item('b', 'Ospite Mario'), item('c', 'Contratti'), item('d', 'Prenotazioni')];

    expect(labels(search(items, 'immobile'))).toEqual(['Immobili']);
    expect(labels(search(items, 'ospiti'))).toEqual(['Ospite Mario']);
    expect(labels(search(items, 'contratto'))).toEqual(['Contratti']);
    expect(labels(search(items, 'prenotazione'))).toEqual(['Prenotazioni']);
    // A short word is not made shorter: "casa" must not find "castello".
    expect(labels(search([item('x', 'Castello')], 'casa'))).toEqual([]);
  });

  it('SearchCommands_LabelBeatsKeywordBeatsSubtitle_WhateverTheOrderTheyCameIn', () => {
    const items = [
      item('subtitle', 'Altro', { subtitle: 'Prenotazioni' }),
      item('keyword', 'Calendario', { keywords: ['prenotazioni'] }),
      item('label', 'Prenotazioni'),
    ];

    expect(labels(search(items, 'prenotazioni'))).toEqual(['Prenotazioni', 'Calendario', 'Altro']);
  });

  it('SearchCommands_AWordInTheMiddleOfAnotherOne_NeverBeatsARealMatchOfAnotherField', () => {
    // "oggi" is inside "Alloggiati" but is exactly a word that finds the dashboard.
    const items = [item('alloggiati', 'Alloggiati'), item('dashboard', 'Cruscotto', { keywords: ['oggi', 'home'] })];

    expect(labels(search(items, 'oggi'))).toEqual(['Cruscotto', 'Alloggiati']);
  });

  it('SearchCommands_SeveralWords_AllOfThemMustBeFound', () => {
    const items = [item('a', 'Villa Mare', { subtitle: 'Roma' }), item('b', 'Villa Lago', { subtitle: 'Como' }), item('c', 'Mare di Roma')];

    expect(labels(search(items, 'villa mare'))).toEqual(['Villa Mare']);
    // Both words in the label are worth more than one in the label and one in the second line.
    expect(labels(search(items, 'mare roma'))).toEqual(['Mare di Roma', 'Villa Mare']);
    expect(labels(search(items, 'villa roma'))).toEqual(['Villa Mare']);
    expect(labels(search(items, 'villa torino'))).toEqual([]);
  });

  it('SearchCommands_WordsThatSayNothing_AreLeftOutWhenThereIsSomethingElse', () => {
    const items = [item('a', 'Mario Rossi'), item('b', 'Prenotazioni')];

    expect(labels(search(items, 'prenotazioni di mario'))).toEqual([]);
    expect(labels(search(items, 'di mario'))).toEqual(['Mario Rossi']);
    // A text made only of those words still looks for them.
    expect(labels(search([item('c', 'Di Pietro')], 'di'))).toEqual(['Di Pietro']);
  });

  it('SearchCommands_ALetterOrTwo_FindTheStartOfAWordNotTheMiddle', () => {
    const items = [item('a', 'Aria'), item('b', 'Casa'), item('c', 'Regime fiscale')];

    expect(labels(search(items, 'a'))).toEqual(['Aria']);
    expect(labels(search(items, 'im'))).toEqual([]);
    expect(labels(search(items, 'ime'))).toEqual(['Regime fiscale']);
  });

  it('SearchCommands_Results_AreGroupedByKindAndTheGroupWithTheBestResultIsFirst', () => {
    const items = [
      item('page', 'Immobili', { kind: 'page' }),
      item('action', 'Aggiungi un immobile', { kind: 'action' }),
      item('property', 'Immobile sul lago', { kind: 'property' }),
      item('guest', 'Ospite', { kind: 'guest', keywords: ['immobile'] }),
    ];

    const groups = search(items, 'immobile');

    // The page is the label that starts with the text; the property too, and it came later; the action has it in a later word.
    expect(groups.map((group) => group.id)).toEqual(['page', 'property', 'action', 'guest']);
    expect(groups[0].hits[0].item.label).toBe('Immobili');
  });

  it('SearchCommands_ManyResults_AreCutAtTheLimitOfTheGroupAndTheBestOnesStay', () => {
    const items = Array.from({ length: 12 }, (_unused, index) => item(`p${index}`, `Immobile ${index}`, { kind: 'property' }));
    items.push(item('best', 'Immobile', { kind: 'property' }));

    const [group] = search(items, 'immobile');

    expect(group.hits).toHaveLength(MAX_RESULTS_PER_GROUP);
    expect(group.hits[0].item.label).toBe('Immobile');
  });

  it('SearchCommands_ItemsOfTheAreaTheUserIsIn_ComeFirstAmongEquals', () => {
    const items = [
      item('long', 'Immobili', { area: 'long-rent', subtitle: 'Affitti lunghi' }),
      item('short', 'Immobili', { area: 'short-rent', subtitle: 'Affitti brevi' }),
    ];

    expect(search(items, 'immobili', 'short-rent')[0].hits.map((hit) => hit.item.id)).toEqual(['short', 'long']);
    expect(search(items, 'immobili', 'long-rent')[0].hits.map((hit) => hit.item.id)).toEqual(['long', 'short']);
  });

  it('SearchCommands_EqualScores_KeepTheOrderTheSourcesGave', () => {
    const items = [item('a', 'Pagina uno'), item('b', 'Pagina due'), item('c', 'Pagina tre')];

    expect(search(items, 'pagina')[0].hits.map((hit) => hit.item.id)).toEqual(['a', 'b', 'c']);
  });

  it('SearchCommands_WhereItWasFound_IsGivenToUnderlineIt', () => {
    const [group] = search([item('a', 'Casa del Lago', { subtitle: 'Como, lago di Como' })], 'lago');

    const [hit] = group.hits;
    expect(hit.titleRanges).toEqual([{ start: 9, end: 13 }]);
    expect(hit.subtitleRanges).toEqual([{ start: 6, end: 10 }]);
  });
});

describe('highlightRanges', () => {
  const underlined = (text: string, query: string) => highlightRanges(text, query).map(({ start, end }) => text.slice(start, end));

  it('HighlightRanges_TextWithAccents_PointsAtTheTextAsItIsWritten', () => {
    expect(underlined('Città di Castello', 'citta')).toEqual(['Città']);
    expect(underlined('Disponibilità', 'DISPONIBILITA')).toEqual(['Disponibilità']);
  });

  it('HighlightRanges_PluralOfTheText_UnderlinesTheCommonPart', () => {
    expect(underlined('Prenotazioni', 'prenotazione')).toEqual(['Prenotazion']);
  });

  it('HighlightRanges_SeveralWords_UnderlinesEachAndMergesTheOnesThatTouch', () => {
    expect(underlined('Villa Mare Roma', 'roma villa')).toEqual(['Villa', 'Roma']);
    // Words that follow each other, a space between them, are one underline.
    expect(underlined('Villa Mare Roma', 'mare villa')).toEqual(['Villa Mare']);
    expect(underlined('Villa Mare', 'vil illa')).toEqual(['Villa']);
  });

  it('HighlightRanges_PunctuationInTheText_IsSkippedOver', () => {
    expect(underlined('Booking.com e Airbnb', 'booking com')).toEqual(['Booking.com']);
  });

  it('HighlightRanges_WordStartIsPreferredToTheMiddleOfAWord', () => {
    expect(highlightRanges('Casa del lago', 'la')).toEqual([{ start: 9, end: 11 }]);
  });

  it('HighlightRanges_NothingFound_IsNothing', () => {
    expect(highlightRanges('Casa', 'xyz')).toEqual([]);
    expect(highlightRanges('', 'casa')).toEqual([]);
    expect(highlightRanges('Casa', '')).toEqual([]);
  });
});

describe('suggestCommands (the palette with nothing typed)', () => {
  const pages = Array.from({ length: 9 }, (_unused, index) => item(`page${index}`, `Pagina ${index}`, { area: 'short-rent' }));
  const actions = Array.from({ length: 6 }, (_unused, index) => item(`action${index}`, `Azione ${index}`, { kind: 'action', area: 'short-rent' }));
  const everything = [...pages, ...actions];

  it('SuggestCommands_NoRecents_SuggestsSomeActionsAndSomePagesOfTheArea', () => {
    const groups = suggestCommands(everything, { activeArea: 'short-rent', recentIds: [] });

    expect(groups.map((group) => group.id)).toEqual(['action', 'page']);
    expect(groups[0].hits).toHaveLength(SUGGESTED.action);
    expect(groups[1].hits).toHaveLength(SUGGESTED.page);
    expect(countHits(groups)).toBe(SUGGESTED.action + SUGGESTED.page);
  });

  it('SuggestCommands_Recents_AreFirstAndShowOnlyOnceAndOnlyWhenTheItemStillExists', () => {
    const groups = suggestCommands(everything, { activeArea: 'short-rent', recentIds: ['page3', 'gone', 'action1'] });

    expect(groups.map((group) => group.id)).toEqual(['recent', 'action', 'page']);
    expect(groups[0].hits.map((hit) => hit.item.id)).toEqual(['page3', 'action1']);
    expect(groups[1].hits.map((hit) => hit.item.id)).not.toContain('action1');
    expect(groups[2].hits.map((hit) => hit.item.id)).not.toContain('page3');
  });

  it('SuggestCommands_TooManyRecents_AreCut', () => {
    const recentIds = pages.map((page) => page.id);

    const [recent] = suggestCommands(everything, { activeArea: 'short-rent', recentIds });

    expect(recent.hits).toHaveLength(SUGGESTED.recent);
    expect(recent.hits.map((hit) => hit.item.id)).toEqual(recentIds.slice(0, SUGGESTED.recent));
  });

  it('SuggestCommands_ItemsOfAnotherArea_ComeAfterTheOnesOfTheAreaTheUserIsIn', () => {
    const mixed = [item('long', 'Pagina lunga', { area: 'long-rent' }), item('short', 'Pagina breve', { area: 'short-rent' })];

    const [group] = suggestCommands(mixed, { activeArea: 'short-rent', recentIds: [] });

    expect(group.hits.map((hit) => hit.item.id)).toEqual(['short', 'long']);
  });

  it('SuggestCommands_QuietActions_AreNotSuggested', () => {
    const quiet = item('signout', 'Esci', { kind: 'action', quiet: true });

    const groups = suggestCommands([quiet, ...actions], { activeArea: 'short-rent', recentIds: [] });

    expect(groups.flatMap((group) => group.hits.map((hit) => hit.item.id))).not.toContain('signout');
    // ...but typing finds it.
    expect(labels(search([quiet], 'esci'))).toEqual(['Esci']);
  });
});

describe('mergeRemoteResults (the hook of the server search)', () => {
  it('MergeRemoteResults_ServerItems_GoAtTheEndOfTheirGroupWithoutRepeatingWhatIsThere', () => {
    const local = search([item('a', 'Villa Mare', { kind: 'property' })], 'villa');
    const remote = [
      item('a', 'Villa Mare', { kind: 'property' }),
      item('b', 'Villa Lago', { kind: 'property' }),
      item('c', 'Contratto Villa', { kind: 'page' }),
    ];

    const merged = mergeRemoteResults(local, remote, 'villa');

    expect(merged.map((group) => group.id)).toEqual(['property', 'page']);
    expect(merged[0].hits.map((hit) => hit.item.id)).toEqual(['a', 'b']);
    expect(merged[1].hits.map((hit) => hit.item.id)).toEqual(['c']);
    // What the server found is underlined like the rest.
    expect(merged[0].hits[1].titleRanges).toEqual([{ start: 0, end: 5 }]);
  });

  it('MergeRemoteResults_NothingFromTheServer_LeavesTheLocalResultsAlone', () => {
    const local = search([item('a', 'Villa Mare')], 'villa');

    expect(mergeRemoteResults(local, [], 'villa')).toEqual(local);
  });

  it('MergeRemoteResults_ALotFromTheServer_StaysWithinTheLimitOfTheGroup', () => {
    const remote = Array.from({ length: 20 }, (_unused, index) => item(`r${index}`, `Villa ${index}`, { kind: 'property' }));

    const [group] = mergeRemoteResults([], remote, 'villa');

    expect(group.hits).toHaveLength(MAX_RESULTS_PER_GROUP);
  });
});
