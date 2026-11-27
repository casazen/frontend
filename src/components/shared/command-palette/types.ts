import type { LucideIcon } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { QueryClient } from '@tanstack/react-query';
import type { AreaDefinition } from '@/config/areas';
import type { FeatureFlags } from '@/config/feature-flags';
import type { AppContextKey, PermissionPredicate } from '@/config/route-manifest';
import type { AppLocale } from '@/i18n/config';

export type CommandKind = 'page' | 'action' | 'property' | 'booking' | 'guest';

interface CommandItemBase {
  id: string;
  kind: CommandKind;
  label: string;
  subtitle?: string;
  keywords?: readonly string[];
  icon: LucideIcon;
  area?: AppContextKey;
  quiet?: boolean;
}

export type CommandItem = CommandItemBase & ({ to: string; run?: undefined } | { run: () => void; to?: undefined });

export interface CommandContext {
  t: TFunction;
  locale: AppLocale;
  activeArea: AppContextKey;
  areas: readonly AreaDefinition[];
  hasPermission: PermissionPredicate;
  canOpenPath?: (path: string) => boolean;
  flags: Partial<FeatureFlags>;
  getDefaultRoute: (area: AppContextKey) => string;
  queryClient: QueryClient | null;
  supportEmail: string | null;
  actions: {
    changeLocale: (locale: AppLocale) => void;
    signOut: () => void;
    writeToSupport: (email: string) => void;
  };
}

export interface CommandSource {
  id: string;
  getItems: (context: CommandContext) => CommandItem[];
}

export interface RemoteCommandSource {
  debounceMs?: number;
  minChars?: number;
  search: (query: string, options: { signal: AbortSignal }) => Promise<CommandItem[]>;
}
