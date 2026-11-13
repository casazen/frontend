import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rememberOpener } from '@/components/shared/detail-drawer/detail-opener';
import { marketplaceEntryValue } from './marketplace-entry';
import { MARKETPLACE_ENTRY_PARAM, MARKETPLACE_PROPERTY_PARAM } from './marketplace-paths';

/**
 * Opens the detail card of an integration on the page the person is on (MKT-02): the card is a drawer that is open while the address has `?entry=<kind>:<code>`. The card of an
 * activation of a property says where it stands for that property, so the address names the property too. The drawer gives the focus back to the button that opened it.
 */
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
          return next;
        },
        // The card is part of the page, not a step of the way: it takes the place of the entry of the history, and Back leaves the page.
        { replace: true, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );
}
