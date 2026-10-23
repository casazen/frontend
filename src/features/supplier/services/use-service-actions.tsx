import { useCallback, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { toastUndo } from '@/lib/toast-undo';
import {
  useDeleteSupplierService,
  useForgetSupplierService,
  usePauseSupplierService,
  usePublishSupplierService,
} from '@/queries/use-supplier-services';
import type { SupplierService } from '@/types/supplier-services';
import { describeServiceError } from './lib/service-errors';

const T = 'supplier.services.actions';

export interface ServiceActions {
  /** Puts a draft or a paused service on offer. Resolves with the service, or `null` when the API refused (the person was told). */
  publishService: (service: SupplierService) => Promise<SupplierService | null>;
  /** Takes a published service off offer without losing it. */
  pauseService: (service: SupplierService) => Promise<SupplierService | null>;
  /** Opens the confirmation of the deletion. */
  askDelete: (service: SupplierService) => void;
  /** Render it once on the page: it is the confirmation that `askDelete` opens. */
  deleteDialog: ReactElement;
  /** A publication, a pause or a deletion is going on. */
  busy: boolean;
}

/**
 * What the supplier does to a service from the list and from its page: put it on offer, pause it, delete it. Pausing and
 * putting back on offer are each other's inverse, so their toast offers "Annulla" for real (`toastUndo`); a first publication
 * of a draft is not (a service never goes back to being a draft) and a deletion is not (there is no way to restore one), so
 * those have a plain toast, and the deletion asks first. A refusal of the API is told in words (what is missing to publish).
 */
export function useServiceActions(options: { onDeleted?: (service: SupplierService) => void } = {}): ServiceActions {
  const { t } = useTranslation();
  const publish = usePublishSupplierService();
  const pause = usePauseSupplierService();
  const remove = useDeleteSupplierService();
  const forget = useForgetSupplierService();
  const [toDelete, setToDelete] = useState<SupplierService | null>(null);
  const { onDeleted } = options;
  const { mutateAsync: publishAsync } = publish;
  const { mutateAsync: pauseAsync } = pause;

  /** Tells the person what the API refused. A service that is not there any more (deleted elsewhere) stops being shown. */
  const fail = useCallback(
    (error: unknown, service: SupplierService) => {
      const found = describeServiceError(error, t);
      if (found.kind === 'notFound') forget(service.id);
      toast.error(found.message);
      return null;
    },
    [t, forget],
  );

  // `publishService`, `pauseService` and `askDelete` are the same functions on every render, so that the list that holds them is not built again for nothing.
  const publishService = useCallback(
    async (service: SupplierService) => {
      try {
        const updated = await publishAsync(service.id);
        if (service.status === 'Paused') {
          toastUndo(t(`${T}.published`, { name: service.name }), { undo: async () => void (await pauseAsync(service.id)) });
        } else {
          toast.success(t(`${T}.published`, { name: service.name }));
        }
        return updated;
      } catch (error) {
        return fail(error, service);
      }
    },
    [publishAsync, pauseAsync, t, fail],
  );

  const pauseService = useCallback(
    async (service: SupplierService) => {
      try {
        const updated = await pauseAsync(service.id);
        toastUndo(t(`${T}.paused`, { name: service.name }), { undo: async () => void (await publishAsync(service.id)) });
        return updated;
      } catch (error) {
        return fail(error, service);
      }
    },
    [publishAsync, pauseAsync, t, fail],
  );

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast.success(t(`${T}.deleted`, { name: toDelete.name }));
      onDeleted?.(toDelete);
    } catch (error) {
      fail(error, toDelete);
    }
  };

  const live = toDelete?.status !== 'Draft';
  const deleteDialog = (
    <ConfirmationDialog
      open={toDelete !== null}
      onOpenChange={(open) => {
        if (!open) setToDelete(null);
      }}
      title={t(`${T}.deleteTitle`, { name: toDelete?.name ?? '' })}
      description={t(`${T}.deleteDescription`)}
      consequences={live ? [t(`${T}.deleteGone`), t(`${T}.deleteRequestsStay`)] : [t(`${T}.deleteDraftGone`)]}
      confirmLabel={t(`${T}.deleteConfirm`)}
      variant="destructive"
      isLoading={remove.isPending}
      onConfirm={confirmDelete}
    />
  );

  return {
    publishService,
    pauseService,
    askDelete: setToDelete,
    deleteDialog,
    busy: publish.isPending || pause.isPending || remove.isPending,
  };
}
