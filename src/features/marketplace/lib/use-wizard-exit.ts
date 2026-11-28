import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { WizardDraft } from '@/lib/wizard-draft';
import { MARKETPLACE_PATH } from './marketplace-paths';
import { readMarketplaceReturnTo } from './return-to';

export function draftOfThePropertyOf(requestedPropertyId: string | null | undefined): (draft: WizardDraft) => boolean {
  return (draft) => {
    if (!requestedPropertyId) return true;
    const named = draft.values.propertyIds ?? draft.values.propertyId;
    return Array.isArray(named) ? named.includes(requestedPropertyId) : named === requestedPropertyId;
  };
}

export const returnToStorageKey = (memoKey: string) => `casazen.marketplaceReturnTo:${memoKey}`;

function recalledReturnTo(memoKey: string): string | null {
  try {
    const kept = sessionStorage.getItem(returnToStorageKey(memoKey));
    return kept === null ? null : readMarketplaceReturnTo(new URLSearchParams({ returnTo: kept }).toString());
  } catch {
    return null;
  }
}

function keepReturnTo(memoKey: string, returnTo: string | null): void {
  try {
    if (returnTo === null) sessionStorage.removeItem(returnToStorageKey(memoKey));
    else sessionStorage.setItem(returnToStorageKey(memoKey), returnTo);
  } catch {
    // Nothing is kept: the way back from the trip then ends at the Marketplace.
  }
}

export function forgetReturnTo(memoKey: string | undefined): void {
  if (memoKey !== undefined) keepReturnTo(memoKey, null);
}

/**
 * Where a guided wizard of the marketplace goes back to (E09/F02/US04): the page that sent the person there, when it put its own address in
 * `returnTo` and the address is a page of the app, and the Marketplace page otherwise. The address is read once, when the wizard opens: it is
 * the one «Salva ed esci», the cancel of the first step and the closing buttons of the result lead to.
 *
 * With a `memoKey` (the wizard that sends the person away in the same tab) the address is kept in this tab: the wizard opened again at a step, with no `returnTo`
 * in its address, is the one the person left and came back to, and goes back to where it was opened from. A visit that starts afresh has no step in its address and
 * keeps its own (or none): what an earlier visit kept is not followed. «Salva ed esci» and «Annulla» forget it (`forgetReturnTo`).
 */
export function useWizardReturn(memoKey?: string): { returnTo: string | null; exitPath: string } {
  const { search } = useLocation();
  const [returnTo] = useState(() => {
    const fromAddress = readMarketplaceReturnTo(search);
    if (memoKey === undefined || fromAddress !== null) return fromAddress;
    return new URLSearchParams(search).has('step') ? recalledReturnTo(memoKey) : null;
  });
  useEffect(() => {
    if (memoKey !== undefined) keepReturnTo(memoKey, returnTo);
  }, [memoKey, returnTo]);

  return { returnTo, exitPath: returnTo ?? MARKETPLACE_PATH };
}

export function useWizardLeave(exitPath: string, savedMessage: string, memoKey?: string): () => void {
  const navigate = useNavigate();

  return useCallback(() => {
    forgetReturnTo(memoKey);
    toast.success(savedMessage);
    navigate(exitPath);
  }, [exitPath, memoKey, navigate, savedMessage]);
}
