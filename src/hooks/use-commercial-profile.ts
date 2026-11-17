import { useCallback, useContext, useSyncExternalStore } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import type { UserDetail } from '@/types';

/** Reuse the profile already loaded by the access guard; isolated shells do not start a new request. */
export function useCommercialProfile() {
  const client = useContext(QueryClientContext);
  const subscribe = useCallback((changed: () => void) => client?.getQueryCache().subscribe(changed) ?? (() => undefined), [client]);
  const snapshot = useCallback(() => client?.getQueryData<UserDetail>(['me']), [client]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
