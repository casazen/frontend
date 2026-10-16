import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { PhotoList, type PhotoListHandle, type PhotoListLabels } from '@/components/shared/photo-list';
import { getProblemMessage } from '@/lib/api-errors';
import { useUpdateSupplierProfile, useUploadSupplierPhotos } from '@/queries/use-supplier';
import type { SupplierProfile } from '@/types/supplier';
import { MAX_SUPPLIER_PHOTOS } from '../components/activation-steps';

const T = 'supplier.profile.photos';
const SHOWCASE_PATH = '/app/supplier/showcase';
/** What the API takes (`POST profile/photos`): JPEG, PNG or WebP. It checks the content too, and refuses all the files if one is not good. */
const PHOTO_TYPES = 'image/jpeg,image/png,image/webp';

/**
 * The photos of the showcase, on the endpoints of today: a photo goes up with `POST profile/photos` (the server keeps it on the profile
 * at once), the order and the removal are a save of the photos to keep (`PUT profile` with `photoUrls` alone, the rest is not touched).
 * The first photo is the cover. Removing asks first: a removed photo cannot be put back. It sits outside the form of the data, so that
 * saving one does not carry the other with it.
 */
export function ProfilePhotos({ profile }: { profile: SupplierProfile }) {
  const { t } = useTranslation();
  const upload = useUploadSupplierPhotos();
  const update = useUpdateSupplierProfile();
  const [problem, setProblem] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<string | null>(null);
  const list = useRef<PhotoListHandle>(null);
  /** Where in the list the photo that is being removed was: once the dialog has closed the focus goes to its neighbor. */
  const removedAt = useRef<number | null>(null);
  const photos = profile.photoUrls ?? [];
  const busy = upload.isPending || update.isPending;

  const add = (files: File[]) => {
    if (photos.length + files.length > MAX_SUPPLIER_PHOTOS) {
      setProblem(t(`${T}.errors.tooMany`, { max: MAX_SUPPLIER_PHOTOS }));
      return;
    }
    setProblem(null);
    upload.mutate(files, { onError: (error) => setProblem(getProblemMessage(error, t) ?? t(`${T}.errors.upload`)) });
  };

  const keep = async (urls: string[]) => {
    setProblem(null);
    try {
      await update.mutateAsync({ photoUrls: urls });
    } catch (error) {
      setProblem(getProblemMessage(error, t) ?? t(`${T}.errors.save`));
    }
  };

  const labels: PhotoListLabels = {
    add: t(`${T}.add`),
    adding: t(`${T}.adding`),
    counter: t(`${T}.counter`, { count: photos.length, max: MAX_SUPPLIER_PHOTOS }),
    empty: t(`${T}.empty`),
    cover: t(`${T}.cover`),
    unavailable: t(`${T}.unavailable`),
    moveEarlier: (position) => t(`${T}.moveEarlier`, { number: position }),
    moveLater: (position) => t(`${T}.moveLater`, { number: position }),
    remove: (position) => t(`${T}.remove`, { number: position }),
  };

  return (
    <PlainSection title={t(`${T}.title`)} data-testid="supplier-profile-photos">
      <p className="text-sm text-foreground/70">{t(`${T}.hint`)}</p>
      <PhotoList
        ref={list}
        items={photos.map((url, index) => ({ url, alt: t(`${T}.alt`, { number: index + 1 }) }))}
        max={MAX_SUPPLIER_PHOTOS}
        labels={labels}
        accept={PHOTO_TYPES}
        busy={busy}
        uploading={upload.isPending}
        error={problem}
        onChange={(urls) => void keep(urls)}
        onRemove={setToRemove}
        onAdd={add}
        testId="supplier-photos"
      />
      <Link
        to={SHOWCASE_PATH}
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text underline underline-offset-4"
        data-testid="supplier-showcase-preview-link"
      >
        {t(`${T}.preview`)}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
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
          removedAt.current = toRemove === null ? null : photos.indexOf(toRemove);
          return keep(photos.filter((url) => url !== toRemove));
        }}
        // The button that opened the dialog is gone with its photo: the focus goes to the photo that took its place.
        onCloseAutoFocus={(event) => {
          const index = removedAt.current;
          removedAt.current = null;
          if (index === null || index < 0) return;
          event.preventDefault();
          list.current?.focusAfterRemoval(index);
        }}
      />
    </PlainSection>
  );
}
