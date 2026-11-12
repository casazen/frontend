import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { WizardDraft } from '@/lib/wizard-draft';
import { MARKETPLACE_PATH } from './marketplace-paths';
import { readMarketplaceReturnTo } from './return-to';

/**
 * The `accept` of the draft of a wizard that is opened for a property (`?propertyId=`, the property the Marketplace was about): the draft that this tab kept from an
 * earlier visit is laid over the values the wizard starts from, so a draft that does not name that property would take the wizard to another one than the person came for
 * (a request, a connection, for the wrong property). Such a draft is dropped; one that names it is kept with all it holds, and without a property in the address the draft
 * is kept as it is (a person who comes back from the panel of the channel manager or from «Salva ed esci»).
 */
export function draftOfThePropertyOf(requestedPropertyId: string | null | undefined): (draft: WizardDraft) => boolean {
  return (draft) => {
    if (!requestedPropertyId) return true;
    const named = draft.values.propertyIds ?? draft.values.propertyId;
    return Array.isArray(named) ? named.includes(requestedPropertyId) : named === requestedPropertyId;
  };
}

/**
 * Where a wizard keeps, in this tab, the page it was opened from, for the wizard that sends the person away in the same tab and is opened again by the page they come back to
 * (the activation wizard: the guided step of the panel of the channel manager comes back to the step of the wizard, whose record carries no `returnTo`). It is the address that
 * `returnTo` held, and is read again as any `returnTo` is: only a page of the app counts.
 */
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

/** The wizard is left on purpose («Salva ed esci», «Annulla»): where it was opened from is not kept for a later visit. */
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

/**
 * «Salva ed esci»: leaves the wizard to `exitPath` and says so. What the person answered stays as the draft of the wizard (the shell writes it as
 * the page goes away), and what the server holds (a connection, a request) is the server's: leaving undoes none of it. With a `memoKey` the page the wizard was opened
 * from is forgotten (`useWizardReturn`): the person is going there now.
 */
export function useWizardLeave(exitPath: string, savedMessage: string, memoKey?: string): () => void {
  const navigate = useNavigate();

  return useCallback(() => {
    forgetReturnTo(memoKey);
    toast.success(savedMessage);
    navigate(exitPath);
  }, [exitPath, memoKey, navigate, savedMessage]);
}
