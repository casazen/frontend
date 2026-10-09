import type { AppContextKey } from '@/config/route-manifest';
import type { CommandItem, CommandKind } from './types';

/**
 * The search of the palette (UI-06), all in memory: no request, nothing stored. The text and the items are folded the same way
 * (no capitals, no accents, punctuation as a space), then each word of the text must be found in the item: in the label first,
 * then in the other words that find it (`keywords`), then in the second line. Inside a field a match at the start of the
 * field beats the start of a word, which beats the middle of a word.
 */

/** How many results one group shows when something was typed. */
export const MAX_RESULTS_PER_GROUP = 5;

/** The order of the groups when their best results are worth the same, and the order of the headings in the empty palette. */
const KIND_ORDER: readonly CommandKind[] = ['page', 'action', 'property', 'booking', 'guest'];

/**
 * Points. A match at the start of a word, or of the whole field, is a real match; one in the middle of a word ("oggi" in
 * "alloggiati") is only a weak one and stays below every real match, whatever the field. Among the real ones the field
 * decides (the label, then the other words that find the item, then the second line) and, inside the field, how much of it
 * the text is: all of it, the start of it, the start of a word.
 */
const REAL_MATCH = 200;
const FIELD_POINTS = { title: 60, keyword: 30, subtitle: 0 } as const;
const RANK_POINTS = { exact: 15, prefix: 10, word: 5, substring: 0 } as const;
type Rank = keyof typeof RANK_POINTS;
type Field = keyof typeof FIELD_POINTS;

function pointsFor(field: Field, rank: Rank): number {
  return (rank === 'substring' ? 0 : REAL_MATCH) + FIELD_POINTS[field] + RANK_POINTS[rank];
}

/** The items of the area the user is in come first among equals. */
const ACTIVE_AREA_BONUS = 8;
/** Words that do not help to find anything ("prenotazioni di mario"); dropped when there is something else to look for. */
const STOP_WORDS = new Set(['di', 'a', 'da', 'in', 'il', 'lo', 'la', 'le', 'i', 'gli', 'un', 'una', 'e', 'per', 'of', 'the', 'to', 'and']);
const MAX_TOKENS = 6;

const NON_LETTER_OR_DIGIT = /[^\p{L}\p{N}]/gu;
const COMBINING_MARKS = /\p{M}/gu;

/** `value` without capitals and accents, punctuation as one space, trimmed: the form in which texts are compared. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(NON_LETTER_OR_DIGIT, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The same text a word shorter: "prenotazione" finds "prenotazioni", "ospiti" finds "ospite". Only for words of five letters
 * or more that end in a vowel, so that "casa" does not find "castello".
 */
function stemOf(token: string): string {
  return token.length >= 5 && /[aeio]$/.test(token) ? token.slice(0, -1) : token;
}

interface Token {
  text: string;
  stem: string;
}

function tokenize(query: string): Token[] {
  const words = normalizeText(query).split(' ').filter(Boolean).slice(0, MAX_TOKENS);
  const meaningful = words.filter((word) => !STOP_WORDS.has(word));
  return (meaningful.length > 0 ? meaningful : words).map((text) => ({ text, stem: stemOf(text) }));
}

/** `probe` starts a word of `text` after the first one (the first word is the `prefix` rank). */
function startsLaterWord(text: string, probe: string): boolean {
  return text.includes(` ${probe}`);
}

function rankOf(text: string, token: Token): Rank | null {
  if (!text) return null;
  if (text === token.text) return 'exact';
  if (text.startsWith(token.text) || text.startsWith(token.stem)) return 'prefix';
  if (startsLaterWord(text, token.text) || startsLaterWord(text, token.stem)) return 'word';
  // Two letters find the start of a word, not any word that has them inside ("im" is not "regime").
  if (token.text.length >= 3 && (text.includes(token.text) || text.includes(token.stem))) return 'substring';
  return null;
}

/** An item ready to be searched: its texts folded once, not at every key. */
export interface PreparedCommand {
  item: CommandItem;
  title: string;
  keywords: string[];
  subtitle: string;
  /** Where the item came in the list: equal scores keep that order. */
  order: number;
}

export function prepareCommands(items: readonly CommandItem[]): PreparedCommand[] {
  return items.map((item, order) => ({
    item,
    order,
    title: normalizeText(item.label),
    keywords: (item.keywords ?? []).map(normalizeText).filter(Boolean),
    subtitle: normalizeText(item.subtitle ?? ''),
  }));
}

function scoreToken(command: PreparedCommand, token: Token): number {
  let best = 0;
  const consider = (field: Field, rank: Rank | null) => {
    if (rank) best = Math.max(best, pointsFor(field, rank));
  };
  consider('title', rankOf(command.title, token));
  for (const keyword of command.keywords) consider('keyword', rankOf(keyword, token));
  consider('subtitle', rankOf(command.subtitle, token));
  return best;
}

function scoreCommand(command: PreparedCommand, tokens: readonly Token[], activeArea: AppContextKey): number {
  let total = 0;
  for (const token of tokens) {
    const points = scoreToken(command, token);
    // Every word of the text has to be found somewhere in the item.
    if (points === 0) return 0;
    total += points;
  }
  const areaBonus = command.item.area === activeArea ? ACTIVE_AREA_BONUS : 0;
  // Of two equal labels the shorter one is the closer match.
  const shortBonus = Math.max(0, 3 - command.title.length / 20);
  return total + areaBonus + shortBonus;
}

export interface TextRange {
  start: number;
  end: number;
}

/** An item that matched: where in its label and its second line the text was found (to underline it). */
export interface CommandHit {
  item: CommandItem;
  score: number;
  titleRanges: TextRange[];
  subtitleRanges: TextRange[];
}

/** One group of the palette: a heading and its rows. `recent` is the group of the items chosen before. */
export interface CommandGroup {
  id: CommandKind | 'recent';
  hits: CommandHit[];
}

/**
 * `value` folded character by character, keeping where each folded character comes from in the original: the same folding as
 * {@link normalizeText} but without squeezing the spaces, so a match found in the folded text can be pointed at in the text
 * that is on the screen ("Città" and "citta" have the same length; "Booking.com" has a space where the dot is).
 */
function foldWithMap(value: string): { folded: string; starts: number[]; ends: number[] } {
  let folded = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let position = 0;
  for (const char of value) {
    const end = position + char.length;
    const base = char.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().replace(NON_LETTER_OR_DIGIT, ' ');
    for (const folds of base) {
      folded += folds;
      starts.push(position);
      ends.push(end);
    }
    position = end;
  }
  return { folded, starts, ends };
}

function findToken(folded: string, token: Token): { start: number; end: number } | null {
  for (const probe of token.text === token.stem ? [token.text] : [token.text, token.stem]) {
    // The start of a word first; then, for three letters or more, anywhere.
    let index = folded.indexOf(probe);
    let anywhere = -1;
    while (index !== -1) {
      if (index === 0 || folded[index - 1] === ' ') return { start: index, end: index + probe.length };
      if (anywhere === -1) anywhere = index;
      index = folded.indexOf(probe, index + 1);
    }
    if (anywhere !== -1 && probe.length >= 3) return { start: anywhere, end: anywhere + probe.length };
  }
  return null;
}

function isSeparator(char: string | undefined): boolean {
  return char !== undefined && /[^\p{L}\p{N}]/u.test(char);
}

/** The parts of `text` that the words of `query` found, in the text as it is written, merged and in order. */
export function highlightRanges(text: string, query: string): TextRange[] {
  const tokens = tokenize(query);
  if (!text || tokens.length === 0) return [];
  const { folded, starts, ends } = foldWithMap(text);
  const found: TextRange[] = [];
  for (const token of tokens) {
    const match = findToken(folded, token);
    if (match) found.push({ start: starts[match.start], end: ends[match.end - 1] });
  }
  found.sort((a, b) => a.start - b.start);
  const merged: TextRange[] = [];
  for (const range of found) {
    const last = merged[merged.length - 1];
    // Two words found one after the other, with a space or a dot between them, are underlined as one ("Booking.com").
    const touches = last && (range.start <= last.end || (range.start === last.end + 1 && isSeparator(text[last.end])));
    if (last && touches) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

export interface SearchOptions {
  activeArea: AppContextKey;
  limitPerGroup?: number;
}

/**
 * The items that match `query`, in groups by kind. The group with the best result comes first, so does the best result in
 * it; at most `limitPerGroup` rows each. An empty list when nothing matches or the text has nothing to look for.
 */
export function searchCommands(
  commands: readonly PreparedCommand[],
  query: string,
  { activeArea, limitPerGroup = MAX_RESULTS_PER_GROUP }: SearchOptions,
): CommandGroup[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const scored = commands
    .map((command) => ({ command, score: scoreCommand(command, tokens, activeArea) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.command.order - b.command.order);

  const groups = new Map<CommandKind, CommandHit[]>();
  for (const { command, score } of scored) {
    const hits = groups.get(command.item.kind) ?? [];
    if (hits.length >= limitPerGroup) continue;
    hits.push({
      item: command.item,
      score,
      titleRanges: highlightRanges(command.item.label, query),
      subtitleRanges: command.item.subtitle ? highlightRanges(command.item.subtitle, query) : [],
    });
    groups.set(command.item.kind, hits);
  }

  return [...groups.entries()]
    .map(([id, hits]) => ({ id, hits }))
    .sort((a, b) => b.hits[0].score - a.hits[0].score || KIND_ORDER.indexOf(a.id) - KIND_ORDER.indexOf(b.id));
}

/** How many of each the empty palette suggests: little, so the first thing on the screen is easy to take in. */
export const SUGGESTED = { recent: 4, action: 4, page: 6 } as const;

export interface SuggestOptions {
  activeArea: AppContextKey;
  /** `id`s of the items chosen before, the latest first. */
  recentIds: readonly string[];
}

function plain(item: CommandItem): CommandHit {
  return { item, score: 0, titleRanges: [], subtitleRanges: [] };
}

/**
 * What the palette shows before anything is typed: the items chosen before (the ones still there), the actions and the pages
 * of the area the user is in. An item shows once, in the first group that has it.
 */
export function suggestCommands(items: readonly CommandItem[], { activeArea, recentIds }: SuggestOptions): CommandGroup[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const recent = recentIds
    .map((id) => byId.get(id))
    .filter((item): item is CommandItem => item !== undefined)
    .slice(0, SUGGESTED.recent);
  const shown = new Set(recent.map((item) => item.id));

  const ofKind = (kind: CommandKind, limit: number) => {
    const here = items.filter((item) => item.kind === kind && !item.quiet && !shown.has(item.id));
    // The area the user is in first, the others after it; inside each, the order the sources gave.
    const sorted = [...here.filter((item) => item.area === activeArea), ...here.filter((item) => item.area !== activeArea)];
    return sorted.slice(0, limit);
  };

  const actions = ofKind('action', SUGGESTED.action);
  actions.forEach((item) => shown.add(item.id));
  const pages = ofKind('page', SUGGESTED.page);

  const groups: CommandGroup[] = [
    { id: 'recent', hits: recent.map(plain) },
    { id: 'action', hits: actions.map(plain) },
    { id: 'page', hits: pages.map(plain) },
  ];
  return groups.filter((group) => group.hits.length > 0);
}

/** How many rows there are in all the groups. */
export function countHits(groups: readonly CommandGroup[]): number {
  return groups.reduce((total, group) => total + group.hits.length, 0);
}

/**
 * Adds the answer of the server search (UI-13) to the local results: each item goes at the end of the group of its kind (a
 * new group when there is none), unless the palette has it already, and a group keeps at most `limitPerGroup` rows. The
 * server has already matched them: they are not filtered again here, only underlined.
 */
export function mergeRemoteResults(
  local: readonly CommandGroup[],
  remote: readonly CommandItem[],
  query: string,
  limitPerGroup = MAX_RESULTS_PER_GROUP,
): CommandGroup[] {
  const groups = local.map((group) => ({ ...group, hits: [...group.hits] }));
  const known = new Set(groups.flatMap((group) => group.hits.map((hit) => hit.item.id)));
  for (const item of remote) {
    if (known.has(item.id)) continue;
    known.add(item.id);
    let group = groups.find((candidate) => candidate.id === item.kind);
    if (!group) {
      group = { id: item.kind, hits: [] };
      groups.push(group);
    }
    if (group.hits.length >= limitPerGroup) continue;
    group.hits.push({
      item,
      score: 0,
      titleRanges: highlightRanges(item.label, query),
      subtitleRanges: item.subtitle ? highlightRanges(item.subtitle, query) : [],
    });
  }
  return groups;
}
