import { actionsSource } from './sources/actions';
import { navigationSource } from './sources/navigation';
import { objectsSource } from './sources/objects';
import type { CommandContext, CommandItem, CommandSource } from './types';

/** The sources the palette has by itself; the ones a feature registers (`registerCommands`) come after them. */
const BUILT_IN_SOURCES: readonly CommandSource[] = [navigationSource, actionsSource, objectsSource];

/**
 * Every item the palette can show to this user right now, from all the sources: first the menus, then the actions, then the
 * objects in the cache, then what the features registered. An id that comes twice shows once (the first wins). A source that
 * fails is left out and says so in the console, without the text anyone typed; the palette does not break for it.
 */
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
