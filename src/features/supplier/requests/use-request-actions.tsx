import { useCallback, useState, type ReactNode } from 'react';
import { useCompleteServiceRequest, useRejectServiceRequest, useTakeServiceRequest } from '@/queries/use-service-requests';
import { useSupplierSuspended } from '@/queries/use-supplier';
import { RejectServiceRequestDialog } from '../components/reject-service-request-dialog';

export interface RequestActions {
  /** A suspended supplier performs no action (SU-12): the buttons stay, disabled, and the banner says why. */
  suspended: boolean;
  /** An action is going on: a second tap is ignored. */
  busy: boolean;
  /** Which request an action is going on for, to show the spinner on its button. */
  takingId: string | null;
  completingId: string | null;
  take: (id: string) => void;
  complete: (id: string) => void;
  /** Opens the dialog that asks why, then refuses the request. */
  askReject: (id: string) => void;
  /** The dialog of the refusal: render it once, anywhere in the page. */
  dialog: ReactNode;
}

/**
 * What the supplier can do about a request (take, complete, refuse), shared by the list, the drawer and the page of the request.
 * `onChanged` runs when the server refuses an action because the request changed meanwhile (409, 422: the customer cancelled while
 * the supplier was taking it), so that whoever shows the request reads it again.
 */
export function useRequestActions(onChanged?: () => void): RequestActions {
  const take = useTakeServiceRequest();
  const complete = useCompleteServiceRequest();
  const reject = useRejectServiceRequest();
  const suspended = useSupplierSuspended();
  const [rejectId, setRejectId] = useState<string | null>(null);
  // `mutate` of TanStack Query keeps its identity: with a caller that does not change `onChanged`, the actions are the same
  // functions on every render, so a list definition that holds them is not built again for nothing.
  const { mutate: mutateTake } = take;
  const { mutate: mutateComplete } = complete;
  const takeRequest = useCallback((id: string) => mutateTake(id, { onError: onChanged }), [mutateTake, onChanged]);
  const completeRequest = useCallback((id: string) => mutateComplete({ id }, { onError: onChanged }), [mutateComplete, onChanged]);

  return {
    suspended,
    busy: take.isPending || complete.isPending || reject.isPending,
    takingId: take.isPending ? (take.variables ?? null) : null,
    completingId: complete.isPending ? (complete.variables?.id ?? null) : null,
    take: takeRequest,
    complete: completeRequest,
    askReject: setRejectId,
    dialog: rejectId ? (
      <RejectServiceRequestDialog
        key={rejectId}
        open
        isPending={reject.isPending}
        onCancel={() => setRejectId(null)}
        onConfirm={(reason) => reject.mutate({ id: rejectId, reason }, { onSuccess: () => setRejectId(null), onError: onChanged })}
      />
    ) : null,
  };
}
