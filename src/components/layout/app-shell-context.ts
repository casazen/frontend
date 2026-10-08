import { createContext, useContext } from 'react';
import type { AppContextKey } from '@/config/route-manifest';

/** The shell a page is rendered in (UI-03). */
export interface AppShellContextValue {
  contextKey: AppContextKey;
}

/** Set by `AppShellLayout` around the page of the route; read by `AppShell` to avoid nesting a second shell. */
export const AppShellContext = createContext<AppShellContextValue | null>(null);

/** The enclosing app shell, or `null` outside any (isolated renders, callers that were never under a context layout). */
export function useAppShell(): AppShellContextValue | null {
  return useContext(AppShellContext);
}
