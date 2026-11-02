import type { TFunction } from 'i18next';
import { leaseOfRow } from '@/features/properties/long-rent/long-rent-property-format';
import { longRentPropertyRows } from '@/features/properties/long-rent/long-rent-property-rows';
import { memberName } from '@/features/team/people-rows';
import { propertyStatus, type LongRentPropertyStatus, type PropertyStatus } from '@/lib/status-dictionary';
import type { LeaseSummary, Property, PropertyMissingItem, RentalMode } from '@/types';
import type { OrgMember, OrgMemberProperties, OrgMemberProperty } from '@/types/org-team.types';

/** What the person sees of a property: the state of a short-term one, or whether a long-term one is let. */
export type AccountPropertyState =
  | { kind: 'property'; status: PropertyStatus }
  | { kind: 'longRentProperty'; status: LongRentPropertyStatus };

/**
 * What a short-term property still lacks. The server says it (`missing` of the list asked with `?view=overview`, SR-07a: the rules of the
 * activation wizard, worked out once, there); only an answer without it (an older backend) is read from the empty fields of the record.
 */
export type MissingItem = 'baseData' | 'cin' | 'documents' | 'safety' | 'activationNotConfirmed' | 'photos' | 'calendar' | 'price';

/** The codes the server sends (`PropertyMissingCodes`) and the item each one is; a code this version does not know is left out, never shown as it is. */
const SERVER_MISSING: Record<string, MissingItem> = {
  base_data: 'baseData',
  cin: 'cin',
  documents: 'documents',
  safety: 'safety',
  activation_not_confirmed: 'activationNotConfirmed',
  photos: 'photos',
  calendar: 'calendar',
};

/** The things the server says a property lacks that block its activation (`blocking`) or only advise (`!blocking`), in its order. */
function serverMissing(items: readonly PropertyMissingItem[], blocking: boolean): MissingItem[] {
  return items
    .filter((item) => item.blocking === blocking && Object.hasOwn(SERVER_MISSING, item.code))
    .map((item) => SERVER_MISSING[item.code]);
}

/** What the person may do in each area (`hasPermission` of the workspace, read once): who may open, who may change. */
export interface AccountPropertyRights {
  shortRead: boolean;
  shortWrite: boolean;
  longRead: boolean;
  longWrite: boolean;
}

/** A property of the account, with what the list says about it. */
export interface AccountPropertyRow {
  property: Property;
  mode: RentalMode;
  /** `null` for a long-term property whose leases are not known: then nothing is said of it. */
  state: AccountPropertyState | null;
  /** A long-term property: the lease that holds it, or the one being prepared. */
  lease: LeaseSummary | null;
  /** A short-term property that cannot receive bookings yet (to complete, or suspended). */
  needsCompleting: boolean;
  /** What blocks a short-term property that cannot work yet, for the list and the drawer. */
  missing: MissingItem[];
  /** What the server only advises (the photos, the calendar); the drawer says it, the list does not. */
  advice: MissingItem[];
  /** The member in charge, by name. `null`: nobody (also a member who is gone: the name goes back to nobody when the access ends). */
  responsible: { userId: string; name: string } | null;
  /** How many active people reach the property; `null` while the backend has not said. */
  people: number | null;
}

/** The mode of a record; an older answer without it is a short-term property, as every property was. */
export const modeOf = (property: Pick<Property, 'rentalMode'>): RentalMode => (property.rentalMode === 'Long' ? 'Long' : 'Short');

/** The area of a mode: where its properties are worked. */
export const areaKeyOf = (mode: RentalMode) => (mode === 'Long' ? ('long-rent' as const) : ('short-rent' as const));

/** The fallback of an answer without `missing`: the CIN, the photos and the price of the night that are empty on the record (the documents and the calendar are not on it). */
export function missingOf(property: Pick<Property, 'cinCode' | 'photoUrls' | 'nightlyRate'>): MissingItem[] {
  const items: MissingItem[] = [];
  if (!property.cinCode?.trim()) items.push('cin');
  if (!property.photoUrls?.length) items.push('photos');
  if (!(property.nightlyRate > 0)) items.push('price');
  return items;
}

// The keys are written out (`*Key:` properties) so that the i18n test finds a missing translation.
const MISSING_LABELS: Record<MissingItem, { labelKey: string }> = {
  baseData: { labelKey: 'accountProperties.missing.baseData' },
  cin: { labelKey: 'accountProperties.missing.cin' },
  documents: { labelKey: 'accountProperties.missing.documents' },
  safety: { labelKey: 'accountProperties.missing.safety' },
  activationNotConfirmed: { labelKey: 'accountProperties.missing.activationNotConfirmed' },
  photos: { labelKey: 'accountProperties.missing.photos' },
  calendar: { labelKey: 'accountProperties.missing.calendar' },
  price: { labelKey: 'accountProperties.missing.price' },
};

/** The name of one thing a property lacks: «CIN», «foto», «prezzo». */
export const missingLabel = (item: MissingItem, t: TFunction): string => t(MISSING_LABELS[item].labelKey);

/** «Manca: CIN, foto»: what the empty fields of the record say, in the words of the person. */
export function missingText(items: readonly MissingItem[], t: TFunction): string {
  return t('accountProperties.list.missing', { items: items.map((item) => missingLabel(item, t)).join(', ') });
}

export interface AccountPropertyRowsInput {
  properties: readonly Property[];
  /** `undefined` when the leases are not known (the person may not read them, or they did not load). */
  leases: readonly LeaseSummary[] | undefined;
  /** `undefined` when the members did not load: then nobody is named as in charge. */
  members: readonly OrgMember[] | undefined;
  /** How many people reach each property (`GET /orgs/me/members/{id}/properties`); `undefined` while it is not known. */
  peopleByProperty: ReadonlyMap<string, number> | undefined;
  /** Today in Europe/Rome (`YYYY-MM-DD`): a lease that ended yesterday does not hold the property. */
  today: string;
}

/**
 * The properties of the account in one list: short-term ones with the state the host sees (`propertyStatus`), long-term ones as
 * let or free from their leases (the same rule as the list of Affitti lunghi), and for each the person in charge and how many
 * people reach it.
 */
export function accountPropertyRows({ properties, leases, members, peopleByProperty, today }: AccountPropertyRowsInput): AccountPropertyRow[] {
  const longRows = new Map(
    longRentPropertyRows(
      properties.filter((property) => modeOf(property) === 'Long'),
      leases,
      today,
    ).map((row) => [row.property.id, row]),
  );
  const nameOf = members ? new Map(members.map((member) => [member.userId, memberName(member)])) : undefined;

  return properties.map((property) => {
    const mode = modeOf(property);
    const longRow = longRows.get(property.id);
    const status = propertyStatus(property);
    const needsCompleting = mode === 'Short' && (status === 'Pending' || status === 'Suspended');
    // The server's own list when it sends one (only for a short-term property); the empty fields of the record otherwise.
    const told = mode === 'Short' ? property.missing : undefined;
    const state: AccountPropertyState | null =
      mode === 'Short' ? { kind: 'property', status } : longRow?.status ? { kind: 'longRentProperty', status: longRow.status } : null;
    const responsibleName = property.responsibleUserId ? nameOf?.get(property.responsibleUserId) : undefined;

    return {
      property,
      mode,
      state,
      lease: longRow ? leaseOfRow(longRow) : null,
      needsCompleting,
      missing: needsCompleting ? (told ? serverMissing(told, true) : missingOf(property)) : [],
      advice: told ? serverMissing(told, false) : [],
      responsible: property.responsibleUserId && responsibleName ? { userId: property.responsibleUserId, name: responsibleName } : null,
      people: peopleByProperty?.get(property.id) ?? null,
    };
  });
}

/**
 * Who can open each property, from the one answer of `GET /orgs/me/members/{id}/properties` (it counts the people of the whole org,
 * so any member will do).
 */
export function peopleCounts(properties: readonly OrgMemberProperty[]): Map<string, number> {
  return new Map(properties.map((property) => [property.propertyId, property.peopleWithAccess]));
}

/** A collaborator limited to some properties: the only member whose reach has to be asked, one by one. */
export const isLimitedCollaborator = (member: OrgMember): boolean =>
  member.status === 'Active' && member.role === 'Collaborator' && member.propertyScope === 'Selected';

/** The ids of the properties a limited member was given, from its own page of access. */
export function grantedIds(access: Pick<OrgMemberProperties, 'properties'> | undefined): ReadonlySet<string> | undefined {
  return access ? new Set(access.properties.filter((property) => property.granted).map((property) => property.propertyId)) : undefined;
}

/**
 * Whether an active member reaches a property: every property, unless it is a collaborator «Solo alcuni», who reaches the ones it
 * was given (`granted`) while it works in an area of their mode. It is the rule of the backend (`OrgPropertyAccessService`): a
 * person put in charge who does not pass it is refused with a 422, so only the ones who pass are offered.
 */
export function reachesProperty(member: OrgMember, row: Pick<AccountPropertyRow, 'property' | 'mode'>, granted: ReadonlySet<string> | undefined): boolean {
  if (member.status !== 'Active') return false;
  if (!isLimitedCollaborator(member)) return true;

  const areas = new Set(member.areas.filter((area) => area === 'short-rent' || area === 'long-rent'));
  const inItsAreas = areas.size !== 1 || areas.has(areaKeyOf(row.mode));
  return inItsAreas && (granted?.has(row.property.id) ?? false);
}

/** The members who reach every one of the properties: the ones that can be put in charge of them all. */
export function candidatesFor(
  members: readonly OrgMember[],
  rows: readonly Pick<AccountPropertyRow, 'property' | 'mode'>[],
  grantedByMember: ReadonlyMap<string, ReadonlySet<string>>,
): OrgMember[] {
  return members.filter((member) => rows.every((row) => reachesProperty(member, row, grantedByMember.get(member.id))));
}
