import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rememberOpener } from '@/components/shared/detail-drawer/detail-opener';
import { marketplaceEntryValue } from './marketplace-entry';
import { MARKETPLACE_ENTRY_PARAM, MARKETPLACE_PROPERTY_PARAM } from './marketplace-paths';

export function useOpenEntryDetails() {
  const [, setSearchParams] = useSearchParams();

  return useCallback(
    (entry: { kind: string; code: string }, propertyId: string | null | undefined, opener: HTMLElement) => {
      rememberOpener(opener);
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set(MARKETPLACE_ENTRY_PARAM, marketplaceEntryValue(entry));
          if (propertyId) next.set(MARKETPLACE_PROPERTY_PARAM, propertyId);
          else next.delete(MARKETPLACE_PROPERTY_PARAM);
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );
}
