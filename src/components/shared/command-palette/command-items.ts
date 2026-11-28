import { actionsSource } from './sources/actions';
import { navigationSource } from './sources/navigation';
import { objectsSource } from './sources/objects';
import type { CommandContext, CommandItem, CommandSource } from './types';

const BUILT_IN_SOURCES: readonly CommandSource[] = [navigationSource, actionsSource, objectsSource];

export function buildCommandItems(context: CommandContext, registered: readonly CommandSource[] = []): CommandItem[] {
  const seen = new Set<string>();
  const items: CommandItem[] = [];
  for (const source of [...BUILT_IN_SOURCES, ...registered]) {
    let produced: CommandItem[];
    try {
      produced = source.getItems(context);
    } catch (error) {
      console.warn(`[CommandPalette] The source "${source.id}" failed and was left out`, error);
      continue;
    }
    for (const item of produced) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}
