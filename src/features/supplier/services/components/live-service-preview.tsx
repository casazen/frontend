import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { priceInputOf, type ServiceFormValues } from '../lib/service-form';
import { formatDuration, formatPrice } from '../lib/service-labels';
import { ServicePreviewCard } from './service-preview-card';

/**
 * The preview card of the form it is in: it follows what is typed, before anything is saved. The cover is the first photo of
 * the saved service (photos are saved as they are added, not with the form).
 */
export function LiveServicePreview({ photoUrl }: { photoUrl?: string | null }) {
  const { t, i18n } = useTranslation();
  const { control } = useFormContext<ServiceFormValues>();
  const values = useWatch({ control });

  return (
    <ServicePreviewCard
      name={values.name ?? ''}
      summary={values.summary ?? ''}
      categoryLabel={values.category ? getServiceCategoryLabel(values.category, t) : undefined}
      priceLabel={formatPrice(priceInputOf({ priceMode: values.priceMode ?? 'fixed', fixedUnit: values.fixedUnit ?? 'PerJob', amount: values.amount ?? '' }), t, i18n.language)}
      durationLabel={formatDuration(values.durationMinutes ?? null, t)}
      includesVat={values.pricesIncludeVat ?? false}
      supplementCount={(values.supplements ?? []).filter((supplement) => (supplement?.label ?? '').trim() !== '').length}
      photoUrl={photoUrl}
    />
  );
}
