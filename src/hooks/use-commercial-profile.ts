import { useCallback, useContext, useSyncExternalStore } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { commercialRouteAllowed } from '@/features/onboarding/commercial-access';
import type { UserDetail } from '@/types';

export function useCommercialProfile() {
  const client = useContext(QueryClientContext);
  const subscribe = useCallback((changed: () => void) => client?.getQueryCache().subscribe(changed) ?? (() => undefined), [client]);
  const snapshot = useCallback(() => client?.getQueryData<UserDetail>(['me']), [client]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useCommercialRouteAccess() {
  const profile = useCommercialProfile();
  return useCallback((path: string) => commercialRouteAllowed(profile, path), [profile]);
}
