import type { RentalMode } from '@/types/property.types';

/** The two sections a property can be in: the mode is exclusive (PM-01), so a property is in one of them. */
export type ModeArea = 'short-rent' | 'long-rent';

/** The list of the properties of every section, for the person who comes from the account (`?from=account`, AM-13). */
export const ACCOUNT_PROPERTIES_PATH = '/app/account/properties';

/** The section of a mode: short stays in Affitti brevi, long-term leases in Affitti lunghi. */
export function areaOfMode(mode: RentalMode): ModeArea {
  return mode === 'Long' ? 'long-rent' : 'short-rent';
}

/** The other mode: a property is in one mode at a time, so a change always goes to it. */
export function oppositeMode(mode: RentalMode): RentalMode {
  return mode === 'Short' ? 'Long' : 'Short';
}

export const propertiesListPath = (area: ModeArea) => `/app/${area}/properties`;

export const propertyDetailPath = (area: ModeArea, id: string) => `/app/${area}/properties/${id}`;

/** Where the person came from when they opened the wizard: the list of the account (AM-13) or the property pages. */
export type ModeEntry = 'account' | 'property';

/** Reads `?from=`: only `account` means something. */
export function entryFromSearch(search: URLSearchParams): ModeEntry {
  return search.get('from') === 'account' ? 'account' : 'property';
}

/** The wizard of a property, without its query: the same page in both sections (the section of the property's mode opens it). */
export const propertyModeBasePath = (area: ModeArea, id: string) => `/app/${area}/properties/${id}/mode`;

/** The wizard of a property: in the section of its mode; `from` is kept so the way out leads back to where it began. */
export function propertyModePath(area: ModeArea, id: string, entry: ModeEntry = 'property'): string {
  return `${propertyModeBasePath(area, id)}${entry === 'account' ? '?from=account' : ''}`;
}

/** Where "Back to the list" leads: the list of the account when that is where the person came from. */
export function listPathFor(area: ModeArea, entry: ModeEntry): string {
  return entry === 'account' ? ACCOUNT_PROPERTIES_PATH : propertiesListPath(area);
}

/** Where "Cancel" leads (and where the person goes after withdrawing a change): back to where they began. */
export function exitPathFor(area: ModeArea, id: string, entry: ModeEntry): string {
  return entry === 'account' ? ACCOUNT_PROPERTIES_PATH : propertyDetailPath(area, id);
}
