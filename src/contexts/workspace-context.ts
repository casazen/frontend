import { createContext } from 'react';
import type { AppContextKey } from '@/config/route-manifest';
import type { ContextBootstrapDto } from '@/api/contexts';

export const ACTIVE_CONTEXT_STORAGE_KEY = 'casazen:active-context';
export const LEGACY_ACTIVE_LAYER_STORAGE_KEY = 'casazen:active-layer';

export interface WorkspaceContextValue {
  contexts: ContextBootstrapDto[];
  activeContext: AppContextKey | null;
  isReady: boolean;
  setActiveContext: (contextKey: AppContextKey, navigateToDefault?: boolean) => void;
  hasPermission: (contextKey: AppContextKey, permission: string) => boolean;
  getDefaultRoute: (contextKey: AppContextKey) => string;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);
