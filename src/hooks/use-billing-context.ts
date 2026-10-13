import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { planPagePath, resolveBillingContext, type BillingContextKey } from '@/lib/billing-routes';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';

/**
 * Rental context of the plan and billing pages for the current page (PL-16): the current shell when it is short-rent or
 * long-rent, otherwise the first rental context of the user. `null` when the user has none. Also usable outside the
 * workspace (the contexts are then unknown and only the current path counts).
 */
export function useBillingContext(): BillingContextKey | null {
  const { pathname } = useLocation();
  const workspace = useContext(WorkspaceContext);
  const userContexts = workspace?.contexts.map((context) => context.contextKey) ?? [];
  return resolveBillingContext(pathname, userContexts);
}

/**
 * Plan page for the current page (org badge); `null` when the user has no rental context and when it is a member of the
 * org who may not manage the plan (AM-00): a link would only lead to a page that asks for the owner. Outside the workspace
 * the contexts are unknown and only the current path counts.
 */
export function usePlanPagePath(): string | null {
  const context = useBillingContext();
  const workspace = useContext(WorkspaceContext);
  if (!context) return null;
  if (workspace && !isOrgBillingAdmin(workspace.contexts)) return null;
  return planPagePath(context);
}
