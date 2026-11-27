import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PHOTO_CAPTION_MAX, photoMetaOf, withPhotoMeta } from '@/lib/listing-photos';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import { usePropertyRooms } from '@/queries/use-listing-data';
import type { PropertyRoom } from '@/types';
import type { PropertyWizardValues } from '../property-wizard-model';
import { roomOptionLabel } from '../rooms-model';

interface PhotoDetailsProps {
  form: UseFormReturn<PropertyWizardValues>;
  propertyId: string;
  /** The photos the person sees, in display order. */
  photos: readonly string[];
}

/**
 * The caption and the room of each photo (NF-32), under the gallery: the caption is the alternative text of the photo, in Italian and in
 * English (the English one needs the Italian one), and the room is one of the rooms of the property as saved in the first step. The
 * answers are fields of the wizard; the step saves them with «Avanti» like the rest. A photo with no caption and no room is a photo the
 * channels take as it is.
 */
export function PhotoDetails({ form, propertyId, photos }: PhotoDetailsProps) {
  const { t } = useTranslation();
  const rooms = usePropertyRooms(propertyId);
  const stored: readonly PropertyRoom[] = rooms.data ?? [];
  const meta = form.watch('photoMeta');
  const { errors } = form.formState;

  const change = (url: string, patch: Partial<{ altIt: string; altEn: string; roomId: string }>) =>
    form.setValue('photoMeta', withPhotoMeta(form.getValues('photoMeta'), url, patch), { shouldDirty: true });

  return (
    <section aria-labelledby="property-wizard-photo-details-title" className="min-w-0 space-y-4" data-testid="property-wizard-photo-details">
      <div className="space-y-1">
        <h3 id="property-wizard-photo-details-title" className="text-base font-semibold">
          {t('propertyWizard.photos.details.title')}
        </h3>
        <p className="text-sm text-foreground/70">{t('propertyWizard.photos.details.hint')}</p>
      </div>

      <ul className="space-y-5">
        {photos.map((url, index) => {
          const position = index + 1;
          const current = photoMetaOf(meta, url);
          const problems = errors.photoMeta?.[meta.findIndex((entry) => entry.url === url)];
          const roomIsStored = current.roomId === '' || stored.some((room) => room.id === current.roomId);

          return (
            <li key={url} className="grid min-w-0 gap-3 sm:grid-cols-[5rem_minmax(0,1fr)]" data-testid="property-wizard-photo-detail">
              {isDisplayableMediaUrl(url) ? (
                <img src={url} alt="" loading="lazy" className="aspect-[4/3] w-20 rounded-md bg-muted object-cover" />
              ) : (
                <div aria-hidden="true" className="grid aspect-[4/3] w-20 place-items-center rounded-md bg-muted text-foreground/70">
                  <ImageOff className="size-6" />
                </div>
              )}
              <div className="min-w-0 space-y-3">
                <p className="text-sm font-medium">{t('propertyWizard.photos.details.photo', { index: position })}</p>
                <div className="grid min-w-0 gap-3 md:grid-cols-2">
                  <Field label={t('propertyWizard.photos.details.captionIt')} error={problems?.altIt} optional>
                    <Input
                      autoComplete="off"
                      lang="it"
                      maxLength={PHOTO_CAPTION_MAX}
                      value={current.altIt}
                      onChange={(event) => change(url, { altIt: event.target.value })}
                      data-testid="property-wizard-photo-caption-it"
                    />
                  </Field>
                  <Field label={t('propertyWizard.photos.details.captionEn')} error={problems?.altEn} optional>
                    <Input
                      autoComplete="off"
                      lang="en"
                      maxLength={PHOTO_CAPTION_MAX}
                      value={current.altEn}
                      onChange={(event) => change(url, { altEn: event.target.value })}
                      data-testid="property-wizard-photo-caption-en"
                    />
                  </Field>
                </div>
                <Field
                  label={t('propertyWizard.photos.details.room')}
                  optional
                  hint={rooms.isError ? t('propertyWizard.photos.details.roomsFailed') : stored.length === 0 && !rooms.isLoading ? t('propertyWizard.photos.details.noRooms') : undefined}
                  className="max-w-md"
                >
                  <Select
                    value={roomIsStored ? current.roomId : ''}
                    disabled={stored.length === 0}
                    onChange={(event) => change(url, { roomId: event.target.value })}
                    data-testid="property-wizard-photo-room"
                  >
                    <option value="">{t('propertyWizard.photos.details.roomNone')}</option>
                    {stored.map((room, roomIndex) => (
                      <option key={room.id} value={room.id}>
                        {roomOptionLabel(t, room, roomIndex)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
