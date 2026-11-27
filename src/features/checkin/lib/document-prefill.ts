import type { CheckInDocumentReadResult, CheckInZonedField } from '@/types/public-checkin.types';

/**
 * The prefill of the data step of the check-in from the local reading of a document (E71/F02/US01/T02, NF-190): the page shows the values the reading gave, each marked as read from the document and
 * editable, and says which data it will still ask for (`missing`), so that the guest confirms what is there and types only what is not.
 *
 * Everything here is a pure function of the answer of `read-document`. The values are personal data of the guest who sent the photo: they live in the state of the step while the guest checks them, are
 * written into the form (memory) when the guest confirms, and are never put in a storage, an address, a log or a request on the way. With the self-hosted flow off the answer has none of the three
 * members (`fields`, `missing`, `source`), `zonedAnswerOf` finds nothing and the data step is the one it always was.
 */

/** The data the step shows for the guest to check: what a document says and the form takes from it. The names are not among them: they come from the booking and are not changed here. */
export const PREFILL_ROWS = ['gender', 'dateOfBirth', 'birthPlace', 'citizenship', 'documentKind', 'documentNumber', 'issuePlace', 'documentIssuedOn', 'documentExpiresOn'] as const;
export type PrefillRowName = (typeof PREFILL_ROWS)[number];

/** How a row is edited: a line of text, a date, one of the two genders of the form, or one of the three kinds of document. */
export const PREFILL_INPUT: Readonly<Record<PrefillRowName, 'text' | 'date' | 'gender' | 'kind'>> = {
  gender: 'gender',
  dateOfBirth: 'date',
  birthPlace: 'text',
  citizenship: 'text',
  documentKind: 'kind',
  documentNumber: 'text',
  issuePlace: 'text',
  documentIssuedOn: 'date',
  documentExpiresOn: 'date',
};

/** The kinds of document the form has (the values of `guest.documentKind`). */
export const PREFILL_DOCUMENT_KINDS = ['IdentityCard', 'Passport', 'DriversLicense'] as const;

/** The name the zones of the card give a row (`ZonedFieldNames` of the server), when there is one: the kind of document and the place of issue have no zone. */
const ZONE_OF_ROW: Readonly<Partial<Record<PrefillRowName, string>>> = {
  gender: 'sex',
  dateOfBirth: 'birthDate',
  birthPlace: 'birthPlace',
  citizenship: 'nationality',
  documentNumber: 'documentNumber',
  documentIssuedOn: 'issueDate',
  documentExpiresOn: 'expiryDate',
};

/** The form of the document the value of a row was read from. */
export type PrefillSource = 'mrz' | 'viz';

/** One value to check: what it is, the value (the guest may change it) and where it was read from (`null` when the answer does not say). */
export interface PrefillRow {
  name: PrefillRowName;
  value: string;
  source: PrefillSource | null;
}

/** What the data step shows after a reading: the values to check and the names of the data the guest will still be asked for. */
export interface DocumentPrefill {
  rows: readonly PrefillRow[];
  /** The data the reading did not give and the form does not hold yet, in the words of the API (`lastName`, `birthPlace`, ...); an unknown name is asked under a general label. */
  missing: readonly string[];
}

/** What the guest left in the rows when they confirmed: the value of each row by its name. */
export type PrefillValues = Partial<Record<PrefillRowName, string>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The zoned part of an answer, or `null` when the answer is the one of before (the flow is off, or the server is older): no `fields`, no `missing`, or a source that is not the local reading. */
export function zonedAnswerOf(result: CheckInDocumentReadResult): { fields: CheckInZonedField[]; missing: string[] } | null {
  if (result.source !== 'local' || !Array.isArray(result.fields) || !Array.isArray(result.missing)) return null;
  const fields = result.fields.filter(
    (field): field is CheckInZonedField => isRecord(field) && typeof field.name === 'string' && typeof field.value === 'string' && field.value.trim() !== '',
  );
  const missing = result.missing.filter((name): name is string => typeof name === 'string' && name !== '');
  return { fields, missing };
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** The first four-digit-year date of a value (`yyyy-MM-dd`, whatever follows the day), or an empty text. */
const dateOf = (value: unknown): string => /^\d{4}-\d{2}-\d{2}/.exec(text(value))?.[0] ?? '';

/**
 * The prefill the data step shows for an answer, or `null` when the answer is the one of before. Each row takes the value the guest's reading gave (`guest`, the shape the form takes) or, when it has
 * none, the value of the zone of the card. `isFilled` says whether the form already holds a data of the guest the photo belongs to (the other photo of the card, or what the guest typed), so that
 * `missing` is what is still to be typed after all the photos, not only after this one. A row the form cannot take (a birth place with no word on whether it is in Italy, a gender that is neither of the two
 * of the form) is not shown as read: it is asked.
 */
export function buildPrefill(result: CheckInDocumentReadResult, isFilled: (name: string) => boolean): DocumentPrefill | null {
  const zoned = zonedAnswerOf(result);
  if (!zoned) return null;

  const guest: NonNullable<CheckInDocumentReadResult['guest']> = result.guest ?? {};
  const zoneValue = (row: PrefillRowName): CheckInZonedField | undefined => {
    const name = ZONE_OF_ROW[row];
    return name ? zoned.fields.find((field) => field.name === name) : undefined;
  };
  const sourceOf = (field: CheckInZonedField | undefined): PrefillSource | null => (field?.source === 'mrz' || field?.source === 'viz' ? field.source : null);

  const valueOf = (row: PrefillRowName): string => {
    const zone = zoneValue(row);
    switch (row) {
      case 'gender': {
        const read = text(guest.gender) || (zone?.value === 'M' ? 'Male' : zone?.value === 'F' ? 'Female' : '');
        return read === 'Male' || read === 'Female' ? read : '';
      }
      case 'dateOfBirth':
        return dateOf(guest.dateOfBirth) || dateOf(zone?.value);
      case 'birthPlace':
        // The form takes a birth place only when it knows whether it is in Italy.
        return typeof guest.bornInItaly === 'boolean' ? text(guest.birthPlace) || text(zone?.value) : '';
      case 'citizenship':
        return text(guest.citizenship);
      case 'documentKind': {
        const kind = text(guest.documentKind);
        return (PREFILL_DOCUMENT_KINDS as readonly string[]).includes(kind) ? kind : '';
      }
      case 'documentNumber':
        return text(guest.documentNumber) || text(zone?.value);
      case 'issuePlace':
        return text(guest.issuePlace);
      case 'documentIssuedOn':
        return dateOf(guest.documentIssuedOn) || dateOf(zone?.value);
      case 'documentExpiresOn':
        return dateOf(guest.documentExpiresOn) || dateOf(zone?.value);
    }
  };

  const rows: PrefillRow[] = [];
  for (const name of PREFILL_ROWS) {
    const value = valueOf(name);
    if (value !== '') rows.push({ name, value, source: sourceOf(zoneValue(name)) });
  }

  // What the zones gave and the form cannot take is asked like what they did not give.
  const shown = new Set<string>(rows.map((row) => row.name));
  const notTaken = PREFILL_ROWS.filter((name) => !shown.has(name) && zoneValue(name) !== undefined);
  const missing = [...new Set([...zoned.missing, ...notTaken])].filter((name) => !shown.has(name) && !isFilled(name));

  return { rows, missing };
}

/**
 * The answer with the values the guest confirmed in place of the ones the reading gave: the page applies it to the form the way it applies any reading. A value the guest cleared is left out (an empty
 * value never overwrites what the form holds), and the rest of the answer (who the photo belongs to, the residence, the side) is untouched.
 */
export function withConfirmedValues(result: CheckInDocumentReadResult, values: PrefillValues): CheckInDocumentReadResult {
  const guest: NonNullable<CheckInDocumentReadResult['guest']> = { ...result.guest };
  for (const name of PREFILL_ROWS) {
    const value = values[name];
    if (value === undefined) continue;
    const confirmed = value.trim() === '' ? null : value.trim();
    switch (name) {
      case 'gender':
        guest.gender = confirmed;
        break;
      case 'dateOfBirth':
        guest.dateOfBirth = confirmed;
        break;
      case 'birthPlace':
        guest.birthPlace = confirmed;
        break;
      case 'citizenship':
        guest.citizenship = confirmed;
        break;
      case 'documentKind':
        guest.documentKind = confirmed;
        break;
      case 'documentNumber':
        guest.documentNumber = confirmed;
        break;
      case 'issuePlace':
        guest.issuePlace = confirmed;
        break;
      case 'documentIssuedOn':
        guest.documentIssuedOn = confirmed;
        break;
      case 'documentExpiresOn':
        guest.documentExpiresOn = confirmed;
        break;
    }
  }
  return { ...result, guest };
}

/** The key of the label of a datum of the prefill, or of the general one for a name the page does not know. */
export function prefillFieldKey(name: string): string {
  const known = [...PREFILL_ROWS, 'lastName', 'firstName'] as readonly string[];
  return known.includes(name) ? `checkin.prefill.field.${name}` : 'checkin.prefill.field.other';
}
