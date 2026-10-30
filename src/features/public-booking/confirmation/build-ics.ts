/**
 * The calendar file of a stay (DB-06b): pure functions, no browser and no network, so that a table of cases can hold them.
 *
 * - An all-day event from the day of the arrival to the day of the departure (a calendar draws the end day as the first one
 *   without the stay), so there is no time zone to get wrong.
 * - A `UID` made from the booking code: importing the file twice updates the event, it does not double it.
 * - **Never the exact address.** The place of the event is the zone or the city, whatever the host wrote in the instructions.
 * - Text escaped and lines folded as RFC 5545 asks (commas, semicolons, backslashes and new lines; 75 octets; CRLF).
 *
 * The links to Google Calendar and to Outlook carry the same title, days and place and nothing else: no code, no name, no email.
 */

export interface CalendarStay {
  /** `XXXXX-XXXXX`: the `UID` of the event is made from it. */
  code: string;
  title: string;
  /** The zone or the city. Never a street and a number. */
  place: string;
  /** Lines of text for the notes of the event, in the language of the guest. */
  notes: string[];
  /** `YYYY-MM-DD`. */
  checkIn: string;
  /** `YYYY-MM-DD`: the day the guest leaves. */
  checkOut: string;
  /** The host name of the site the file comes from, which ends the `UID`; no CasaZen domain is written in the frontend (D3). */
  uidHost?: string;
}

const STAY_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_LINE_OCTETS = 75;
/** Without a site to name, the reserved top-level domain keeps the `UID` well formed (RFC 2606). */
const UID_FALLBACK_HOST = 'booking.invalid';

/** `20261024` of `2026-10-24`, or null when the text is not a stay date. */
function compactDate(date: string): string | null {
  const match = STAY_DATE.exec(date);
  return match ? `${match[1]}${match[2]}${match[3]}` : null;
}

/** The days of a stay as the formats of the calendars want them, or null when they are not two days in order. */
function stayDays(stay: Pick<CalendarStay, 'checkIn' | 'checkOut'>): { start: string; end: string } | null {
  const start = compactDate(stay.checkIn);
  const end = compactDate(stay.checkOut);
  return start && end && end > start ? { start, end } : null;
}

/** A text value of the file: backslash, semicolon, comma and every kind of new line, as RFC 5545 §3.3.11 writes them. */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

const encoder = new TextEncoder();

/**
 * A content line of at most 75 octets, longer ones folded: CRLF and one space, which counts as an octet of the next line. The cut is
 * between characters (code points), never inside a multi-byte one.
 */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) return line;

  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const octets = encoder.encode(char).length;
    const room = parts.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (size + octets > room) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += octets;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** `20261024T090000Z`: an instant in UTC, without separators and without milliseconds. */
function utcStamp(instant: Date): string {
  return instant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** The `UID` of the event: the same for the same booking, whatever the day it is downloaded. */
function eventUid(stay: CalendarStay, days: { start: string; end: string }): string {
  const code = stay.code.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  return `${code || `${days.start}-${days.end}`}@${stay.uidHost?.trim() || UID_FALLBACK_HOST}`;
}

/**
 * The `.ics` file of the stay, or an empty string when the days are not two days in order (the page then has nothing to offer).
 * `stamp` is the moment of writing (`DTSTAMP`); the caller gives it so that the function stays pure.
 */
export function buildIcs(stay: CalendarStay, stamp: Date): string {
  const days = stayDays(stay);
  if (!days) return '';

  const place = stay.place.trim();
  const notes = stay.notes.map((line) => line.trim()).filter(Boolean);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CasaZen//Booking site//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${eventUid(stay, days)}`,
    `DTSTAMP:${utcStamp(stamp)}`,
    `DTSTART;VALUE=DATE:${days.start}`,
    `DTEND;VALUE=DATE:${days.end}`,
    `SUMMARY:${escapeIcsText(stay.title)}`,
    ...(place ? [`LOCATION:${escapeIcsText(place)}`] : []),
    ...(notes.length > 0 ? [`DESCRIPTION:${escapeIcsText(notes.join('\n'))}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/** The page of Google Calendar that adds the stay, with the title, the days and the place; empty when there are no days. */
export function googleCalendarUrl(stay: Pick<CalendarStay, 'title' | 'place' | 'checkIn' | 'checkOut'>): string {
  const days = stayDays(stay);
  if (!days) return '';
  const query = new URLSearchParams({ action: 'TEMPLATE', text: stay.title, dates: `${days.start}/${days.end}` });
  if (stay.place.trim()) query.set('location', stay.place.trim());
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

/** The page of Outlook.com that adds the stay, with the title, the days and the place; empty when there are no days. */
export function outlookCalendarUrl(stay: Pick<CalendarStay, 'title' | 'place' | 'checkIn' | 'checkOut'>): string {
  const days = stayDays(stay);
  if (!days) return '';
  const query = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: stay.title,
    startdt: stay.checkIn,
    enddt: stay.checkOut,
    allday: 'true',
  });
  if (stay.place.trim()) query.set('location', stay.place.trim());
  return `https://outlook.live.com/calendar/0/deeplink/compose?${query.toString()}`;
}
