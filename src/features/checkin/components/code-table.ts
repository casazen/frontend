import type { AlloggiatiCodeEntryDto, AlloggiatiCodeList, AlloggiatiCodeTable } from '@/types/public-checkin.types';

/** How the forms reach the official Alloggiati tables: guest portal (by token) or host (authenticated). */
export interface CodeTableSource {
  scope: string;
  availableTables: readonly AlloggiatiCodeTable[];
  search: (list: AlloggiatiCodeList, query: string) => Promise<AlloggiatiCodeEntryDto[]>;
}

const LIST_TABLES: Record<AlloggiatiCodeList, AlloggiatiCodeTable[]> = {
  comuni: ['Comuni'],
  stati: ['Stati'],
  documenti: ['Documenti'],
  luoghi: ['Comuni', 'Stati'],
};

export function isListAvailable(source: CodeTableSource, list: AlloggiatiCodeList): boolean {
  return LIST_TABLES[list].some((table) => source.availableTables.includes(table));
}

export function codeEntryLabel(entry: AlloggiatiCodeEntryDto, purpose: 'place' | 'citizenship' = 'place'): string {
  if (purpose === 'citizenship') return entry.citizenshipLabel || entry.description;
  return entry.province ? `${entry.description} (${entry.province})` : entry.description;
}

export interface CodeTableValue {
  name: string;
  code: string | null;
  province?: string | null;
}
