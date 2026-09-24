import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TOURIST_TAX_RATE_VERIFICATIONS,
  type TouristTaxRate,
  type CreateTouristTaxRateDto,
  type TouristTaxRateVerification,
} from '@/types';
import { FormFieldError } from '@/components/shared/form-field-error';

/** Empty inputs become null instead of NaN (`valueAsNumber` would block optional fields). */
const toOptionalNumber = (value: unknown) =>
  value === '' || value === null || value === undefined ? null : Number(value);

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// Messages are i18n keys: FormFieldError translates them when rendering.
const taxRateSchema = z
  .object({
    city: z.string().trim().min(2, 'taxRates.validation.cityRequired').max(100, 'taxRates.validation.cityTooLong'),
    regionCode: z.string().trim().min(2, 'taxRates.validation.regionRequired').max(10, 'taxRates.validation.regionTooLong'),
    ratePerPersonPerNight: z
      .number({ error: 'taxRates.validation.rateMin' })
      .min(0.01, 'taxRates.validation.rateMin')
      .max(1000, 'taxRates.validation.rateMax'),
    maxNights: z
      .number({ error: 'taxRates.validation.maxNightsRange' })
      .int('taxRates.validation.maxNightsRange')
      .min(1, 'taxRates.validation.maxNightsRange')
      .max(365, 'taxRates.validation.maxNightsRange')
      .nullable(),
    minimumAge: z
      .number({ error: 'taxRates.validation.minimumAgeRange' })
      .int('taxRates.validation.minimumAgeRange')
      .min(0, 'taxRates.validation.minimumAgeRange')
      .max(120, 'taxRates.validation.minimumAgeRange'),
    effectiveFrom: z.string().min(1, 'taxRates.validation.effectiveFromRequired'),
    effectiveTo: z.string(),
    notes: z.string().max(500, 'taxRates.validation.notesTooLong'),
    sourceUrl: z
      .string()
      .trim()
      .max(500, 'taxRates.validation.sourceUrlInvalid')
      .refine((value) => value === '' || isHttpUrl(value), 'taxRates.validation.sourceUrlInvalid'),
    verificationLevel: z.union([z.literal(''), z.enum(TOURIST_TAX_RATE_VERIFICATIONS)]),
  })
  .refine((values) => !values.effectiveTo || values.effectiveTo >= values.effectiveFrom, {
    path: ['effectiveTo'],
    message: 'taxRates.validation.effectiveToBeforeFrom',
  });

type TaxRateFormValues = z.infer<typeof taxRateSchema>;

/** `YYYY-MM-DD` of a date sent by the API (UTC midnight of the calendar date). */
function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return '';
  return (typeof value === 'string' ? value : value.toISOString()).slice(0, 10);
}

function toFormValues(existing: TouristTaxRate | null | undefined): TaxRateFormValues {
  if (!existing) {
    return {
      city: '',
      regionCode: '',
      ratePerPersonPerNight: 1,
      maxNights: null,
      minimumAge: 14,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
      notes: '',
      sourceUrl: '',
      verificationLevel: '',
    };
  }

  return {
    city: existing.city,
    regionCode: existing.regionCode,
    ratePerPersonPerNight: existing.ratePerPersonPerNight,
    maxNights: existing.maxNights,
    minimumAge: existing.minimumAge,
    effectiveFrom: toDateInput(existing.effectiveFrom),
    effectiveTo: toDateInput(existing.effectiveTo),
    notes: existing.notes ?? '',
    sourceUrl: existing.sourceUrl ?? '',
    verificationLevel: existing.verificationLevel ?? '',
  };
}

interface TaxRateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rejects when the API call fails: the dialog then stays open with the values typed. */
  onSubmit: (data: CreateTouristTaxRateDto) => Promise<void>;
  isLoading?: boolean;
  existing?: TouristTaxRate | null;
}

export function TaxRateForm({ open, onOpenChange, onSubmit, isLoading, existing }: TaxRateFormProps) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TaxRateFormValues>({
    resolver: zodResolver(taxRateSchema),
    defaultValues: toFormValues(existing),
  });

  // The dialog stays mounted: load the rate being edited (or empty values) every time it opens.
  useEffect(() => {
    if (open) reset(toFormValues(existing));
  }, [open, existing, reset]);

  const onFormSubmit = async (values: TaxRateFormValues) => {
    const payload: CreateTouristTaxRateDto = {
      city: values.city,
      regionCode: values.regionCode,
      ratePerPersonPerNight: values.ratePerPersonPerNight,
      maxNights: values.maxNights,
      minimumAge: values.minimumAge,
      effectiveFrom: values.effectiveFrom,
      effectiveTo: values.effectiveTo || null,
      notes: values.notes || null,
      sourceUrl: values.sourceUrl || null,
      verificationLevel: (values.verificationLevel || null) as TouristTaxRateVerification | null,
      isActive: existing?.isActive ?? true,
    };
    try {
      await onSubmit(payload);
    } catch {
      // The page shows the API error (getProblemMessage); keep the dialog open to fix the values.
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? t('taxRates.edit') : t('taxRates.create')}
          </DialogTitle>
          <DialogDescription>
            {existing ? t('taxRates.editDescription') : t('taxRates.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="city">{t('taxRates.city')} *</Label>
            <Input id="city" {...register('city')} />
            <FormFieldError error={errors.city} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="regionCode">{t('taxRates.region')} *</Label>
            <Input id="regionCode" {...register('regionCode')} />
            <FormFieldError error={errors.regionCode} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ratePerPersonPerNight">{t('taxRates.ratePerNight')} *</Label>
            <Input
              id="ratePerPersonPerNight"
              type="number"
              step="0.01"
              min="0"
              {...register('ratePerPersonPerNight', { setValueAs: toOptionalNumber })}
            />
            <FormFieldError error={errors.ratePerPersonPerNight} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxNights">{t('taxRates.maxNights')}</Label>
              <Input
                id="maxNights"
                type="number"
                min="1"
                {...register('maxNights', { setValueAs: toOptionalNumber })}
              />
              <FormFieldError error={errors.maxNights} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimumAge">{t('taxRates.minimumAge')} *</Label>
              <Input
                id="minimumAge"
                type="number"
                min="0"
                {...register('minimumAge', { setValueAs: toOptionalNumber })}
              />
              <FormFieldError error={errors.minimumAge} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="effectiveFrom">{t('taxRates.effectiveFrom')} *</Label>
            <Input
              id="effectiveFrom"
              type="date"
              {...register('effectiveFrom')}
            />
            <FormFieldError error={errors.effectiveFrom} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effectiveTo">{t('taxRates.effectiveTo')}</Label>
            <Input
              id="effectiveTo"
              type="date"
              {...register('effectiveTo')}
            />
            <FormFieldError error={errors.effectiveTo} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceUrl">{t('taxRates.source')}</Label>
            <Input id="sourceUrl" type="url" placeholder="https://" {...register('sourceUrl')} />
            <FormFieldError error={errors.sourceUrl} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="verificationLevel">{t('taxRates.verification')}</Label>
            <select
              id="verificationLevel"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              {...register('verificationLevel')}
            >
              <option value="">{t('taxRates.verificationLevels.none')}</option>
              {TOURIST_TAX_RATE_VERIFICATIONS.map((level) => (
                <option key={level} value={level}>
                  {t(`taxRates.verificationLevels.${level}`)}
                </option>
              ))}
            </select>
            <FormFieldError error={errors.verificationLevel} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t('taxRates.notes')}</Label>
            <Input id="notes" {...register('notes')} />
            <FormFieldError error={errors.notes} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {t('shared.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('taxRates.saving') : existing ? t('taxRates.update') : t('taxRates.createAction')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
