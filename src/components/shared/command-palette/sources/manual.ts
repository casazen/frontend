import { MANUAL_TYPE_ICONS } from '@/lib/manual/manual-icons';
import { searchManual, type ManualHit } from '@/lib/manual/manual-search';
import type { CommandItem, RemoteCommandSource } from '../types';

function manualItem(hit: ManualHit): CommandItem {
  return {
    id: `guide:${hit.type}:${hit.id}`,
    kind: 'guide',
    label: hit.title,
    subtitle: hit.chapter,
    icon: MANUAL_TYPE_ICONS[hit.type],
    run: () => {
      window.open(hit.href, '_blank', 'noopener,noreferrer');
    },
  };
}

export const manualSource: RemoteCommandSource = {
  debounceMs: 200,
  search: async (query) => (await searchManual(query, 5)).map(manualItem),
};
