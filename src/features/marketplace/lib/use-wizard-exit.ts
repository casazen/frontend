import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MARKETPLACE_PATH } from './marketplace-paths';
import { readMarketplaceReturnTo } from './return-to';

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
