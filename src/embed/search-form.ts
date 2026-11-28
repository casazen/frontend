/**
 * The search bar of the hero area of an agency's website (NF-146): the fields, what is checked before the page leaves, and the address it leads to. It is
 * drawn in the page itself, with no frame (a calendar that opens over the hero would be cut by a short one), and it makes no call to any server: the
 * destinations come in an attribute the plugin fills, the target is the page of the agency that holds the booking engine, and the stay goes in its address
 * (`checkin`, `checkout`, `guests`, `lang`, `where`: the keys the booking widget and the loader read), with the `utm_*` of the page so the source survives
 * the two pages. Nothing personal is asked or sent, and everything that came from an attribute is written as text, never as HTML.
 *
 * PURE TYPESCRIPT, NO IMPORT FROM THE APP.
 */

import type { SearchOptions } from './mount-widget';
import { isDate, utmParams } from './page-params';
import { createCalendar, dayFormat, nightsBetween, node, todayLocal, type Day, type Range } from './search-calendar';
import { applyTheme } from './search-styles';
import { SEARCH_TEXTS, type EmbedLang } from './texts';

export const DEFAULT_MAX_GUESTS = 16;
const ABSOLUTE_MAX_GUESTS = 99;

export interface Destination {
  id: string;
  label: string;
}

const DESTINATION_ID = /^[A-Za-z0-9._~-]{1,100}$/;
const MAX_DESTINATIONS = 200;
const MAX_LABEL_LENGTH = 80;
const MAX_DESTINATIONS_JSON = 60_000;

export function parseDestinations(value: unknown): Destination[] {
  let list = value;
  if (typeof value === 'string') {
    if (value.length > MAX_DESTINATIONS_JSON) return [];
    try {
      list = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  const destinations: Destination[] = [];
  for (const item of list) {
    if (destinations.length >= MAX_DESTINATIONS) break;
    if (typeof item !== 'object' || item === null) continue;
    const { id, label } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof label !== 'string' || !DESTINATION_ID.test(id) || seen.has(id)) continue;
    const text = label.replace(/\s+/g, ' ').trim();
    if (text === '' || text.length > MAX_LABEL_LENGTH) continue;
    seen.add(id);
    destinations.push({ id, label: text });
  }
  return destinations;
}

export function parseMaxGuests(value: unknown): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) return DEFAULT_MAX_GUESTS;
  return Math.min(count, ABSOLUTE_MAX_GUESTS);
}

/**
 * The page the bar leads to: `value` (the `target` of the page) as an http or https address, a relative one read against the page the bar is on; without
 * a target, the home of the booking site (`base`, or `base/book/<org>` on the CasaZen domain). Null when it is no such address (a script, text that is
 * not an address, an address with credentials) or when there is none to go to: the bar then says so and goes nowhere.
 */
export function resolveTarget(value: unknown, site: { base: string; org: string }, pageHref: string): URL | null {
  if (value !== undefined && value !== null && typeof value !== 'string') return null;
  const raw = typeof value === 'string' ? value.trim() : '';
  let url: URL;
  try {
    if (raw !== '') url = new URL(raw, pageHref);
    else if (site.base) url = new URL(site.org ? `/book/${site.org}` : '/', site.base);
    else return null;
  } catch {
    return null;
  }
  const web = url.protocol === 'https:' || url.protocol === 'http:';
  return web && !url.username && !url.password ? url : null;
}

export interface Stay extends Range {
  guests: number;
}

export interface Problem {
  control: 'dates' | 'guests';
  message: 'needDates' | 'order' | 'past' | 'guestsRange';
}

export function findProblem(stay: Stay, today: Day, maxGuests: number): Problem | null {
  if (!isDate(stay.checkIn) || !isDate(stay.checkOut)) return { control: 'dates', message: 'needDates' };
  if (stay.checkOut <= stay.checkIn) return { control: 'dates', message: 'order' };
  if (stay.checkIn < today) return { control: 'dates', message: 'past' };
  if (!Number.isInteger(stay.guests) || stay.guests < 1 || stay.guests > maxGuests) return { control: 'guests', message: 'guestsRange' };
  return null;
}

export function buildSearchUrl(target: URL, stay: Stay, lang: EmbedLang, where: string, pageSearch: string): string {
  const url = new URL(target.href);
  url.searchParams.set('checkin', stay.checkIn);
  url.searchParams.set('checkout', stay.checkOut);
  url.searchParams.set('guests', String(stay.guests));
  url.searchParams.set('lang', lang);
  if (where) url.searchParams.set('where', where);
  for (const [name, value] of utmParams(pageSearch)) {
    if (!url.searchParams.has(name)) url.searchParams.set(name, value);
  }
  return url.href;
}

const TWO_MONTHS_FROM = 640;

export function createSearchForm(options: SearchOptions, id: string): HTMLElement {
  const lang: EmbedLang = options.lang === 'en' ? 'en' : 'it';
  const text = SEARCH_TEXTS[lang];
  const maxGuests = parseMaxGuests(options.maxGuests);
  const destinations = parseDestinations(options.destinations);
  const shortDay = dayFormat(lang, { day: 'numeric', month: 'short' });
  const longDay = dayFormat(lang, { day: 'numeric', month: 'long' });
  const range: Range = { checkIn: '', checkOut: '' };

  const root = node('div', 'czs-root');
  applyTheme(root, options.theme);
  const form = node('form', 'czs-form', { role: 'search', 'aria-label': text.form });
  form.noValidate = true;
  const problemBox = node('p', 'czs-alert', { id: `${id}-alert`, role: 'alert' });
  const note = node('p', 'czs-note', { role: 'status' });
  const live = node('p', 'czs-live', { role: 'status', 'aria-live': 'polite' });

  let where: HTMLSelectElement | null = null;
  if (destinations.length > 0) {
    const field = node('div', 'czs-field');
    const label = node('label', 'czs-label', { for: `${id}-where` });
    label.textContent = text.where;
    where = node('select', 'czs-control', { id: `${id}-where` });
    const everywhere = node('option', '', { value: '' });
    everywhere.textContent = text.anywhere;
    where.appendChild(everywhere);
    for (const destination of destinations) {
      const option = node('option', '', { value: destination.id });
      option.textContent = destination.label;
      where.appendChild(option);
    }
    field.append(label, where);
    form.appendChild(field);
  }

  const whenField = node('div', 'czs-field');
  const whenLabel = node('span', 'czs-label', { id: `${id}-when-label` });
  whenLabel.textContent = text.when;
  const opener = node('button', 'czs-control czs-opener', {
    type: 'button',
    id: `${id}-when`,
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    'aria-controls': `${id}-cal`,
    'aria-labelledby': `${id}-when-label ${id}-when-value`,
  });
  const openerValue = node('span', 'czs-opener-value', { id: `${id}-when-value` });
  openerValue.textContent = text.addDates;
  opener.appendChild(openerValue);
  whenField.append(whenLabel, opener);

  const whoField = node('div', 'czs-field');
  const whoLabel = node('label', 'czs-label', { for: `${id}-guests` });
  whoLabel.textContent = text.guests;
  const stepper = node('div', 'czs-stepper');
  const fewer = node('button', 'czs-step', { type: 'button', 'aria-label': text.fewer });
  fewer.textContent = '−';
  const more = node('button', 'czs-step', { type: 'button', 'aria-label': text.more });
  more.textContent = '+';
  const guests = node('input', 'czs-control czs-guests', {
    id: `${id}-guests`,
    type: 'number',
    inputmode: 'numeric',
    min: '1',
    max: String(maxGuests),
    step: '1',
    value: String(Math.min(2, maxGuests)),
  });
  stepper.append(fewer, guests, more);
  whoField.append(whoLabel, stepper);

  const submit = node('button', 'czs-btn', { type: 'submit' });
  submit.textContent = text.go;

  const controls = { dates: opener, guests } as const;
  const clearProblem = (): void => {
    problemBox.textContent = '';
    guests.removeAttribute('aria-invalid');
    for (const control of Object.values(controls)) control.removeAttribute('aria-describedby');
  };
  const showProblem = (problem: Problem): void => {
    problemBox.textContent = problem.message === 'guestsRange' ? text.guestsRange.replace('{max}', String(maxGuests)) : text[problem.message];
    const control = controls[problem.control];
    control.setAttribute('aria-describedby', problemBox.id);
    if (problem.control === 'guests') guests.setAttribute('aria-invalid', 'true');
    control.focus();
  };

  const readGuests = (): number => Number(guests.value);
  const syncStepper = (): void => {
    const count = readGuests();
    fewer.setAttribute('aria-disabled', String(!(count > 1)));
    more.setAttribute('aria-disabled', String(!(count < maxGuests)));
  };
  const step = (by: number): void => {
    const count = readGuests();
    const from = Number.isInteger(count) && count >= 1 ? count : Math.min(2, maxGuests);
    guests.value = String(Math.min(maxGuests, Math.max(1, from + by)));
    clearProblem();
    syncStepper();
  };
  fewer.addEventListener('click', () => step(-1));
  more.addEventListener('click', () => step(1));
  guests.addEventListener('input', () => {
    clearProblem();
    syncStepper();
  });
  syncStepper();

  const showRange = (): void => {
    openerValue.textContent = range.checkIn ? `${shortDay(range.checkIn)} – ${range.checkOut ? shortDay(range.checkOut) : '…'}` : text.addDates;
  };

  const outside = (event: Event): void => {
    if (!root.contains(event.target as Node)) calendar.close(false);
  };
  const calendar = createCalendar({
    lang,
    text,
    id: `${id}-cal`,
    today: () => todayLocal(),
    months: () => (form.clientWidth >= TWO_MONTHS_FROM ? 2 : 1),
    onPick: (picked, kind) => {
      range.checkIn = picked.checkIn;
      range.checkOut = picked.checkOut;
      showRange();
      clearProblem();
      note.textContent = '';
      if (kind === 'arrival') {
        live.textContent = `${text.arrival} ${longDay(picked.checkIn)}. ${text.chooseDeparture}`;
      } else {
        const nights = nightsBetween(picked.checkIn, picked.checkOut);
        live.textContent = `${text.departure} ${longDay(picked.checkOut)}. ${nights} ${nights === 1 ? text.night : text.nights}.`;
      }
    },
    onSay: (message) => {
      live.textContent = message;
    },
    onClose: (restoreFocus) => {
      opener.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside);
      if (restoreFocus) opener.focus();
    },
  });
  opener.addEventListener('click', () => {
    if (calendar.isOpen()) {
      calendar.close(true);
      return;
    }
    clearProblem();
    opener.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside);
    calendar.open(range);
  });
  root.addEventListener('focusout', (event) => {
    const next = event.relatedTarget as Node | null;
    if (calendar.isOpen() && next && next !== opener && !calendar.contains(next)) calendar.close(false);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearProblem();
    note.textContent = '';
    const stay: Stay = { ...range, guests: readGuests() };
    const problem = findProblem(stay, todayLocal(), maxGuests);
    if (problem) {
      showProblem(problem);
      return;
    }
    const target = resolveTarget(options.target, { base: options.base, org: options.org }, location.href);
    if (!target) {
      problemBox.textContent = text.badTarget;
      return;
    }

    const place = where ? destinations.find((destination) => destination.id === where.value) : undefined;
    try {
      options.emit('search', {
        ...(place ? { search_term: place.label } : {}),
        start_date: stay.checkIn,
        end_date: stay.checkOut,
        number_of_passengers: stay.guests,
      });
    } catch {
      // The search goes on.
    }
    if (options.preview) {
      note.textContent = text.preview;
      return;
    }
    location.assign(buildSearchUrl(target, stay, lang, place?.id ?? '', location.search));
  });

  form.append(whenField, whoField, submit, calendar.element);
  root.append(form, problemBox, note, live);
  return root;
}
