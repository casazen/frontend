import type { LucideIcon } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { QueryClient } from '@tanstack/react-query';
import type { AreaDefinition } from '@/config/areas';
import type { FeatureFlags } from '@/config/feature-flags';
import type { AppContextKey, PermissionPredicate } from '@/config/route-manifest';
import type { AppLocale } from '@/i18n/config';

/**
 * What an item of the palette is (UI-06). Each kind has a group with a heading. The server search (UI-13) brings its own
 * kinds (contracts, tenants, suppliers): they are added here, with their group in `COMMAND_GROUPS`.
 */
export type CommandKind = 'page' | 'action' | 'property' | 'booking' | 'guest';

interface CommandItemBase {
  /**
   * Stable and unique: `page:/app/short-rent/bookings`, `property:<id>`. The recents keep this and nothing else, and look
   * the item up again by it, so it never holds a name or a typed text.
   */
  id: string;
  kind: CommandKind;
  /** What the row says, in the language of the interface. */
  label: string;
  /** The second line: where the item is (the area, the page it hangs from, the property and the dates of a stay). */
  subtitle?: string;
  /** Other words that find the item. They match like the label, a little lower, and are not shown. */
  keywords?: readonly string[];
  icon: LucideIcon;
  /** The area the item belongs to: the items of the area the user is in come first. */
  area?: AppContextKey;
  /** Found by typing, but not offered while nothing is typed: the actions of the account (language, support, sign out). */
  quiet?: boolean;
}

/** An item either leads to a page of the app (`to`, a path with its query) or does something (`run`): never both. */
export type CommandItem = CommandItemBase & ({ to: string; run?: undefined } | { run: () => void; to?: undefined });

/** What a source needs to know about the user and the app to say which items there are. Built once by `useCommandContext`. */
export interface CommandContext {
  t: TFunction;
  locale: AppLocale;
  /** The area of the page that is open. */
  activeArea: AppContextKey;
  /** The areas the user can open, in the order of the area switcher. */
  areas: readonly AreaDefinition[];
  /** The permission test of the menus: the same the sidebar uses. */
  hasPermission: PermissionPredicate;
  flags: Partial<FeatureFlags>;
  getDefaultRoute: (area: AppContextKey) => string;
  /** The cache of the queries the pages already made: the palette reads it and never asks the server for anything. */
  queryClient: QueryClient | null;
  /** The address to write to for help, when the build has one (`config/support.config.ts`). */
  supportEmail: string | null;
  /** The things an action does that are not a page: the sources do not reach for the auth or the language by themselves. */
  actions: {
    changeLocale: (locale: AppLocale) => void;
    signOut: () => void;
    writeToSupport: (email: string) => void;
  };
}

/**
 * A place the items come from. The built-in sources (the menus, the actions, the objects in the cache) and the ones a
 * feature registers (`registerCommands`: a help centre, a page with its own commands) have the same shape, so the palette
 * does not know which is which.
 */
export interface CommandSource {
  /** Unique: registering a second source with the same id replaces the first. */
  id: string;
  getItems: (context: CommandContext) => CommandItem[];
}

/**
 * The hook of the server search (UI-13, `GET /api/search`): an asynchronous source the palette asks for the text typed. It is
 * not there today: nobody passes one, so the palette makes no request of its own. When it is there, the palette waits
 * `debounceMs` after the last key, asks only for `minChars` characters or more, drops the answer that comes too late and
 * cancels the request (`signal`) when the text changes or the palette closes.
 */
export interface RemoteCommandSource {
  /** Wait after the last key before asking, in ms. Default 250. */
  debounceMs?: number;
  /** Do not ask for fewer characters than this. Default 2. */
  minChars?: number;
  search: (query: string, options: { signal: AbortSignal }) => Promise<CommandItem[]>;
}
