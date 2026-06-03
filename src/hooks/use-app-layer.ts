import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import {
  isDualRole,
  isLongTermOnly,
  isShortStayOnly,
  type UserWithRoles,
} from '@/lib/auth-roles';

export type AppLayer = 'short-stay' | 'long-term';

export const ACTIVE_LAYER_STORAGE_KEY = 'casazen:active-layer';

const SHORT_STAY_PATH_PREFIXES = [
  '/',
  '/properties',
  '/bookings',
  '/payments',
  '/ota',
  '/search',
];

export function getDefaultHomePath(layer: AppLayer = 'short-stay'): string {
  return layer === 'long-term' ? '/leases' : '/';
}

export function resolveInitialLayer(user: UserWithRoles): AppLayer {
  if (isShortStayOnly(user)) return 'short-stay';
  if (isLongTermOnly(user)) return 'long-term';

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(ACTIVE_LAYER_STORAGE_KEY);
    if (stored === 'long-term' || stored === 'short-stay') {
      return stored;
    }
  }

  return 'short-stay';
}

function readStoredLayer(): AppLayer {
  if (typeof window === 'undefined') return 'short-stay';
  const stored = localStorage.getItem(ACTIVE_LAYER_STORAGE_KEY);
  return stored === 'long-term' ? 'long-term' : 'short-stay';
}

function persistLayer(layer: AppLayer): void {
  localStorage.setItem(ACTIVE_LAYER_STORAGE_KEY, layer);
}

function isShortStayDeepLink(pathname: string): boolean {
  if (pathname === '/') return true;
  return SHORT_STAY_PATH_PREFIXES.some(
    (prefix) => prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

function getPathLayer(pathname: string, canSwitchLayer: boolean): AppLayer | null {
  if (!canSwitchLayer) return null;
  if (pathname.startsWith('/leases')) return 'long-term';
  if (isShortStayDeepLink(pathname)) return 'short-stay';
  return null;
}

export interface UseAppLayerReturn {
  activeLayer: AppLayer;
  setLayer: (layer: AppLayer) => void;
  effectiveLayer: AppLayer;
  canSwitchLayer: boolean;
  getDefaultHomePath: (layer?: AppLayer) => string;
}

export function useAppLayer(): UseAppLayerReturn {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const canSwitchLayer = isDualRole(user);

  const forcedLayer = useMemo((): AppLayer | null => {
    if (isShortStayOnly(user)) return 'short-stay';
    if (isLongTermOnly(user)) return 'long-term';
    return null;
  }, [user]);

  const pathLayer = useMemo(
    () => getPathLayer(location.pathname, canSwitchLayer),
    [canSwitchLayer, location.pathname]
  );

  const [storedLayer, setStoredLayer] = useState<AppLayer>(readStoredLayer);
  const [prevPathLayer, setPrevPathLayer] = useState<AppLayer | null>(pathLayer);
  const [prevForcedLayer, setPrevForcedLayer] = useState<AppLayer | null>(forcedLayer);

  if (pathLayer !== prevPathLayer) {
    setPrevPathLayer(pathLayer);
    if (pathLayer) {
      setStoredLayer(pathLayer);
      persistLayer(pathLayer);
    }
  }

  if (forcedLayer !== prevForcedLayer) {
    setPrevForcedLayer(forcedLayer);
    if (forcedLayer) {
      setStoredLayer(forcedLayer);
    }
  }

  const activeLayer = forcedLayer ?? pathLayer ?? storedLayer;
  const effectiveLayer = forcedLayer ?? activeLayer;

  const setLayer = useCallback(
    (layer: AppLayer) => {
      if (!canSwitchLayer) return;
      setStoredLayer(layer);
      persistLayer(layer);
      navigate(getDefaultHomePath(layer), { replace: true });
    },
    [canSwitchLayer, navigate]
  );

  const getHomePath = useCallback(
    (layer?: AppLayer) => getDefaultHomePath(layer ?? effectiveLayer),
    [effectiveLayer]
  );

  return {
    activeLayer,
    setLayer,
    effectiveLayer,
    canSwitchLayer,
    getDefaultHomePath: getHomePath,
  };
}
