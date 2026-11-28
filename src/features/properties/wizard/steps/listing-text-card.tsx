import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Lightbulb } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ListingAiDialog } from './listing-ai-dialog';
import type { PropertyWizardValues } from '../property-wizard-model';
import { LISTING_DESCRIPTION_MAX, LISTING_TITLE_MAX } from '../suggest-listing-text';

const FEW_PHOTOS = 3;

interface ListingTextCardProps {
  form: UseFormReturn<PropertyWizardValues>;
  propertyId: string;
  photos: readonly string[];
  optional?: boolean;
}

export function ListingTextCard({ form, propertyId, photos, optional = false }: ListingTextCardProps) {
  const { t } = useTranslation();
  const { register, watch, formState } = form;
  const titleLength = watch('listingTitle').length;
  const descriptionLength = watch('description').length;

  const tip =
    photos.length === 0
      ? t('propertyWizard.photos.listing.tips.noPhotos')
      : photos.length < FEW_PHOTOS
        ? t('propertyWizard.photos.listing.tips.fewPhotos', { count: FEW_PHOTOS })
        : null;

  return (
    <section aria-labelledby="property-wizard-listing-title" className="min-w-0 space-y-4 rounded-lg bg-muted p-4">
      <div className="space-y-1">
        <h3 id="property-wizard-listing-title" className="text-base font-semibold">
          {t('propertyWizard.photos.listing.title')}
        </h3>
        <p className="text-sm text-foreground/70">{t('propertyWizard.photos.listing.description')}</p>
      </div>

      <Field
        label={t('propertyWizard.photos.listing.headline.label')}
        optional={optional}
        hint={t('propertyWizard.photos.listing.headline.hint')}
        counter={`${titleLength}/${LISTING_TITLE_MAX}`}
        error={formState.errors.listingTitle}
      >
        <Input autoComplete="off" maxLength={LISTING_TITLE_MAX} {...register('listingTitle')} />
      </Field>

      <Field
        label={t('propertyWizard.photos.listing.text.label')}
        optional={optional}
        counter={`${descriptionLength}/${LISTING_DESCRIPTION_MAX}`}
        error={formState.errors.description}
      >
        <Textarea rows={8} {...register('description')} />
      </Field>

      <ListingAiDialog form={form} propertyId={propertyId} photos={photos} />

      {tip ? (
        <p className="flex items-start gap-2 text-sm text-foreground/70" data-testid="property-wizard-suggest-tip">
          <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{tip}</span>
        </p>
      ) : null}
    </section>
  );
}
