import { describe, expect, it } from 'vitest';
import { buildIcs, escapeIcsText, foldIcsLine, googleCalendarUrl, outlookCalendarUrl, type CalendarStay } from '../build-ics';

const STAMP = new Date('2026-09-24T09:15:30.123Z');

const stay: CalendarStay = {
  code: 'K7M4Q-9XP2H',
  title: 'Soggiorno · Trastevere Suite',
  place: 'Trastevere, Roma',
  notes: ['Trastevere Suite', 'Codice prenotazione K7M4Q-9XP2H', 'Arrivo dalle 15:00'],
  checkIn: '2026-10-24',
  checkOut: '2026-10-27',
};

/** The physical lines of the file as a calendar program reads them back: the folds are undone. */
function unfold(file: string): string[] {
  return file.replace(/\r\n[ \t]/g, '').split('\r\n').filter(Boolean);
}

const octets = (text: string) => new TextEncoder().encode(text).length;

describe('escapeIcsText', () => {
  it.each([
    ['a, b', 'a\\, b'],
    ['a; b', 'a\\; b'],
    ['C:\\temp', 'C:\\\\temp'],
    ['one\ntwo', 'one\\ntwo'],
    ['one\r\ntwo', 'one\\ntwo'],
    ['plain', 'plain'],
  ])('escapeIcsText_%j_Gives%j', (input, expected) => {
    expect(escapeIcsText(input)).toBe(expected);
  });
});

describe('foldIcsLine', () => {
  it('foldIcsLine_ShortLine_IsLeftAlone', () => {
    expect(foldIcsLine('SUMMARY:Casa')).toBe('SUMMARY:Casa');
  });

  it('foldIcsLine_LongAsciiLine_NeverPassesSeventyFiveOctetsAndUnfoldsToTheOriginal', () => {
    const line = `DESCRIPTION:${'abcdefghij'.repeat(30)}`;

    const folded = foldIcsLine(line);

    for (const physical of folded.split('\r\n')) expect(octets(physical)).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').slice(1).every((physical) => physical.startsWith(' '))).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });

  it('foldIcsLine_MultiByteCharacters_AreNeverCutInTheMiddle', () => {
    const line = `SUMMARY:${'è'.repeat(80)}`;

    const folded = foldIcsLine(line);

    for (const physical of folded.split('\r\n')) expect(octets(physical)).toBeLessThanOrEqual(75);
    // A cut inside a character would leave a replacement character when the file is read back.
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });
});

describe('buildIcs', () => {
  it('buildIcs_Stay_IsAnAllDayEventFromTheArrivalToTheDepartureWithCrlfOnly', () => {
    const file = buildIcs(stay, STAMP);

    expect(file.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(file.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(/(?<!\r)\n/.test(file)).toBe(false);
    const lines = unfold(file);
    expect(lines).toContain('DTSTART;VALUE=DATE:20261024');
    expect(lines).toContain('DTEND;VALUE=DATE:20261027');
    expect(lines).toContain('DTSTAMP:20260924T091530Z');
    expect(lines).toContain('SUMMARY:Soggiorno · Trastevere Suite');
    expect(lines).toContain('LOCATION:Trastevere\\, Roma');
  });

  it('buildIcs_SameBookingOnAnotherDay_KeepsTheUidSoTheImportUpdatesTheEvent', () => {
    const first = unfold(buildIcs(stay, STAMP)).find((line) => line.startsWith('UID:'));
    const second = unfold(buildIcs(stay, new Date('2026-10-02T18:00:00Z'))).find((line) => line.startsWith('UID:'));

    expect(first).toBe('UID:k7m4q9xp2h@casazen.app');
    expect(second).toBe(first);
  });

  it('buildIcs_Notes_AreOneEscapedDescriptionAndNoStreetIsEverAdded', () => {
    const file = buildIcs(stay, STAMP);

    const description = unfold(file).find((line) => line.startsWith('DESCRIPTION:')) ?? '';
    expect(description).toBe('DESCRIPTION:Trastevere Suite\\nCodice prenotazione K7M4Q-9XP2H\\nArrivo dalle 15:00');
    // The place is what the caller gave, and nothing else: the file has no field for an address.
    expect(file).not.toMatch(/GEO:|X-APPLE-STRUCTURED-LOCATION/);
  });

  it('buildIcs_NoPlaceNoNotes_LeavesOutLocationAndDescription', () => {
    const file = buildIcs({ ...stay, place: '  ', notes: ['', '  '] }, STAMP);

    expect(file).not.toContain('LOCATION');
    expect(file).not.toContain('DESCRIPTION');
  });

  it('buildIcs_SpecialCharactersInTheTitle_AreEscapedAndLongLinesFolded', () => {
    const file = buildIcs({ ...stay, title: `Casa; Mare, Sole\\${'x'.repeat(100)}` }, STAMP);

    for (const physical of file.split('\r\n')) expect(octets(physical)).toBeLessThanOrEqual(75);
    expect(unfold(file).find((line) => line.startsWith('SUMMARY:'))).toBe(`SUMMARY:Casa\\; Mare\\, Sole\\\\${'x'.repeat(100)}`);
  });

  it.each([
    ['2026-10-27', '2026-10-24'],
    ['2026-10-24', '2026-10-24'],
    ['', '2026-10-24'],
    ['24/10/2026', '27/10/2026'],
  ])('buildIcs_Days%jTo%j_GivesNoFile', (checkIn, checkOut) => {
    expect(buildIcs({ ...stay, checkIn, checkOut }, STAMP)).toBe('');
  });
});

describe('calendar links', () => {
  it('googleCalendarUrl_Stay_CarriesTheTitleTheDaysAndThePlaceOnly', () => {
    const url = new URL(googleCalendarUrl(stay));

    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe(stay.title);
    expect(url.searchParams.get('dates')).toBe('20261024/20261027');
    expect(url.searchParams.get('location')).toBe('Trastevere, Roma');
    expect([...url.searchParams.keys()].sort()).toEqual(['action', 'dates', 'location', 'text']);
  });

  it('outlookCalendarUrl_Stay_CarriesTheTitleTheDaysAndThePlaceOnly', () => {
    const url = new URL(outlookCalendarUrl(stay));

    expect(url.origin + url.pathname).toBe('https://outlook.live.com/calendar/0/deeplink/compose');
    expect(url.searchParams.get('subject')).toBe(stay.title);
    expect(url.searchParams.get('startdt')).toBe('2026-10-24');
    expect(url.searchParams.get('enddt')).toBe('2026-10-27');
    expect(url.searchParams.get('allday')).toBe('true');
    expect(url.searchParams.get('location')).toBe('Trastevere, Roma');
  });

  it('calendarLinks_Stay_NeverCarryTheBookingCode', () => {
    // The code and the email of the booking open it in the guest area: they stay out of an address another service receives.
    expect(googleCalendarUrl(stay)).not.toContain('K7M4Q');
    expect(outlookCalendarUrl(stay)).not.toContain('K7M4Q');
  });

  it('calendarLinks_NoDays_GiveNoLink', () => {
    expect(googleCalendarUrl({ ...stay, checkOut: '' })).toBe('');
    expect(outlookCalendarUrl({ ...stay, checkOut: '' })).toBe('');
  });
});
