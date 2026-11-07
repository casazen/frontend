import { useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useCfSync } from '@/queries/use-concordatofacile';
import { leaseDocumentsKey } from '@/queries/use-lease-documents';
import { DRAFT_KEY } from '@/queries/use-lease-draft';
import { LEASES_KEY } from '@/queries/use-leases';
import type { CfSyncState } from '@/types/concordatofacile.types';
import type { LeaseDetail } from '@/types';
import { isServiceDraft } from './lease-sheet';

type CompletionLease = Pick<LeaseDetail, 'id' | 'status' | 'contractType' | 'startDate' | 'isConcordatoFacileSource'>;

/**
 * A lease that follows the practice of the guided service (CF-DONE): its draft (the one made for the service, or one the server marked as
 * the service's), or the contract of the service that is signed and waits for the receipt of its registration. A lease of any other kind
 * has nothing to do with the service and is never asked about it.
 */
export function followsThePractice(lease: CompletionLease): boolean {
  return isServiceDraft(lease) || (lease.status === 'Signed' && lease.isConcordatoFacileSource === true);
}

/**
 * Keeps the lease of the guided service moving along with its practice (CF-DONE): when the sheet (or the page of the documents) of such a
 * lease opens, and again every few seconds while the server reads a document, the server is asked to do what it can do by itself with the
 * documents the person uploaded and the state of the practice (read the contract into the draft, import it as signed once the practice
 * says it is, declare the registration from the receipt). When its answer says the lease is not what the screen has (another status, or
 * the lease is now marked as the service's) the lease, its documents and its reading are read again, so the screen follows: the draft that
 * was «Bozza» becomes the signed, then the registered contract, and the card of the draft is gone.
 *
 * It asks nothing when the service is off, for a lease that does not follow the practice, and for who may not sign and register: the
 * server needs both permissions for what it does (403 otherwise). `state` is what the server answered last, `undefined` before and when
 * nothing is asked.
 */
export function useCfCompletion(lease: CompletionLease): { state: CfSyncState | undefined } {
  const queryClient = useQueryClient();
  const { flags } = useFeatureFlags();
  const workspace = useContext(WorkspaceContext);
  // Without a workspace (a page rendered on its own) nothing is hidden: the server decides.
  const allowed = workspace ? workspace.hasPermission('long-rent', 'lease.sign') && workspace.hasPermission('long-rent', 'lease.register') : true;
  const sync = useCfSync(lease.id, { enabled: flags.concordatoFacile && allowed && followsThePractice(lease) });

  const answer = sync.data;
  const marked = lease.isConcordatoFacileSource === true;
  // The lease is not what the server says: it has another status now, or it has just been marked as the service's (only a lease of the
  // service gets another answer than «not applicable»).
  const moved = answer !== undefined && (answer.leaseStatus !== lease.status || (!marked && answer.state !== 'NotApplicable'));
  const leaseId = lease.id;

  useEffect(() => {
    if (!moved) return;
    void queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
    void queryClient.invalidateQueries({ queryKey: leaseDocumentsKey(leaseId) });
    void queryClient.invalidateQueries({ queryKey: [DRAFT_KEY, leaseId] });
  }, [moved, queryClient, leaseId]);

  return { state: answer?.state };
}
