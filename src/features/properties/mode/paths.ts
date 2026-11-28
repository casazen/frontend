import type { RentalMode } from '@/types/property.types';

export type ModeArea = 'short-rent' | 'long-rent';

export const ACCOUNT_PROPERTIES_PATH = '/app/account/properties';

export function areaOfMode(mode: RentalMode): ModeArea {
  return mode === 'Long' ? 'long-rent' : 'short-rent';
}

export function oppositeMode(mode: RentalMode): RentalMode {
  return mode === 'Short' ? 'Long' : 'Short';
}

export const propertiesListPath = (area: ModeArea) => `/app/${area}/properties`;

export const propertyDetailPath = (area: ModeArea, id: string) => `/app/${area}/properties/${id}`;

export type ModeEntry = 'account' | 'property';

export function entryFromSearch(search: URLSearchParams): ModeEntry {
  return search.get('from') === 'account' ? 'account' : 'property';
}

export const propertyModeBasePath = (area: ModeArea, id: string) => `/app/${area}/properties/${id}/mode`;

export function propertyModePath(area: ModeArea, id: string, entry: ModeEntry = 'property'): string {
  return `${propertyModeBasePath(area, id)}${entry === 'account' ? '?from=account' : ''}`;
}

export function listPathFor(area: ModeArea, entry: ModeEntry): string {
  return entry === 'account' ? ACCOUNT_PROPERTIES_PATH : propertiesListPath(area);
}

export function exitPathFor(area: ModeArea, id: string, entry: ModeEntry): string {
  return entry === 'account' ? ACCOUNT_PROPERTIES_PATH : propertyDetailPath(area, id);
}
