import type { TFunction } from 'i18next';
import { leaseOfRow } from '@/features/properties/long-rent/long-rent-property-format';
import { longRentPropertyRows } from '@/features/properties/long-rent/long-rent-property-rows';
import { memberName } from '@/features/team/people-rows';
import { propertyStatus, type LongRentPropertyStatus, type PropertyStatus } from '@/lib/status-dictionary';
import type { LeaseSummary, Property, PropertyMissingItem, RentalMode } from '@/types';
import type { OrgMember, OrgMemberProperties, OrgMemberProperty } from '@/types/org-team.types';

export type AccountPropertyState =
  | { kind: 'property'; status: PropertyStatus }
  | { kind: 'longRentProperty'; status: LongRentPropertyStatus };

export type MissingItem = 'baseData' | 'cin' | 'documents' | 'safety' | 'activationNotConfirmed' | 'photos' | 'calendar' | 'price';

const SERVER_MISSING: Record<string, MissingItem> = {
  base_data: 'baseData',
  cin: 'cin',
  documents: 'documents',
  safety: 'safety',
  activation_not_confirmed: 'activationNotConfirmed',
  photos: 'photos',
  calendar: 'calendar',
};

function serverMissing(items: readonly PropertyMissingItem[], blocking: boolean): MissingItem[] {
  return items
    .filter((item) => item.blocking === blocking && Object.hasOwn(SERVER_MISSING, item.code))
    .map((item) => SERVER_MISSING[item.code]);
}

export interface AccountPropertyRights {
  shortRead: boolean;
  shortWrite: boolean;
  longRead: boolean;
  longWrite: boolean;
}

export interface AccountPropertyRow {
  property: Property;
  mode: RentalMode;
  state: AccountPropertyState | null;
  lease: LeaseSummary | null;
  needsCompleting: boolean;
  missing: MissingItem[];
  advice: MissingItem[];
  responsible: { userId: string; name: string } | null;
  people: number | null;
}

export const modeOf = (property: Pick<Property, 'rentalMode'>): RentalMode => (property.rentalMode === 'Long' ? 'Long' : 'Short');

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

export const missingLabel = (item: MissingItem, t: TFunction): string => t(MISSING_LABELS[item].labelKey);

/** «Manca: CIN, foto»: what the empty fields of the record say, in the words of the person. */
export function missingText(items: readonly MissingItem[], t: TFunction): string {
  return t('accountProperties.list.missing', { items: items.map((item) => missingLabel(item, t)).join(', ') });
}

export interface AccountPropertyRowsInput {
  properties: readonly Property[];
  leases: readonly LeaseSummary[] | undefined;
  members: readonly OrgMember[] | undefined;
  peopleByProperty: ReadonlyMap<string, number> | undefined;
  today: string;
}

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

export function peopleCounts(properties: readonly OrgMemberProperty[]): Map<string, number> {
  return new Map(properties.map((property) => [property.propertyId, property.peopleWithAccess]));
}

export const isLimitedCollaborator = (member: OrgMember): boolean =>
  member.status === 'Active' && member.role === 'Collaborator' && member.propertyScope === 'Selected';

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

export function candidatesFor(
  members: readonly OrgMember[],
  rows: readonly Pick<AccountPropertyRow, 'property' | 'mode'>[],
  grantedByMember: ReadonlyMap<string, ReadonlySet<string>>,
): OrgMember[] {
  return members.filter((member) => rows.every((row) => reachesProperty(member, row, grantedByMember.get(member.id))));
}
