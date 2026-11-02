/**
 * A calendar file (iCalendar, RFC 5545) for one appointment, made in the browser: nothing is sent to a server. A pure function: the same
 * event and the same `now` give the same text. The page only ever puts in the comune, never the street, the floor or the notes for the
 * access (see `icsEventOf` in `request-view.ts`).
 */
export interface IcsEvent {
  /** Stable, so that adding the same appointment twice updates it instead of doubling it. */
  uid: string;
  startUtc: string;
  endUtc: string;
  summary: string;
  location: string;
  description: string;
}

const CRLF = '\r\n';
/** A line is at most 75 octets, the continuation lines begin with a space (RFC 5545 §3.1). */
const MAX_OCTETS = 75;

/** An instant as the file writes it: `20261105T080000Z`. Empty for something that is not a date. */
function stamp(instant: string | Date): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** A text value: backslash, semicolon, comma and line breaks escaped. */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/** A content line folded at 75 octets (not in the middle of a character). */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (octets + size > MAX_OCTETS) {
      parts.push(current);
      current = ' ';
      octets = 1;
    }
    current += character;
    octets += size;
  }
  parts.push(current);
  return parts.join(CRLF);
}

/** The file for the appointment; an empty string when its times are not dates, so the page offers nothing rather than a broken file. */
export function buildIcs(event: IcsEvent, now: Date): string {
  const start = stamp(event.startUtc);
  const end = stamp(event.endUtc);
  if (!start || !end) return '';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CasaZen//Supplier booking//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join(CRLF) + CRLF;
}
