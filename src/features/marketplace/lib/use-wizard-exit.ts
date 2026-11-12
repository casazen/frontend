import { useCallback, useState } from 'react';
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
 * Where a guided wizard of the marketplace goes back to (E09/F02/US04): the page that sent the person there, when it put its own address in
 * `returnTo` and the address is a page of the app, and the Marketplace page otherwise. The address is read once, when the wizard opens: it is
 * the one «Salva ed esci», the cancel of the first step and the closing buttons of the result lead to.
 */
export function useWizardReturn(): { returnTo: string | null; exitPath: string } {
  const { search } = useLocation();
  const [returnTo] = useState(() => readMarketplaceReturnTo(search));

  return { returnTo, exitPath: returnTo ?? MARKETPLACE_PATH };
}

/**
 * «Salva ed esci»: leaves the wizard to `exitPath` and says so. What the person answered stays as the draft of the wizard (the shell writes it as
 * the page goes away), and what the server holds (a connection, a request) is the server's: leaving undoes none of it.
 */
export function useWizardLeave(exitPath: string, savedMessage: string): () => void {
  const navigate = useNavigate();

  return useCallback(() => {
    toast.success(savedMessage);
    navigate(exitPath);
  }, [exitPath, navigate, savedMessage]);
}
