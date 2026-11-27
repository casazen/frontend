import { createContext, useContext } from 'react';
import type { AppContextKey } from '@/config/route-manifest';

export interface AppShellContextValue {
  contextKey: AppContextKey;
  viewKey?: string;
}

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell(): AppShellContextValue | null {
  return useContext(AppShellContext);
}
