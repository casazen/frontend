import { useMemo } from 'react';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { useAlloggiatiGuestSummary } from '@/queries/use-alloggiati';
import type { CodeTableSource } from '@/features/checkin/components/code-table';
import type { AlloggiatiCodeTable } from '@/types/public-checkin.types';

const ALL_TABLES: AlloggiatiCodeTable[] = ['Comuni', 'Stati', 'Documenti', 'TipiAlloggiato'];

/**
 * How the forms of the host reach the official Alloggiati tables: the tables an admin imported offer their codes, the others leave the
 * field as a name only (the summary of the guests says which are missing). While the summary loads, or if it fails, no table is offered. The summary holds the
 * data of every guest: an editor in a layer that goes away passes `gcTime: 0`, so that it is not kept once the layer is closed.
 */
export function useHostCodeSource(bookingId: string, options?: { gcTime?: number }): CodeTableSource {
  const summary = useAlloggiatiGuestSummary(bookingId, options);
  const missing = summary.data?.missingCodeTables;

  return useMemo<CodeTableSource>(
    () => ({
      scope: 'host',
      availableTables: missing ? ALL_TABLES.filter((table) => !missing.includes(table)) : [],
      search: (list, query) => alloggiatiApi.searchCodes(list, query),
    }),
    [missing],
  );
}
