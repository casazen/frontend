import type { AlloggiatiCodeEntryDto, AlloggiatiCodeList, AlloggiatiCodeTable } from '@/types/public-checkin.types';

/** How the forms reach the official Alloggiati tables: guest portal (by token) or host (authenticated). */
export interface CodeTableSource {
  /** Scope of the query cache (e.g. the portal token, or `host`). */
  scope: string;
  /** Tables imported by an admin: only these offer codes. */
  availableTables: readonly AlloggiatiCodeTable[];
  search: (list: AlloggiatiCodeList, query: string) => Promise<AlloggiatiCodeEntryDto[]>;
}

const LIST_TABLES: Record<AlloggiatiCodeList, AlloggiatiCodeTable[]> = {
  comuni: ['Comuni'],
  stati: ['Stati'],
  documenti: ['Documenti'],
  luoghi: ['Comuni', 'Stati'],
};

/** True when at least one table of the list has been imported. */
export function isListAvailable(source: CodeTableSource, list: AlloggiatiCodeList): boolean {
  return LIST_TABLES[list].some((table) => source.availableTables.includes(table));
}

/** Text shown for an entry: description, plus the province for a comune. */
export function codeEntryLabel(entry: AlloggiatiCodeEntryDto): string {
  return entry.province ? `${entry.description} (${entry.province})` : entry.description;
}

export interface CodeTableValue {
  name: string;
  code: string | null;
  province?: string | null;
}
