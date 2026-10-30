import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/dropzone';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getProblemMessage } from '@/lib/api-errors';
import { usePropertyPhotos, useReorderPropertyPhotos, useSetPropertyCoverPhoto } from '@/queries/use-property-photos';
import { FALLBACK_PHOTO_RULES, toMegabytes } from '../../photo-selection';
import { PhotoGallery } from '../photos/photo-gallery';
import { useDelayedPhotoDelete } from '../photos/use-delayed-photo-delete';
import { usePhotoUploadQueue } from '../photos/use-photo-upload-queue';
import type { PropertyWizardValues } from '../property-wizard-model';
import { LISTING_DESCRIPTION_MAX, LISTING_TITLE_MAX, suggestListingText } from '../suggest-listing-text';

/** The photos the page asks for: the server advises the same number (`photos` in «cosa manca»); fewer is allowed. */
const RECOMMENDED_PHOTOS = 5;

interface PhotosStepProps {
  form: UseFormReturn<PropertyWizardValues>;
  propertyId: string;
}

/**
 * Step 2 · «Mostra la casa con qualche foto» (SR-07b): the photos and the text of the listing. The photos are uploaded one file at a
 * time with the reason for each one that fails, the first is the cover, the order is changed by dragging or with the buttons, and a
 * photo that is deleted can be brought back for a few seconds. The text is the person's: «Suggerisci un testo» only composes it from
 * what they already entered, and can be taken back. Photos are **recommended, not required**.
 */
export function PhotosStep({ form, propertyId }: PhotosStepProps) {
  const { t } = useTranslation();
  const gallery = usePropertyPhotos(propertyId);
  // An answer that is not a gallery (no list of photos) is as good as none: the step says it cannot read it, it does not break.
  const loaded = gallery.data && Array.isArray(gallery.data.photoUrls) ? gallery.data : undefined;
  const unreadable = gallery.isError || (gallery.isSuccess && !loaded);
  const rules = loaded ?? FALLBACK_PHOTO_RULES;
  const reorder = useReorderPropertyPhotos(propertyId);
  const setCover = useSetPropertyCoverPhoto(propertyId);
  const { held, remove, flush } = useDelayedPhotoDelete(propertyId);
  const [announcement, setAnnouncement] = useState('');

  // A photo with its delete on hold is already gone for the person, and the server still has it until the delete leaves.
  const photos = (loaded?.photoUrls ?? []).filter((url) => !held.includes(url));
  const queue = usePhotoUploadQueue(propertyId, photos.length, rules);
  const full = photos.length + queue.items.filter((item) => item.status !== 'failed').length >= rules.maxPhotos;
  const busy = reorder.isPending || setCover.isPending;

  // Before any change to the gallery the deletes on hold go out: the server must have the photos that the person sees.
  const move = async (from: number, to: number) => {
    if (to < 0 || to >= photos.length || from === to) return;
    await flush();
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    reorder.mutate(next, {
      onSuccess: () => setAnnouncement(t('propertyWizard.photos.gallery.moved', { index: from + 1, position: to + 1, total: next.length })),
    });
  };

  const makeCover = async (url: string) => {
    await flush();
    setCover.mutate(url);
  };

  const addFiles = async (files: File[]) => {
    await flush();
    queue.add(files);
  };

  const [previous, setPrevious] = useState<{ listingTitle: string; description: string } | null>(null);
  const { register, setValue, getValues, watch, formState } = form;
  const titleLength = watch('listingTitle').length;
  const descriptionLength = watch('description').length;

  const suggest = () => {
    const values = getValues();
    setPrevious({ listingTitle: values.listingTitle, description: values.description });
    const text = suggestListingText(values, t);
    setValue('listingTitle', text.title, { shouldDirty: true, shouldValidate: true });
    setValue('description', text.description, { shouldDirty: true, shouldValidate: true });
  };

  const undoSuggestion = () => {
    if (!previous) return;
    setValue('listingTitle', previous.listingTitle, { shouldDirty: true, shouldValidate: true });
    setValue('description', previous.description, { shouldDirty: true, shouldValidate: true });
    setPrevious(null);
  };

  return (
    <>
      <section aria-labelledby="property-wizard-photos-title" className="min-w-0 space-y-4">
        <div className="space-y-1">
          <h3 id="property-wizard-photos-title" className="text-base font-semibold">
            {t('propertyWizard.photos.title')}
          </h3>
          <p className="text-sm text-foreground/70" data-testid="property-wizard-photos-count">
            {t('propertyWizard.photos.recommended', { photos: photos.length, recommended: RECOMMENDED_PHOTOS })}
          </p>
        </div>

        <Dropzone
          accept={rules.allowedContentTypes}
          onFiles={(files) => void addFiles(files)}
          disabled={full}
          title={full ? t('property.photos.limitReached', { max: rules.maxPhotos }) : t('propertyWizard.photos.dropzone.title')}
          buttonLabel={t('propertyWizard.photos.dropzone.button')}
          hint={t('property.photos.rules', { max: rules.maxPhotos, size: toMegabytes(rules.maxFileSizeBytes) })}
          data-testid="property-wizard-dropzone"
        />

        {queue.items.length > 0 ? (
          <ul className="space-y-2" aria-label={t('propertyWizard.photos.queue.label')} data-testid="property-wizard-queue">
            {queue.items.map((item) => (
              <li key={item.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm" data-status={item.status}>
                <span className="min-w-0 flex-1 break-words font-medium">{item.file.name}</span>
                {item.status === 'failed' ? (
                  <>
                    <span role="alert" className="basis-full text-danger-foreground sm:basis-auto">
                      {item.error}
                    </span>
                    <Button type="button" size="sm" variant="outline" onClick={() => queue.retry(item.id)}>
                      {t('propertyWizard.photos.queue.retry')}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => queue.dismiss(item.id)}>
                      {t('propertyWizard.photos.queue.dismiss')}
                    </Button>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-foreground/70">
                    {item.status === 'uploading' ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                    {item.status === 'uploading' ? t('propertyWizard.photos.queue.uploading') : t('propertyWizard.photos.queue.waiting')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {gallery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="status" aria-busy="true" aria-label={t('property.photos.loading')}>
            {[0, 1, 2].map((slot) => (
              <Skeleton key={slot} className="aspect-[4/3] w-full" />
            ))}
          </div>
        ) : unreadable ? (
          <Alert
            variant="danger"
            data-testid="property-wizard-photos-error"
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => void gallery.refetch()}>
                {t('property.photos.retry')}
              </Button>
            }
          >
            {getProblemMessage(gallery.error, t) ?? t('property.photos.loadError')}
          </Alert>
        ) : photos.length > 0 ? (
          <PhotoGallery
            propertyName={form.getValues('name')}
            photos={photos}
            busy={busy}
            onMove={(from, to) => void move(from, to)}
            onSetCover={(url) => void makeCover(url)}
            onDelete={remove}
          />
        ) : null}

        <p role="status" className="sr-only" data-testid="property-wizard-photos-announcement">
          {announcement}
        </p>
      </section>

      <section aria-labelledby="property-wizard-listing-title" className="min-w-0 space-y-4 rounded-lg bg-muted p-4">
        <div className="space-y-1">
          <h3 id="property-wizard-listing-title" className="text-base font-semibold">
            {t('propertyWizard.photos.listing.title')}
          </h3>
          <p className="text-sm text-foreground/70">{t('propertyWizard.photos.listing.description')}</p>
        </div>

        <Field
          label={t('propertyWizard.photos.listing.headline.label')}
          optional
          hint={t('propertyWizard.photos.listing.headline.hint')}
          counter={`${titleLength}/${LISTING_TITLE_MAX}`}
          error={formState.errors.listingTitle}
        >
          <Input autoComplete="off" maxLength={LISTING_TITLE_MAX} {...register('listingTitle')} />
        </Field>

        <Field
          label={t('propertyWizard.photos.listing.text.label')}
          optional
          counter={`${descriptionLength}/${LISTING_DESCRIPTION_MAX}`}
          error={formState.errors.description}
        >
          <Textarea rows={5} {...register('description')} />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={suggest} data-testid="property-wizard-suggest">
            <Sparkles aria-hidden="true" className="size-4" />
            {t('propertyWizard.photos.listing.suggest')}
          </Button>
          {previous ? (
            <Button type="button" variant="ghost" onClick={undoSuggestion} data-testid="property-wizard-suggest-undo">
              {t('propertyWizard.photos.listing.undo')}
            </Button>
          ) : null}
        </div>
        {previous ? (
          <p role="status" className="text-sm text-foreground/70">
            {t('propertyWizard.photos.listing.suggested')}
          </p>
        ) : null}
      </section>
    </>
  );
}
