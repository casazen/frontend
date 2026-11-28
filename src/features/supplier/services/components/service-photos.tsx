import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { PhotoList, type PhotoListHandle, type PhotoListLabels } from '@/components/shared/photo-list';
import { useUpdateSupplierService, useUploadSupplierServicePhotos } from '@/queries/use-supplier-services';
import type { SupplierService } from '@/types/supplier-services';
import { bodyFromService } from '../lib/service-form';
import { describeServiceError, type ServiceProblem } from '../lib/service-errors';
import { SERVICE_LIMITS, SERVICE_PHOTO_TYPES } from '../lib/service-limits';
import { refuseFiles } from '../lib/service-photo-rules';

const T = 'supplier.services.photos';

interface ServicePhotosProps {
  service: SupplierService;
  /** The API says the service changed since this screen read it: the screen decides what to do (reload). */
  onConflict?: () => void;
}

export function ServicePhotos({ service, onConflict }: ServicePhotosProps) {
  const { t } = useTranslation();
  const upload = useUploadSupplierServicePhotos();
  const update = useUpdateSupplierService();
  const [problem, setProblem] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<string | null>(null);
  const list = useRef<PhotoListHandle>(null);
  const removedAt = useRef<number | null>(null);
  const busy = upload.isPending || update.isPending;

  const report = (error: unknown) => {
    const found: ServiceProblem = describeServiceError(error, t);
    setProblem(found.message);
    if (found.kind === 'changed') onConflict?.();
  };

  const add = (files: File[]) => {
    const refusal = refuseFiles(files, service.photoUrls.length, t);
    setProblem(refusal);
    if (refusal === null) upload.mutate({ id: service.id, files }, { onError: report });
  };

  const keep = async (urls: string[]) => {
    setProblem(null);
    try {
      await update.mutateAsync({ id: service.id, body: { ...bodyFromService(service, urls), version: service.version } });
    } catch (error) {
      report(error);
    }
  };

  const labels: PhotoListLabels = {
    add: t(`${T}.add`),
    adding: t(`${T}.adding`),
    counter: t(`${T}.counter`, { count: service.photoUrls.length, max: SERVICE_LIMITS.maxPhotos }),
    empty: t(`${T}.empty`),
    cover: t(`${T}.cover`),
    unavailable: t(`${T}.unavailable`),
    moveEarlier: (position) => t(`${T}.moveEarlier`, { number: position }),
    moveLater: (position) => t(`${T}.moveLater`, { number: position }),
    remove: (position) => t(`${T}.remove`, { number: position }),
  };

  return (
    <>
      <PhotoList
        ref={list}
        items={service.photoUrls.map((url, index) => ({ url, alt: t(`${T}.alt`, { number: index + 1, name: service.name }) }))}
        max={SERVICE_LIMITS.maxPhotos}
        labels={labels}
        accept={SERVICE_PHOTO_TYPES.join(',')}
        busy={busy}
        uploading={upload.isPending}
        error={problem}
        onChange={(urls) => void keep(urls)}
        onRemove={setToRemove}
        onAdd={add}
        testId="service-photos"
      />
      <ConfirmationDialog
        open={toRemove !== null}
        onOpenChange={(open) => {
          if (!open) setToRemove(null);
        }}
        title={t(`${T}.removeTitle`)}
        description={t(`${T}.removeDescription`)}
        confirmLabel={t(`${T}.removeConfirm`)}
        variant="destructive"
        isLoading={update.isPending}
        onConfirm={() => {
          removedAt.current = toRemove === null ? null : service.photoUrls.indexOf(toRemove);
          return keep(service.photoUrls.filter((url) => url !== toRemove));
        }}
        onCloseAutoFocus={(event) => {
          const index = removedAt.current;
          removedAt.current = null;
          if (index === null || index < 0) return;
          event.preventDefault();
          list.current?.focusAfterRemoval(index);
        }}
      />
    </>
  );
}
