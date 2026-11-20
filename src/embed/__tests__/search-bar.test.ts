import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freezeClock, withBrowserTimeZone } from '@/test/clock';
import { DEFAULT_MAX_GUESTS, buildSearchUrl, findProblem, parseDestinations, parseMaxGuests, resolveTarget } from '../search-form';
import { SEARCH_CSS, contrastRatio, installStyles, onColor, readHex, readRadius, themeVariables } from '../search-styles';
import { SEARCH_TEXTS } from '../texts';

/**
 * The search bar `search.js` (E41/F02/US01/T02, NF-146): the fields, what blocks the submit, the address it leads to, the keyboard, the look, and
 * everything it must never do (call a server, store anything, write HTML from an attribute, go to a script). The bar is mounted the way the loader
 * mounts it: through the function `search.js` registers with `CasaZenEmbed.register`.
 */
const BASE = 'https://prenota.quokka360.com';
const NOON = '2026-12-01T12:00:00Z';
const TARGET = `${BASE}/prenota/`;
const IT = SEARCH_TEXTS.it;
const EN = SEARCH_TEXTS.en;

withBrowserTimeZone('Europe/Rome');

type Options = Record<string, unknown>;
type Mount = (element: HTMLElement, options: Options) => void;
type EmbedWindow = Window & { CasaZenEmbed?: unknown; dataLayer?: unknown[] };

let mount: Mount;
let assign: ReturnType<typeof vi.fn>;
let emit: ReturnType<typeof vi.fn>;

/** Loads `search.js` into a page that has a loader that only records the registration, and gives back the function it registered. */
async function loadBar(): Promise<Mount> {
  vi.resetModules();
  const register = vi.fn();
  (window as EmbedWindow).CasaZenEmbed = { register };
  await import('../search');
  expect(register).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledWith('search', expect.any(Function));
  return register.mock.calls[0][1] as Mount;
}

/** The address of the page the bar is on (it is read when the form is sent), with `location.assign` caught. */
function stubLocation(search = ''): void {
  // Read from the real location, not from an earlier stub of it.
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', `/page${search}`);
  assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign });
}

const options = (overrides: Options = {}): Options => ({
  lang: 'it',
  target: TARGET,
  destinations: undefined,
  theme: undefined,
  maxGuests: undefined,
  base: BASE,
  org: '',
  emit,
  preview: false,
  ...overrides,
});

function bar(overrides: Options = {}): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mount(container, options(overrides));
  return container;
}

const q = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector(selector) as T;
const opener = () => q<HTMLButtonElement>('.czs-opener');
const guests = () => q<HTMLInputElement>('.czs-guests');
const select = () => document.querySelector<HTMLSelectElement>('select');
const send = () => q<HTMLButtonElement>('.czs-btn');
const problem = () => q('.czs-alert');
const live = () => q('.czs-live');
const note = () => q('.czs-note');
const cell = (day: string) => q(`[data-day="${day}"]`);
const press = (target: Element, key: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

/** Opens the calendar with a click (what Enter and Space do on a button) and picks the two days. */
function choose(arrival: string, departure: string): void {
  opener().click();
  cell(arrival).click();
  cell(departure).click();
}

beforeEach(async () => {
  freezeClock(NOON);
  emit = vi.fn();
  stubLocation();
  mount = await loadBar();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'CasaZenEmbed');
  Reflect.deleteProperty(window, 'dataLayer');
  Reflect.deleteProperty(document, 'currentScript');
  Reflect.deleteProperty(document, 'adoptedStyleSheets');
  document.body.innerHTML = '';
  document.head.querySelectorAll('style').forEach((style) => style.remove());
  window.history.replaceState(null, '', '/');
});

describe('the fields (AC3)', () => {
  it('searchBar_IsASearchFormWithLabelledFields', () => {
    bar();

    const form = q('form');
    expect(form.getAttribute('role')).toBe('search');
    expect(form.getAttribute('aria-label')).toBe('Cerca disponibilità');
    expect(opener().tagName).toBe('BUTTON');
    expect(opener().getAttribute('type')).toBe('button');
    expect(opener().getAttribute('aria-haspopup')).toBe('dialog');
    expect(opener().getAttribute('aria-expanded')).toBe('false');
    expect(opener().getAttribute('aria-controls')).toBe(q('[role="dialog"]').id);
    const label = document.getElementById((opener().getAttribute('aria-labelledby') as string).split(' ')[0]);
    expect(label?.textContent).toBe('Quando');
    expect(document.querySelector(`label[for="${guests().id}"]`)?.textContent).toBe('Ospiti');
    expect(send().textContent).toBe('Verifica disponibilità');
    expect(send().getAttribute('type')).toBe('submit');
    expect(opener().textContent).toBe('Aggiungi le date');
  });

  it('searchBar_InEnglish_WritesEnglish', () => {
    bar({ lang: 'en', destinations: '[{"id":"lugano","label":"Lugano"}]' });

    expect(q('form').getAttribute('aria-label')).toBe('Search availability');
    expect(send().textContent).toBe('Check availability');
    expect(opener().textContent).toBe('Add the dates');
    expect(document.querySelector('label[for$="-where"]')?.textContent).toBe('Where');
    expect(select()?.options[0].textContent).toBe('Anywhere');
    expect(document.querySelector(`label[for="${guests().id}"]`)?.textContent).toBe('Guests');
    expect(q('[aria-label="Fewer guests"]')).not.toBeNull();
    expect(q('[aria-label="More guests"]')).not.toBeNull();
  });

  it.each([['it'], ['fr'], [undefined], ['']])('searchBar_Lang_%s_IsItalianUnlessItIsEnglish', (lang) => {
    bar({ lang });

    expect(send().textContent).toBe('Verifica disponibilità');
  });

  it.each([
    ['nothing', undefined],
    ['an empty text', ''],
    ['text that is not JSON', 'Lugano, Locarno'],
    ['an empty list', '[]'],
    ['JSON that is not a list', '{"id":"lugano","label":"Lugano"}'],
    ['a number', '3'],
    ['places that are all invalid', '[{"id":"lu gano","label":"Lugano"},{"id":"x","label":""},{"id":5,"label":"Five"},null,"Locarno"]'],
  ])('searchBar_Destination_IsAbsentWith_%s', (_label, destinations) => {
    bar({ destinations });

    expect(select()).toBeNull();
    expect(document.querySelector('label[for$="-where"]')).toBeNull();
  });

  it('searchBar_Destination_ShowsAListWithAnywhereFirstWhenTheOptionsAreValid', () => {
    bar({ destinations: '[{"id":"lugano","label":"Lugano"},{"id":"locarno","label":"Locarno"}]' });

    const list = select() as HTMLSelectElement;
    expect([...list.options].map((option) => [option.value, option.textContent])).toEqual([
      ['', 'Ovunque'],
      ['lugano', 'Lugano'],
      ['locarno', 'Locarno'],
    ]);
    expect(document.querySelector(`label[for="${list.id}"]`)?.textContent).toBe('Dove');
    expect(list.value).toBe('');
  });

  it('searchBar_Destination_TheListMayBeGivenAsAList', () => {
    bar({ destinations: [{ id: 'lugano', label: 'Lugano' }] });

    expect(select()?.options).toHaveLength(2);
  });

  it('searchBar_destinations_areRenderedAsText', () => {
    const label = '<img src=x onerror=document.body.dataset.pwned=1>&amp;<b>x</b>';
    const container = bar({ destinations: JSON.stringify([{ id: 'lugano', label }]) });

    const option = select()?.options[1] as HTMLOptionElement;
    expect(option.textContent).toBe(label.replace(/\s+/g, ' '));
    expect(option.children).toHaveLength(0);
    expect(container.querySelectorAll('img, script, iframe, a')).toHaveLength(0);
    expect(document.body.dataset.pwned).toBeUndefined();
  });

  describe('parseDestinations', () => {
    it('keepsTheValidEntriesInOrder', () => {
      expect(parseDestinations('[{"id":"lugano","label":"Lugano"},{"id":"a.b_c~d-1","label":"Alpi e Laghi"}]')).toEqual([
        { id: 'lugano', label: 'Lugano' },
        { id: 'a.b_c~d-1', label: 'Alpi e Laghi' },
      ]);
    });

    it.each([
      ['an id with a space', { id: 'lu gano', label: 'Lugano' }],
      ['an id with a slash', { id: 'a/b', label: 'Lugano' }],
      ['an id with a quote', { id: 'a"b', label: 'Lugano' }],
      ['an empty id', { id: '', label: 'Lugano' }],
      ['an id of 101 characters', { id: 'a'.repeat(101), label: 'Lugano' }],
      ['an id that is a number', { id: 5, label: 'Lugano' }],
      ['no id', { label: 'Lugano' }],
      ['a label of 81 characters', { id: 'lugano', label: 'a'.repeat(81) }],
      ['an empty label', { id: 'lugano', label: '' }],
      ['a label of spaces', { id: 'lugano', label: '   ' }],
      ['a label that is not text', { id: 'lugano', label: 7 }],
      ['no label', { id: 'lugano' }],
      ['a text', 'lugano'],
      ['null', null],
      ['a number', 3],
      ['a list', ['lugano', 'Lugano']],
    ])('dropsAnEntryWith_%s', (_label, entry) => {
      expect(parseDestinations(JSON.stringify([entry, { id: 'ok', label: 'Fine' }]))).toEqual([{ id: 'ok', label: 'Fine' }]);
    });

    it('acceptsTheLimits', () => {
      expect(parseDestinations(JSON.stringify([{ id: 'a'.repeat(100), label: 'b'.repeat(80) }]))).toHaveLength(1);
    });

    it('keepsAtMost200', () => {
      const many = Array.from({ length: 250 }, (_unused, index) => ({ id: `p${index}`, label: `Place ${index}` }));

      const kept = parseDestinations(JSON.stringify(many));
      expect(kept).toHaveLength(200);
      expect(kept[199].id).toBe('p199');
    });

    it('dropsARepeatedId', () => {
      expect(parseDestinations([{ id: 'a', label: 'One' }, { id: 'a', label: 'Two' }])).toEqual([{ id: 'a', label: 'One' }]);
    });

    it('closesUpTheSpacesOfALabel', () => {
      expect(parseDestinations([{ id: 'a', label: '  Lago   di\nLugano ' }])).toEqual([{ id: 'a', label: 'Lago di Lugano' }]);
    });

    it('dropsEverythingOfAFileThatIsTooBig', () => {
      expect(parseDestinations(`[${'{"id":"a","label":"b"},'.repeat(3000)}{"id":"a","label":"b"}]`)).toEqual([]);
    });

    it.each([[undefined], [null], [''], ['not json'], ['{}'], ['3'], [{}], [7], [true]])('givesNothingFor_%s', (value) => {
      expect(parseDestinations(value)).toEqual([]);
    });
  });
});

describe('the number of guests (AC2)', () => {
  it('searchBar_Guests_StartAtTwoAndTheMaximumIsTheAttribute', () => {
    bar({ maxGuests: '6' });

    expect(guests().value).toBe('2');
    expect(guests().getAttribute('min')).toBe('1');
    expect(guests().getAttribute('max')).toBe('6');
  });

  it('searchBar_Guests_AMaximumOfOneStartsAtOne', () => {
    bar({ maxGuests: '1' });

    expect(guests().value).toBe('1');
  });

  it('searchBar_Guests_TheMaximumDefaultsTo16', () => {
    bar();

    expect(guests().getAttribute('max')).toBe('16');
    expect(DEFAULT_MAX_GUESTS).toBe(16);
  });

  it.each([
    ['8', 8],
    [8, 8],
    ['1', 1],
    ['99', 99],
    ['100', 99],
    ['5000', 99],
    [' 12 ', 12],
    ['0', 16],
    ['-3', 16],
    ['2.5', 16],
    ['abc', 16],
    ['', 16],
    [undefined, 16],
    [null, 16],
    [Number.NaN, 16],
    [{}, 16],
  ])('parseMaxGuests_%s_Is_%s', (value, expected) => {
    expect(parseMaxGuests(value)).toBe(expected);
  });

  it('searchBar_Stepper_ChangesTheNumberByOneAndStopsAtTheLimits', () => {
    bar({ maxGuests: '3' });
    const fewer = q('[aria-label="Meno ospiti"]');
    const more = q('[aria-label="Più ospiti"]');

    more.click();
    expect(guests().value).toBe('3');
    expect(more.getAttribute('aria-disabled')).toBe('true');
    more.click();
    expect(guests().value).toBe('3');

    fewer.click();
    fewer.click();
    expect(guests().value).toBe('1');
    expect(fewer.getAttribute('aria-disabled')).toBe('true');
    fewer.click();
    expect(guests().value).toBe('1');
    expect(more.getAttribute('aria-disabled')).toBe('false');
  });

  it('searchBar_Stepper_StartsFromAValidNumberWhenTheFieldHoldsNone', () => {
    bar();
    guests().value = '';

    q('[aria-label="Più ospiti"]').click();

    expect(guests().value).toBe('3');
  });
});

describe('the calendar of the bar (AC4)', () => {
  it('searchBar_Calendar_OpensOnTheOpenerAndClosesOnIt', () => {
    bar();

    expect(q('[role="dialog"]').hidden).toBe(true);
    opener().click();
    expect(q('[role="dialog"]').hidden).toBe(false);
    expect(opener().getAttribute('aria-expanded')).toBe('true');
    opener().click();
    expect(q('[role="dialog"]').hidden).toBe(true);
    expect(opener().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(opener());
  });

  it('searchBar_Calendar_ShowsOneMonthBelow640PixelsAndTwoFrom640', () => {
    const width = vi.spyOn(Element.prototype, 'clientWidth', 'get');
    bar();

    width.mockReturnValue(639);
    opener().click();
    expect(document.querySelectorAll('table[role="grid"]')).toHaveLength(1);
    opener().click();

    width.mockReturnValue(640);
    opener().click();
    expect(document.querySelectorAll('table[role="grid"]')).toHaveLength(2);
    expect([...document.querySelectorAll('.czs-month-title')].map((title) => title.textContent)).toEqual(['dicembre 2026', 'gennaio 2027']);
  });

  it('searchBar_Calendar_TheOpenerShowsTheStay', () => {
    bar();

    choose('2026-12-05', '2026-12-09');

    expect(opener().textContent).toBe('5 dic – 9 dic');
    expect(opener().getAttribute('aria-expanded')).toBe('false');
  });

  it('searchBar_Calendar_AnArrivalWithNoDepartureShowsItAndAnEllipsis', () => {
    bar();

    opener().click();
    cell('2026-12-05').click();

    expect(opener().textContent).toBe('5 dic – …');
  });

  it('searchBar_Calendar_AnAnnouncementSaysTheArrivalAndTheDeparture', () => {
    bar();

    opener().click();
    cell('2026-12-12').click();
    expect(live().textContent).toBe('Arrivo 12 dicembre. Scegli la partenza.');
    cell('2026-12-15').click();
    expect(live().textContent).toBe('Partenza 15 dicembre. 3 notti.');
  });

  it('searchBar_Calendar_AnAnnouncementCountsOneNight', () => {
    bar({ lang: 'en' });

    opener().click();
    cell('2026-12-12').click();
    expect(live().textContent).toBe('Arrival 12 December. Choose the departure.');
    cell('2026-12-13').click();
    expect(live().textContent).toBe('Departure 13 December. 1 night.');
  });

  it('searchBar_Calendar_KeyboardOnly_OpensMovesPicksAndGivesTheFocusBack', () => {
    bar();
    // Enter and Space on the button are its click: the opener is a real button.
    opener().focus();
    opener().click();
    expect(document.activeElement).toBe(cell('2026-12-01'));

    press(document.activeElement as Element, 'ArrowDown');
    press(document.activeElement as Element, 'ArrowRight');
    expect(document.activeElement).toBe(cell('2026-12-09'));
    press(document.activeElement as Element, 'Home');
    expect(document.activeElement).toBe(cell('2026-12-07'));
    press(document.activeElement as Element, 'End');
    expect(document.activeElement).toBe(cell('2026-12-13'));
    press(document.activeElement as Element, 'PageDown');
    expect(document.activeElement).toBe(cell('2027-01-13'));
    press(document.activeElement as Element, 'PageUp');
    expect(document.activeElement).toBe(cell('2026-12-13'));

    press(document.activeElement as Element, 'Enter');
    expect(live().textContent).toBe('Arrivo 13 dicembre. Scegli la partenza.');
    press(document.activeElement as Element, 'ArrowDown');
    press(document.activeElement as Element, ' ');
    expect(live().textContent).toBe('Partenza 20 dicembre. 7 notti.');
    expect(q('[role="dialog"]').hidden).toBe(true);
    expect(document.activeElement).toBe(opener());
    expect(opener().textContent).toBe('13 dic – 20 dic');
  });

  it('searchBar_Calendar_EscapeClosesAndTheFocusGoesBackToTheOpener', () => {
    bar();
    opener().click();
    press(document.activeElement as Element, 'ArrowRight');

    press(document.activeElement as Element, 'Escape');

    expect(q('[role="dialog"]').hidden).toBe(true);
    expect(document.activeElement).toBe(opener());
    expect(opener().getAttribute('aria-expanded')).toBe('false');
    expect(opener().textContent).toBe('Aggiungi le date');
  });

  it('searchBar_Calendar_AClickOutsideClosesItWithoutTakingTheFocus', () => {
    bar();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    opener().click();

    outside.focus();
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    expect(q('[role="dialog"]').hidden).toBe(true);
    expect(document.activeElement).toBe(outside);
  });

  it('searchBar_Calendar_AClickInsideTheBarDoesNotClose', () => {
    bar();
    opener().click();

    q('.czs-form').dispatchEvent(new Event('pointerdown', { bubbles: true }));

    expect(q('[role="dialog"]').hidden).toBe(false);
  });

  it('searchBar_Calendar_FocusMovingToAnotherControlClosesIt', () => {
    bar();
    opener().click();

    guests().focus();
    guests().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: guests() }));

    expect(q('[role="dialog"]').hidden).toBe(true);
    // The focus stays where the guest put it: it is not taken back to the opener.
    expect(document.activeElement).toBe(guests());
  });

  it('searchBar_Calendar_FocusMovingInsideTheCalendarDoesNotClose', () => {
    bar();
    opener().click();
    const day = cell('2026-12-02');

    day.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: cell('2026-12-03') }));
    day.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));

    expect(q('[role="dialog"]').hidden).toBe(false);
  });

  it('searchBar_Calendar_TheOpenerIsNamedByItsLabelAndItsValue', () => {
    bar();
    choose('2026-12-05', '2026-12-09');

    const names = (opener().getAttribute('aria-labelledby') as string).split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(names).toEqual(['Quando', '5 dic – 9 dic']);
  });

  it('searchBar_TwoBarsOnAPage_HaveTheirOwnIds', () => {
    bar();
    bar();

    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the submit (AC1)', () => {
  it('searchBar_Submit_NavigatesToTheTargetWithTheStayTheOtherParametersAndTheHash', () => {
    stubLocation('?utm_source=newsletter&utm_campaign=natale&utm_medium=a%20b&email=guest%40example.com&code=SECRET&checkin=1999-01-01');
    bar({
      target: `${BASE}/prenota/?foo=1&utm_campaign=fixed#sezione`,
      destinations: '[{"id":"lugano","label":"Lugano"},{"id":"locarno","label":"Locarno"}]',
    });
    (select() as HTMLSelectElement).value = 'locarno';
    q('[aria-label="Più ospiti"]').click();
    q('[aria-label="Più ospiti"]').click();
    choose('2026-12-05', '2026-12-09');

    send().click();

    expect(assign).toHaveBeenCalledTimes(1);
    const url = new URL(assign.mock.calls[0][0] as string);
    expect(`${url.origin}${url.pathname}`).toBe(`${BASE}/prenota/`);
    expect(url.hash).toBe('#sezione');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      foo: '1',
      // The target sets its own campaign: the page's is not copied over it.
      utm_campaign: 'fixed',
      checkin: '2026-12-05',
      checkout: '2026-12-09',
      guests: '4',
      lang: 'it',
      where: 'locarno',
      // Where the guest came from follows them; what is not a plain token, and everything that is not a `utm_*`, does not.
      utm_source: 'newsletter',
    });
    expect(problem().textContent).toBe('');
  });

  it('searchBar_Submit_WithNoPlaceChosenSendsNoWhere', () => {
    bar({ destinations: '[{"id":"lugano","label":"Lugano"}]' });
    choose('2026-12-05', '2026-12-09');

    send().click();

    const url = new URL(assign.mock.calls[0][0] as string);
    expect(url.searchParams.has('where')).toBe(false);
    expect(Object.fromEntries(url.searchParams)).toEqual({ checkin: '2026-12-05', checkout: '2026-12-09', guests: '2', lang: 'it' });
  });

  it('searchBar_Submit_InEnglishSendsTheLanguage', () => {
    bar({ lang: 'en' });
    choose('2026-12-05', '2026-12-09');

    send().click();

    expect(new URL(assign.mock.calls[0][0] as string).searchParams.get('lang')).toBe('en');
  });

  it('searchBar_Submit_TheStayOfTheBarWinsOverTheOneOfTheTarget', () => {
    bar({ target: `${TARGET}?checkin=2020-01-01&checkout=2020-01-05&guests=9&lang=en&where=old` });
    choose('2026-12-05', '2026-12-09');

    send().click();

    const url = new URL(assign.mock.calls[0][0] as string);
    expect(url.searchParams.getAll('checkin')).toEqual(['2026-12-05']);
    expect(url.searchParams.getAll('guests')).toEqual(['2']);
    expect(url.searchParams.getAll('lang')).toEqual(['it']);
    // A place the bar did not choose is not touched: the target may pin one.
    expect(url.searchParams.getAll('where')).toEqual(['old']);
  });

  it('searchBar_Submit_ATargetThatIsRelativeIsReadAgainstThePage', () => {
    stubLocation();
    bar({ target: '/prenota/?x=1' });
    choose('2026-12-05', '2026-12-09');

    send().click();

    const url = new URL(assign.mock.calls[0][0] as string);
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe('/prenota/');
    expect(url.searchParams.get('x')).toBe('1');
  });

  it.each([
    ['the agency domain', { base: BASE, org: '' }, `${BASE}/`],
    ['the CasaZen domain', { base: 'https://app.casazen.example', org: 'villa-rossi' }, 'https://app.casazen.example/book/villa-rossi'],
  ])('searchBar_Submit_WithNoTargetGoesToTheHomeOf_%s', (_label, site, home) => {
    bar({ target: undefined, ...site });
    choose('2026-12-05', '2026-12-09');

    send().click();

    const url = new URL(assign.mock.calls[0][0] as string);
    expect(`${url.origin}${url.pathname}`).toBe(home);
    expect(url.searchParams.get('checkin')).toBe('2026-12-05');
  });

  it('searchBar_Submit_EnterInTheGuestsFieldSendsTheForm', () => {
    bar();
    choose('2026-12-05', '2026-12-09');

    q('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('searchBar_Submit_ReportsTheSearchBeforeItLeaves', () => {
    bar({ destinations: '[{"id":"lugano","label":"Lugano"}]' });
    (select() as HTMLSelectElement).value = 'lugano';
    choose('2026-12-05', '2026-12-09');
    emit.mockImplementation(() => expect(assign).not.toHaveBeenCalled());

    send().click();

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('search', { search_term: 'Lugano', start_date: '2026-12-05', end_date: '2026-12-09', number_of_passengers: 2 });
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('searchBar_Submit_AnySearchWithNoPlaceHasNoSearchTerm', () => {
    bar({ destinations: '[{"id":"lugano","label":"Lugano"}]' });
    choose('2026-12-05', '2026-12-09');

    send().click();

    expect(emit.mock.calls[0][1]).toEqual({ start_date: '2026-12-05', end_date: '2026-12-09', number_of_passengers: 2 });
  });

  describe('with the browser on the far east of the date line (AC1)', () => {
    withBrowserTimeZone('Pacific/Kiritimati');

    it('searchBar_Submit_WritesTheLocalDaysChosenNotTheDayBefore', () => {
      // 10:00 UTC of 1 December is already 2 December in Kiritimati (UTC+14): the first day of the calendar is the 2nd.
      vi.setSystemTime(new Date('2026-12-01T10:00:00Z'));
      bar();

      opener().click();
      expect(document.activeElement).toBe(cell('2026-12-02'));
      expect(cell('2026-12-01').getAttribute('aria-disabled')).toBe('true');
      cell('2026-12-05').click();
      cell('2026-12-09').click();
      send().click();

      const url = new URL(assign.mock.calls[0][0] as string);
      // A local midnight is 14 hours earlier in UTC: written with `toISOString()` these would be the 4th and the 8th.
      expect(url.searchParams.get('checkin')).toBe('2026-12-05');
      expect(url.searchParams.get('checkout')).toBe('2026-12-09');
      expect(emit.mock.calls[0][1]).toMatchObject({ start_date: '2026-12-05', end_date: '2026-12-09' });
    });
  });
});

describe('what blocks the submit (AC2)', () => {
  it('searchBar_Submit_WithNoDatesIsBlockedWithAMessageAndTheFocusOnTheDates', () => {
    bar();

    send().click();

    expect(problem().getAttribute('role')).toBe('alert');
    expect(problem().textContent).toBe(IT.needDates);
    expect(document.activeElement).toBe(opener());
    expect(opener().getAttribute('aria-describedby')).toBe(problem().id);
    expect(assign).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('searchBar_Submit_WithOnlyAnArrivalIsBlocked', () => {
    bar();
    opener().click();
    cell('2026-12-05').click();

    send().click();

    expect(problem().textContent).toBe(IT.needDates);
    expect(assign).not.toHaveBeenCalled();
  });

  it('searchBar_Submit_InEnglishSaysItInEnglish', () => {
    bar({ lang: 'en' });

    send().click();

    expect(problem().textContent).toBe(EN.needDates);
  });

  it('searchBar_Submit_AnArrivalThatHasBecomePastIsBlocked', () => {
    bar();
    choose('2026-12-02', '2026-12-04');
    // The page stayed open: it is the 5th now.
    vi.setSystemTime(new Date('2026-12-05T12:00:00Z'));

    send().click();

    expect(problem().textContent).toBe(IT.past);
    expect(document.activeElement).toBe(opener());
    expect(assign).not.toHaveBeenCalled();
  });

  it('searchBar_Calendar_APastDayCannotBeChosen', () => {
    // It is the 10th: the days of the month before it are shown, and are over.
    vi.setSystemTime(new Date('2026-12-10T12:00:00Z'));
    bar();
    opener().click();

    cell('2026-12-05').click();
    press(cell('2026-12-05'), 'Enter');

    expect(opener().textContent).toBe('Aggiungi le date');
    expect(cell('2026-12-05').getAttribute('aria-disabled')).toBe('true');
    expect(cell('2026-12-10').hasAttribute('aria-disabled')).toBe(false);
  });

  it('searchBar_Calendar_ADayOnOrBeforeTheArrivalIsNeverTheDeparture', () => {
    bar();
    opener().click();

    cell('2026-12-09').click();
    cell('2026-12-05').click();
    cell('2026-12-05').click();

    // Each of them started the stay again; there is still no departure.
    expect(opener().textContent).toBe('5 dic – …');
    send().click();
    expect(problem().textContent).toBe(IT.needDates);
  });

  it.each([
    ['over the maximum', '17', '16', IT.guestsRange.replace('{max}', '16')],
    ['over a maximum of the page', '9', '8', IT.guestsRange.replace('{max}', '8')],
    ['zero', '0', '16', IT.guestsRange.replace('{max}', '16')],
    ['negative', '-1', '16', IT.guestsRange.replace('{max}', '16')],
    ['a fraction', '2.5', '16', IT.guestsRange.replace('{max}', '16')],
    ['nothing', '', '16', IT.guestsRange.replace('{max}', '16')],
  ])('searchBar_Submit_%s_GuestsIsBlockedWithTheFocusOnTheField', (_label, value, max, message) => {
    bar({ maxGuests: max });
    choose('2026-12-05', '2026-12-09');
    guests().value = value;
    guests().dispatchEvent(new Event('input', { bubbles: true }));

    send().click();

    expect(problem().textContent).toBe(message);
    expect(document.activeElement).toBe(guests());
    expect(guests().getAttribute('aria-invalid')).toBe('true');
    expect(guests().getAttribute('aria-describedby')).toBe(problem().id);
    expect(assign).not.toHaveBeenCalled();
  });

  it('searchBar_Submit_TheMaximumOfThePageIsNeverAbove99', () => {
    bar({ maxGuests: '1000' });
    choose('2026-12-05', '2026-12-09');

    guests().value = '99';
    send().click();
    expect(assign).toHaveBeenCalledTimes(1);

    guests().value = '100';
    send().click();
    expect(assign).toHaveBeenCalledTimes(1);
    expect(problem().textContent).toBe(IT.guestsRange.replace('{max}', '99'));
  });

  it('searchBar_Submit_TheFocusGoesToTheFirstInvalidControl', () => {
    bar();
    guests().value = '40';

    send().click();

    expect(document.activeElement).toBe(opener());
    expect(problem().textContent).toBe(IT.needDates);
  });

  it('searchBar_Submit_TheMessageGoesAwayWhenTheProblemIsFixed', () => {
    bar();
    send().click();
    expect(problem().textContent).not.toBe('');

    opener().click();
    cell('2026-12-05').click();

    expect(problem().textContent).toBe('');
    expect(opener().hasAttribute('aria-describedby')).toBe(false);
  });

  it('searchBar_Submit_TheGuestsMessageGoesAwayWhenTheNumberIsFixed', () => {
    bar();
    choose('2026-12-05', '2026-12-09');
    guests().value = '40';
    send().click();
    expect(guests().getAttribute('aria-invalid')).toBe('true');

    q('[aria-label="Meno ospiti"]').click();

    expect(problem().textContent).toBe('');
    expect(guests().hasAttribute('aria-invalid')).toBe(false);
  });

  describe('findProblem', () => {
    const stay = (checkIn: string, checkOut: string, count = 2) => ({ checkIn, checkOut, guests: count });
    const today = '2026-12-01';

    it.each([
      ['no dates', stay('', ''), 'dates', 'needDates'],
      ['no departure', stay('2026-12-05', ''), 'dates', 'needDates'],
      ['no arrival', stay('', '2026-12-09'), 'dates', 'needDates'],
      ['dates that do not exist', stay('2026-02-30', '2026-03-03'), 'dates', 'needDates'],
      ['dates written another way', stay('05/12/2026', '09/12/2026'), 'dates', 'needDates'],
      ['a departure before the arrival', stay('2026-12-09', '2026-12-05'), 'dates', 'order'],
      ['a departure on the arrival', stay('2026-12-05', '2026-12-05'), 'dates', 'order'],
      ['an arrival in the past', stay('2026-11-30', '2026-12-05'), 'dates', 'past'],
      ['a whole stay in the past', stay('2026-11-20', '2026-11-25'), 'dates', 'past'],
      ['no guests', stay('2026-12-05', '2026-12-09', 0), 'guests', 'guestsRange'],
      ['too many guests', stay('2026-12-05', '2026-12-09', 17), 'guests', 'guestsRange'],
      ['guests that are a fraction', stay('2026-12-05', '2026-12-09', 2.5), 'guests', 'guestsRange'],
      ['guests that are not a number', stay('2026-12-05', '2026-12-09', Number.NaN), 'guests', 'guestsRange'],
    ])('findProblem_%s', (_label, value, control, message) => {
      expect(findProblem(value, today, 16)).toEqual({ control, message });
    });

    it.each([
      ['a stay that starts today', stay(today, '2026-12-02')],
      ['one night', stay('2026-12-05', '2026-12-06')],
      ['a stay over a year end', stay('2026-12-30', '2027-01-03')],
      ['the most guests', stay('2026-12-05', '2026-12-09', 16)],
      ['one guest', stay('2026-12-05', '2026-12-09', 1)],
    ])('findProblem_%s_IsFine', (_label, value) => {
      expect(findProblem(value, today, 16)).toBeNull();
    });

    it('findProblem_TheDatesAreCheckedBeforeTheGuests', () => {
      expect(findProblem(stay('', '', 99), today, 16)?.control).toBe('dates');
    });
  });
});

describe('the target (AC3)', () => {
  it.each([
    ['a script', 'javascript:alert(document.cookie)'],
    ['a script in capitals', 'JAVASCRIPT:alert(1)'],
    ['a script with a space before it', '  javascript:alert(1)'],
    ['a script with a tab inside', 'java\tscript:alert(1)'],
    ['a data address', 'data:text/html,<script>alert(1)</script>'],
    ['another script scheme', 'vbscript:msgbox(1)'],
    ['a file', 'file:///etc/passwd'],
    ['an FTP address', 'ftp://prenota.quokka360.com/'],
    ['an address with no host', 'http://'],
    ['an address with a bad host', 'https://exa mple.com/'],
    ['an address with credentials', 'https://user:secret@prenota.quokka360.com/'],
    ['a number', 7],
    ['a list', ['https://prenota.quokka360.com/']],
    ['an object', { href: 'https://prenota.quokka360.com/' }],
  ])('searchBar_target_rejectsJavascriptUrls_%s', (_label, target) => {
    bar({ target });
    choose('2026-12-05', '2026-12-09');

    send().click();

    expect(assign).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(problem().textContent).toBe(IT.badTarget);
  });

  it('searchBar_target_TheMessageIsInEnglishForAnEnglishBar', () => {
    bar({ lang: 'en', target: 'javascript:alert(1)' });
    choose('2026-12-05', '2026-12-09');

    send().click();

    expect(problem().textContent).toBe(EN.badTarget);
  });

  it('searchBar_target_WithNothingToGoToSaysSo', () => {
    bar({ target: undefined, base: '' });
    choose('2026-12-05', '2026-12-09');

    send().click();

    expect(assign).not.toHaveBeenCalled();
    expect(problem().textContent).toBe(IT.badTarget);
  });

  describe('resolveTarget', () => {
    const site = { base: BASE, org: '' };

    it.each([
      ['an address', 'https://example.com/prenota/?a=1#x', 'https://example.com/prenota/?a=1#x'],
      ['an address with spaces around it', '  https://example.com/prenota/ ', 'https://example.com/prenota/'],
      ['http', 'http://example.com/', 'http://example.com/'],
      ['a path', '/prenota/', 'https://www.quokka360.com/prenota/'],
      ['a path with a query', '/prenota/?a=1', 'https://www.quokka360.com/prenota/?a=1'],
      ['a name of a page', 'prenota', 'https://www.quokka360.com/blog/prenota'],
      ['an address with no scheme', '//example.com/p', 'https://example.com/p'],
      ['nothing', undefined, `${BASE}/`],
      ['null', null, `${BASE}/`],
      ['an empty text', '', `${BASE}/`],
    ])('resolves_%s', (_label, value, expected) => {
      expect(resolveTarget(value, site, 'https://www.quokka360.com/blog/post')?.href).toBe(expected);
    });

    it('resolves_NothingOnTheCasaZenDomainToTheHomeOfTheOrg', () => {
      expect(resolveTarget(undefined, { base: 'https://app.casazen.example', org: 'villa-rossi' }, 'https://x.example/')?.href).toBe('https://app.casazen.example/book/villa-rossi');
    });

    it('resolves_NothingWithNoSiteToNull', () => {
      expect(resolveTarget(undefined, { base: '', org: '' }, 'https://x.example/')).toBeNull();
    });
  });

  describe('buildSearchUrl', () => {
    const stay = { checkIn: '2026-12-05', checkOut: '2026-12-09', guests: 3 };

    it('writesTheStayTheLanguageAndThePlace', () => {
      const url = new URL(buildSearchUrl(new URL('https://example.com/p'), stay, 'en', 'lugano', ''));

      expect(Object.fromEntries(url.searchParams)).toEqual({ checkin: '2026-12-05', checkout: '2026-12-09', guests: '3', lang: 'en', where: 'lugano' });
    });

    it('doesNotChangeTheTargetItWasGiven', () => {
      const target = new URL('https://example.com/p?a=1');

      buildSearchUrl(target, stay, 'it', '', '?utm_source=x');

      expect(target.href).toBe('https://example.com/p?a=1');
    });

    it('copiesOnlyTheCampaignOfThePage', () => {
      const url = new URL(
        buildSearchUrl(new URL('https://example.com/p'), stay, 'it', '', '?utm_source=a&utm_medium=b&utm_campaign=c&utm_term=d&utm_content=e&utm_x=f&utm_source2=g&gclid=h&email=i%40j.k'),
      );

      expect([...url.searchParams.keys()].filter((key) => key.startsWith('utm_'))).toEqual(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']);
      expect(url.searchParams.has('gclid')).toBe(false);
      expect(url.searchParams.has('email')).toBe(false);
    });
  });
});

describe('what goes out, and what never does (AC5)', () => {
  it('searchBar_url_carriesNoPersonalData', () => {
    stubLocation('?utm_source=newsletter&email=guest%40example.com&phone=3331234567&name=Mario&code=ABCDE-FGHIJ&token=secret&utm_content=guest%40example.com');
    bar({ destinations: '[{"id":"lugano","label":"Lugano"}]' });
    (select() as HTMLSelectElement).value = 'lugano';
    choose('2026-12-05', '2026-12-09');

    send().click();

    const url = new URL(assign.mock.calls[0][0] as string);
    expect([...url.searchParams.keys()].sort()).toEqual(['checkin', 'checkout', 'guests', 'lang', 'utm_source', 'where']);
    expect(url.href).not.toMatch(/guest@|%40|3331234567|Mario|ABCDE|secret/);
    for (const [name, value] of url.searchParams) {
      expect(value, name).toMatch(/^[\w.~-]+$/);
    }
    // The event carries no more than the stay and the place.
    expect(Object.keys(emit.mock.calls[0][1] as object).sort()).toEqual(['end_date', 'number_of_passengers', 'search_term', 'start_date']);
  });

  it('searchBar_makesNoNetworkCall', () => {
    const fetchSpy = vi.fn();
    const requestSpy = vi.fn();
    const beaconSpy = vi.fn();
    const imageSpy = vi.fn();
    const socketSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('XMLHttpRequest', requestSpy);
    vi.stubGlobal('Image', imageSpy);
    vi.stubGlobal('WebSocket', socketSpy);
    vi.stubGlobal('EventSource', socketSpy);
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beaconSpy });
    const created: string[] = [];
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string, optionsArgument?: ElementCreationOptions) => {
      created.push(tag.toLowerCase());
      return createElement(tag, optionsArgument);
    }) as typeof document.createElement);

    bar({ destinations: '[{"id":"lugano","label":"Lugano"}]' });
    choose('2026-12-05', '2026-12-09');
    send().click();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
    expect(imageSpy).not.toHaveBeenCalled();
    expect(socketSpy).not.toHaveBeenCalled();
    // Nothing that loads anything is created: no image, frame, script, link, object, audio or video.
    expect(created.filter((tag) => ['img', 'iframe', 'script', 'link', 'object', 'embed', 'audio', 'video', 'source', 'picture'].includes(tag))).toEqual([]);
    expect(document.querySelectorAll('iframe, img, script')).toHaveLength(0);
    Reflect.deleteProperty(navigator, 'sendBeacon');
  });

  it('searchBar_TouchesNoStorageAndNoCookie', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const cookieWrite = vi.spyOn(document, 'cookie', 'set');
    const cookieRead = vi.spyOn(document, 'cookie', 'get');

    bar({ destinations: '[{"id":"lugano","label":"Lugano"}]' });
    choose('2026-12-05', '2026-12-09');
    send().click();

    for (const spy of [setItem, getItem, removeItem, cookieWrite, cookieRead]) expect(spy).not.toHaveBeenCalled();
  });

  it('searchBar_NeverWritesAStyleAttributeAsText', () => {
    const setAttribute = vi.spyOn(Element.prototype, 'setAttribute');

    bar({ theme: '{"primary":"#0a7d5a","radius":"12px","font":"moderno"}' });
    choose('2026-12-05', '2026-12-09');

    expect(setAttribute.mock.calls.filter(([name]) => String(name).toLowerCase() === 'style')).toEqual([]);
  });
});

describe('the report of the search and the preview (AC7)', () => {
  it('searchBar_Preview_ChecksAndReportsButNeverLeaves', () => {
    bar({ preview: true });
    choose('2026-12-05', '2026-12-09');

    send().click();

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('search', { start_date: '2026-12-05', end_date: '2026-12-09', number_of_passengers: 2 });
    expect(assign).not.toHaveBeenCalled();
    expect(note().textContent).toBe(IT.preview);
    expect(problem().textContent).toBe('');
  });

  it('searchBar_Preview_InEnglishSaysItInEnglish', () => {
    bar({ preview: true, lang: 'en' });
    choose('2026-12-05', '2026-12-09');

    send().click();

    expect(note().textContent).toBe(EN.preview);
  });

  it('searchBar_Preview_StillBlocksWhatIsWrong', () => {
    bar({ preview: true });

    send().click();

    expect(problem().textContent).toBe(IT.needDates);
    expect(emit).not.toHaveBeenCalled();
    expect(note().textContent).toBe('');
  });

  it('searchBar_Preview_StillSaysThatTheTargetIsWrong', () => {
    bar({ preview: true, target: 'javascript:alert(1)' });
    choose('2026-12-05', '2026-12-09');

    send().click();

    expect(problem().textContent).toBe(IT.badTarget);
    expect(emit).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('searchBar_Preview_TheNoteGoesAwayWhenTheStayChanges', () => {
    bar({ preview: true });
    choose('2026-12-05', '2026-12-09');
    send().click();
    expect(note().textContent).not.toBe('');

    opener().click();
    cell('2026-12-12').click();

    expect(note().textContent).toBe('');
  });

  it('searchBar_NotInPreview_HasNoNote', () => {
    bar();
    choose('2026-12-05', '2026-12-09');

    send().click();

    expect(note().textContent).toBe('');
  });
});

describe('the look (AC5, AC6)', () => {
  it('searchCss_EveryRuleIsScopedByThePrefixOfTheBar', () => {
    // Every selector of every rule, also inside the media query, starts with the root of the bar.
    const rules = SEARCH_CSS.replace(/@media[^{]*\{/g, '').split('}').filter((rule) => rule.trim() !== '');
    expect(rules.length).toBeGreaterThan(20);
    for (const rule of rules) {
      const selectors = rule.slice(0, rule.indexOf('{')).split(',');
      for (const selector of selectors) expect(selector.startsWith('.czs-root.czs-root'), selector).toBe(true);
    }
    expect(SEARCH_CSS).not.toMatch(/(^|[},])\s*(button|input|select|table|td|th|tr|label|form|p|div|span|a)\b/);
  });

  it('searchCss_TheElementsOfThePageThatThemesStyleAreResetByTheBar', () => {
    for (const property of ['margin', 'padding', 'border', 'background', 'box-shadow', 'text-transform', 'letter-spacing', 'font-size', 'line-height', 'color', 'text-shadow', 'transition']) {
      expect(SEARCH_CSS, property).toContain(`${property}:`);
    }
    // The states a theme styles: hover, focus and active are declared for the buttons and the controls.
    expect(SEARCH_CSS).toContain('.czs-btn:hover');
    expect(SEARCH_CSS).toContain('.czs-control:focus');
    expect(SEARCH_CSS).toContain('.czs-step:active');
  });

  it('searchCss_TheControlsDeclareTheSizeOfATouchTargetAndAVisibleFocus', () => {
    // Targets of at least 44 px, and a visible focus.
    expect(SEARCH_CSS).toMatch(/\.czs-btn\{[^}]*min-height:44px/);
    expect(SEARCH_CSS).toMatch(/\.czs-control\{[^}]*min-height:44px/);
    expect(SEARCH_CSS).toMatch(/\.czs-day\{[^}]*height:44px/);
    expect(SEARCH_CSS).toMatch(/\.czs-step[^{]*\{[^}]*width:44px/);
    expect(SEARCH_CSS).toMatch(/\.czs-control:focus[^{]*\{[^}]*outline:3px solid/);
  });

  describe('where the CSS goes', () => {
    class FakeSheet {
      css = '';
      replaceSync(css: string) {
        this.css = css;
      }
    }

    it('searchBar_Styles_AreAdoptedWhenTheBrowserHasConstructableStylesheetsAndOnlyOnce', () => {
      vi.stubGlobal('CSSStyleSheet', FakeSheet);
      Object.defineProperty(document, 'adoptedStyleSheets', { configurable: true, writable: true, value: [] });

      bar();
      bar();

      const sheets = (document as unknown as { adoptedStyleSheets: FakeSheet[] }).adoptedStyleSheets;
      expect(sheets).toHaveLength(1);
      expect(sheets[0].css).toBe(SEARCH_CSS);
      expect(document.querySelectorAll('style')).toHaveLength(0);
    });

    it('searchBar_Styles_KeepTheSheetsThePageAlreadyAdopted', () => {
      const own = new FakeSheet();
      vi.stubGlobal('CSSStyleSheet', FakeSheet);
      Object.defineProperty(document, 'adoptedStyleSheets', { configurable: true, writable: true, value: [own] });

      bar();

      const sheets = (document as unknown as { adoptedStyleSheets: FakeSheet[] }).adoptedStyleSheets;
      expect(sheets).toHaveLength(2);
      expect(sheets[0]).toBe(own);
    });

    it('searchBar_Styles_AreAStyleElementWithTheNonceOfTheScriptWhereThereAreNoConstructableStylesheets', async () => {
      Object.defineProperty(document, 'currentScript', { configurable: true, get: () => ({ nonce: 'abc123' }) });
      mount = await loadBar();

      bar();
      bar();

      const styles = document.querySelectorAll('style');
      expect(styles).toHaveLength(1);
      expect(styles[0].nonce).toBe('abc123');
      expect(styles[0].textContent).toBe(SEARCH_CSS);
      expect(styles[0].parentElement).toBe(document.head);
      expect(styles[0].getAttribute('style')).toBeNull();
    });

    it('searchBar_Styles_AreAStyleElementWhenAdoptingFails', () => {
      vi.stubGlobal(
        'CSSStyleSheet',
        class {
          replaceSync() {
            throw new Error('not allowed');
          }
        },
      );
      Object.defineProperty(document, 'adoptedStyleSheets', { configurable: true, writable: true, value: [] });

      bar();

      expect(document.querySelectorAll('style')).toHaveLength(1);
      expect((document as unknown as { adoptedStyleSheets: unknown[] }).adoptedStyleSheets).toHaveLength(0);
    });

    it('searchBar_Styles_GoIntoTheShadowRootOfAHostThatHasOne', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const inside = document.createElement('div');
      shadow.appendChild(inside);

      installStyles(inside, 'nonce-1');
      installStyles(inside, 'nonce-1');

      const styles = shadow.querySelectorAll('style');
      expect(styles).toHaveLength(1);
      expect(styles[0].nonce).toBe('nonce-1');
      expect(document.head.querySelectorAll('style')).toHaveLength(0);
    });
  });

  describe('the theme', () => {
    it('searchBar_Theme_IsAppliedAsVariablesOnTheRoot', () => {
      bar({ theme: { primary: '#0A7D5A', radius: '12px', font: 'moderno' } });

      const root = q('.czs-root');
      expect(root.style.getPropertyValue('--czs-primary')).toBe('#0a7d5a');
      expect(root.style.getPropertyValue('--czs-radius')).toBe('12px');
      expect(root.style.getPropertyValue('--czs-font')).toContain('Inter');
      expect(root.style.getPropertyValue('--czs-on-primary')).toBe('#ffffff');
      expect(root.style.getPropertyValue('--czs-tint')).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('searchBar_Theme_AnInvalidMemberIsIgnoredAndTheOthersStay', () => {
      bar({ theme: { primary: 'red', radius: '12px', font: 'comic-sans' } });

      const root = q('.czs-root');
      expect(root.style.getPropertyValue('--czs-primary')).toBe('');
      expect(root.style.getPropertyValue('--czs-on-primary')).toBe('');
      expect(root.style.getPropertyValue('--czs-font')).toBe('');
      expect(root.style.getPropertyValue('--czs-radius')).toBe('12px');
    });

    it('searchBar_Theme_WithoutOneSetsNothing', () => {
      bar();

      expect(q('.czs-root').style.length).toBe(0);
    });

    it.each([
      ['a text that is not JSON', 'not json'],
      ['a list', ['#ffffff']],
      ['null', null],
      ['a number', 3],
    ])('searchBar_Theme_%s_SetsNothing', (_label, theme) => {
      bar({ theme });

      expect(q('.czs-root').style.length).toBe(0);
    });

    it.each([
      ['#abc', '#aabbcc'],
      ['#ABC', '#aabbcc'],
      ['#0a7d5a', '#0a7d5a'],
      ['#0A7D5A', '#0a7d5a'],
      [' #0a7d5a ', '#0a7d5a'],
    ])('readHex_%s_Is_%s', (value, expected) => {
      expect(readHex(value)).toBe(expected);
    });

    it.each([['red'], ['#12'], ['#12345'], ['#1234567'], ['0a7d5a'], ['#ggg'], ['rgb(0,0,0)'], ['#0a7d5a; background: url(x)'], [''], [5], [null], [undefined]])('readHex_%s_IsNull', (value) => {
      expect(readHex(value)).toBeNull();
    });

    it.each([
      ['0px', '0px'],
      ['12px', '12px'],
      ['32px', '32px'],
      ['0.5rem', '0.5rem'],
      ['2rem', '2rem'],
      [' 8px ', '8px'],
    ])('readRadius_%s_Is_%s', (value, expected) => {
      expect(readRadius(value)).toBe(expected);
    });

    it.each([['33px'], ['2.1rem'], ['-1px'], ['12'], ['12em'], ['12px; color: red'], ['calc(1px)'], [''], [12], [null]])('readRadius_%s_IsNull', (value) => {
      expect(readRadius(value)).toBeNull();
    });

    it.each([['editoriale'], ['moderno'], ['classico']])('themeVariables_TheFont_%s_IsOneOfTheShortList', (font) => {
      expect(themeVariables({ font })['--czs-font']).toMatch(/serif|sans-serif/);
    });

    it.each([['constructor'], ['__proto__'], ['toString'], ['Moderno'], ['Arial, sans-serif'], ['']])('themeVariables_TheFont_%s_IsNotOnTheList', (font) => {
      expect(themeVariables({ font })).toEqual({});
    });

    it('theTextOnThePrimaryHasAContrastOfAtLeast4Point5ForEveryColorOf3Digits', () => {
      const digits = '0123456789abcdef';
      let worst = Infinity;
      for (const red of digits) {
        for (const green of digits) {
          for (const blue of digits) {
            const primary = readHex(`#${red}${green}${blue}`) as string;
            worst = Math.min(worst, contrastRatio(primary, onColor(primary)));
          }
        }
      }

      expect(worst).toBeGreaterThanOrEqual(4.5);
    });

    it('theTextOnThePrimaryHasAContrastOfAtLeast4Point5AlsoNearTheCrossoverOfBlackAndWhite', () => {
      // The hardest colors are the grays around luminance 0.18: every step of gray from 0x60 to 0x90 is tried, and a few colors of the same luminance.
      for (let gray = 0x60; gray <= 0x90; gray += 1) {
        const hex = `#${gray.toString(16).padStart(2, '0').repeat(3)}`;
        expect(contrastRatio(hex, onColor(hex)), hex).toBeGreaterThanOrEqual(4.5);
      }
      for (const hex of ['#767676', '#777777', '#7a7a7a', '#808000', '#008080', '#800080', '#c00000', '#00a000', '#0000ff', '#ff8000']) {
        expect(contrastRatio(hex, onColor(hex)), hex).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('onColor_IsBlackOnALightColorAndWhiteOnADarkOne', () => {
      expect(onColor('#ffffff')).toBe('#000000');
      expect(onColor('#ffeb3b')).toBe('#000000');
      expect(onColor('#000000')).toBe('#ffffff');
      expect(onColor('#0a7d5a')).toBe('#ffffff');
    });

    it('contrastRatio_IsThatOfWcag', () => {
      expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
      expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
      expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 1);
    });
  });
});

describe('the registration with the loader', () => {
  it('search_WithoutALoader_DoesNothing', async () => {
    Reflect.deleteProperty(window, 'CasaZenEmbed');
    vi.resetModules();

    await expect(import('../search')).resolves.toBeDefined();
  });

  it('search_ALoaderThatCannotRegister_IsLeftAlone', async () => {
    (window as EmbedWindow).CasaZenEmbed = {};
    vi.resetModules();

    await expect(import('../search')).resolves.toBeDefined();
  });

  it('search_TheMountReplacesWhatTheContainerHeld', () => {
    const container = document.createElement('div');
    container.textContent = 'old content';
    document.body.appendChild(container);

    mount(container, options());

    expect(container.textContent).not.toContain('old content');
    expect(container.querySelector('form')).not.toBeNull();
  });
});

describe('through the loader (AC7)', () => {
  const BAR_BASE = 'https://prenota.quokka360.com';
  let stopLoader: () => void;

  /** Loads the loader and `search.js` as a page does: the loader asks for the file, the file registers itself, the browser says it loaded. */
  async function pageWithTheLoader(attributes: Record<string, string>): Promise<HTMLElement> {
    const listeners: EventListenerOrEventListenerObject[] = [];
    const observers: MutationObserver[] = [];
    const add = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type: string, listener: EventListenerOrEventListenerObject, optionsArgument?: boolean | AddEventListenerOptions) => {
      if (type === 'message') listeners.push(listener);
      add(type, listener, optionsArgument);
    });
    const Native = window.MutationObserver;
    vi.stubGlobal(
      'MutationObserver',
      class extends Native {
        constructor(callback: MutationCallback) {
          super(callback);
          observers.push(this);
        }
      },
    );
    stopLoader = () => {
      listeners.forEach((listener) => window.removeEventListener('message', listener));
      observers.forEach((observer) => observer.disconnect());
    };

    Reflect.deleteProperty(window, 'CasaZenEmbed');
    const element = document.createElement('div');
    element.setAttribute('data-casazen-widget', 'search');
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(`data-casazen-${name}`, value);
    document.body.appendChild(element);
    Object.defineProperty(document, 'currentScript', { configurable: true, get: () => ({ src: `${BAR_BASE}/embed/v1/embed.js`, nonce: '' }) });
    vi.resetModules();
    await import('../embed');
    const tag = document.querySelector('script[src]') as HTMLScriptElement;
    expect(tag.src).toBe(`${BAR_BASE}/embed/v1/search.js`);
    await import('../search');
    tag.dispatchEvent(new Event('load'));
    return element;
  }

  afterEach(() => {
    stopLoader?.();
  });

  it('searchBar_Search_ReachesTheContainerAndTheDataLayerThroughTheLoader', async () => {
    const element = await pageWithTheLoader({ datalayer: 'true', target: '/prenota/', destinations: '[{"id":"lugano","label":"Lugano"}]', 'max-guests': '4' });
    const heard: CustomEvent[] = [];
    document.body.addEventListener('casazen:event', (event) => heard.push(event as CustomEvent));
    expect(element.querySelector('form[role="search"]')).not.toBeNull();
    expect(guests().getAttribute('max')).toBe('4');
    (select() as HTMLSelectElement).value = 'lugano';
    choose('2026-12-05', '2026-12-09');

    send().click();

    const params = { search_term: 'Lugano', start_date: '2026-12-05', end_date: '2026-12-09', number_of_passengers: 2 };
    expect(heard).toHaveLength(1);
    expect(heard[0].target).toBe(element);
    expect(heard[0].detail).toEqual({ name: 'search', params, widget: 'search' });
    expect((window as EmbedWindow).dataLayer).toEqual([{ ...params, event: 'search' }]);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(new URL(assign.mock.calls[0][0] as string).searchParams.get('where')).toBe('lugano');
  });

  it('searchBar_Search_WithoutTheDataLayerOnlyTheContainerHearsIt', async () => {
    await pageWithTheLoader({ target: '/prenota/' });
    choose('2026-12-05', '2026-12-09');

    send().click();

    expect((window as EmbedWindow).dataLayer).toBeUndefined();
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('searchBar_Search_ThePreviewOfTheCallerOfMountNeverLeavesThePage', async () => {
    await pageWithTheLoader({ target: '/prenota/' });
    const preview = document.createElement('div');
    document.body.appendChild(preview);
    (window as EmbedWindow & { CasaZenEmbed: { mount: (element: Element, options?: Options) => void } }).CasaZenEmbed.mount(preview, { widget: 'search', preview: true });
    const heard: CustomEvent[] = [];
    preview.addEventListener('casazen:event', (event) => heard.push(event as CustomEvent));
    const second = preview.querySelector('form') as HTMLFormElement;
    expect(second).not.toBeNull();
    const previewOpener = second.querySelector('.czs-opener') as HTMLButtonElement;
    previewOpener.click();
    (preview.querySelector('[data-day="2026-12-05"]') as HTMLElement).click();
    (preview.querySelector('[data-day="2026-12-09"]') as HTMLElement).click();

    (second.querySelector('.czs-btn') as HTMLButtonElement).click();

    expect(heard).toHaveLength(1);
    expect(assign).not.toHaveBeenCalled();
  });
});
