import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { contextsApi, type ContextBootstrapDto } from '@/api/contexts';
import { getDefaultRoute, type AppContextKey } from '@/config/route-manifest';
import { getDemoUser, isDemoMode } from '@/config/demo.config';
import { useAuth } from '@/hooks/use-auth';
import {
  deriveContextsFromAccessToken,
  deriveContextsFromRoles,
  getUserRoles,
} from '@/lib/auth-roles';
import {
  ACTIVE_CONTEXT_STORAGE_KEY,
  LEGACY_ACTIVE_LAYER_STORAGE_KEY,
  WorkspaceContext,
} from './workspace-context';

function readStoredContext(): AppContextKey | null {
  const stored = localStorage.getItem(ACTIVE_CONTEXT_STORAGE_KEY);
  if (stored === 'short-rent' || stored === 'long-rent' || stored === 'admin' || stored === 'supplier') {
    return stored;
  }

  const legacy = localStorage.getItem(LEGACY_ACTIVE_LAYER_STORAGE_KEY);
  if (legacy === 'short-stay') {
    return 'short-rent';
  }
  if (legacy === 'long-term') {
    return 'long-rent';
  }
  return null;
}

function resolveActiveContext(
  available: ContextBootstrapDto[],
  preferred: AppContextKey | null | undefined,
): AppContextKey | null {
  const stored = readStoredContext();
  const candidate = preferred ?? stored;
  if (candidate && available.some((c) => c.contextKey === candidate)) {
    return candidate;
  }
  return available[0]?.contextKey ?? null;
}

function applyResolvedContext(
  available: ContextBootstrapDto[],
  preferred: AppContextKey | null | undefined,
  setContexts: (contexts: ContextBootstrapDto[]) => void,
  setActiveContextState: (context: AppContextKey | null) => void,
) {
  setContexts(available);
  const resolved = resolveActiveContext(available, preferred);
  setActiveContextState(resolved);
  if (resolved) {
    localStorage.setItem(ACTIVE_CONTEXT_STORAGE_KEY, resolved);
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading, getAccessToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const roleSignature = useMemo(() => {
    const authUser = isDemoMode ? getDemoUser() : user;
    return getUserRoles(authUser).slice().sort().join('|');
  }, [isDemoMode, user]);
  const [contexts, setContexts] = useState<ContextBootstrapDto[]>([]);
  const [activeContext, setActiveContextState] = useState<AppContextKey | null>(readStoredContext);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isDemoMode && (authLoading || !isAuthenticated)) {
      setIsReady(false);
      return;
    }

    let mounted = true;

    const loadContexts = async () => {
      const authUser = isDemoMode ? getDemoUser() : user;

      if (isDemoMode) {
        const fallback = deriveContextsFromRoles(authUser);
        if (!mounted) return;
        setContexts(fallback);
        const stored = readStoredContext();
        const resolved = fallback.some((c) => c.contextKey === stored)
          ? stored
          : fallback[0]?.contextKey ?? null;
        setActiveContextState(resolved);
        if (resolved) {
          localStorage.setItem(ACTIVE_CONTEXT_STORAGE_KEY, resolved);
        }
        setIsReady(true);
        return;
      }

      try {
        const bootstrap = await contextsApi.getContexts();
        if (!mounted) return;
        const loaded = bootstrap.contexts ?? [];
        applyResolvedContext(loaded, bootstrap.lastUsedContextKey, setContexts, setActiveContextState);
      } catch (error) {
        if (!mounted) return;
        console.warn('[Workspace] GET /api/me/contexts failed — using JWT fallback', error);

        let fallback = deriveContextsFromRoles(authUser);
        if (fallback.length === 0) {
          try {
            const token = await getAccessToken();
            fallback = deriveContextsFromAccessToken(token);
          } catch (tokenError) {
            console.warn('[Workspace] Could not read roles from access token', tokenError);
          }
        }

        applyResolvedContext(fallback, readStoredContext(), setContexts, setActiveContextState);
      } finally {
        if (mounted) {
          setIsReady(true);
        }
      }
    };

    void loadContexts();
    return () => {
      mounted = false;
    };
  }, [authLoading, getAccessToken, isAuthenticated, roleSignature, user]);

  const setActiveContext = useCallback(
    (contextKey: AppContextKey, navigateToDefault = true) => {
      if (!contexts.some((c) => c.contextKey === contextKey)) {
        return;
      }

      setActiveContextState((previous) => (previous === contextKey ? previous : contextKey));
      localStorage.setItem(ACTIVE_CONTEXT_STORAGE_KEY, contextKey);
      if (navigateToDefault) {
        const target = contexts.find((c) => c.contextKey === contextKey)?.defaultRoute ?? getDefaultRoute(contextKey);
        navigate(target, { replace: true });
      }
    },
    [contexts, navigate],
  );

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const appMatch = location.pathname.match(/^\/app\/(short-rent|long-rent|admin)(?:\/|$)/);
    if (appMatch) {
      const fromUrl = appMatch[1] as AppContextKey;
      if (!contexts.some((c) => c.contextKey === fromUrl)) {
        return;
      }

      setActiveContextState((previous) => (previous === fromUrl ? previous : fromUrl));
      localStorage.setItem(ACTIVE_CONTEXT_STORAGE_KEY, fromUrl);
      return;
    }

    if (location.pathname.startsWith('/supplier')) {
      if (!contexts.some((c) => c.contextKey === 'supplier')) {
        return;
      }

      setActiveContextState((previous) => (previous === 'supplier' ? previous : 'supplier'));
      localStorage.setItem(ACTIVE_CONTEXT_STORAGE_KEY, 'supplier');
    }
  }, [contexts, isReady, location.pathname]);

  const hasPermission = useCallback(
    (contextKey: AppContextKey, permission: string) => {
      const ctx = contexts.find((c) => c.contextKey === contextKey);
      if (!ctx) return false;
      if (!permission) return true;
      return ctx.permissions.includes(permission);
    },
    [contexts],
  );

  const getDefaultContextRoute = useCallback(
    (contextKey: AppContextKey) => contexts.find((c) => c.contextKey === contextKey)?.defaultRoute ?? getDefaultRoute(contextKey),
    [contexts],
  );

  const value = useMemo(
    () => ({
      contexts,
      activeContext,
      isReady,
      setActiveContext,
      hasPermission,
      getDefaultRoute: getDefaultContextRoute,
    }),
    [activeContext, contexts, getDefaultContextRoute, hasPermission, isReady, setActiveContext],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
