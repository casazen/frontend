import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
  TOURIST_TAX_CALCULATION_METHODS,
  TOURIST_TAX_RATE_VERIFICATIONS,
  type TouristTaxRate,
  type CreateTouristTaxRateDto,
  type TouristTaxRateVerification,
} from '@/types';
import { FormFieldError } from '@/components/shared/form-field-error';
import { todayInRome, utcStayDate } from '@/lib/stay-dates';

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

/** `MM-dd` of a real day (29 February included), as the backend `TouristTaxSeason`. */
function isSeasonDay(value: string): boolean {
  const match = /^(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[1]);
  const day = Number(match[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(2024, month, 0)).getUTCDate();
}

const optionalAmount = (max: number, message: string) =>
  z.number({ error: message }).min(0.01, message).max(max, message).nullable();

// Messages are i18n keys: FormFieldError translates them when rendering.
const taxRateSchema = z
  .object({
    city: z.string().trim().min(2, 'taxRates.validation.cityRequired').max(100, 'taxRates.validation.cityTooLong'),
    regionCode: z.string().trim().min(2, 'taxRates.validation.regionRequired').max(10, 'taxRates.validation.regionTooLong'),
    istatCode: z
      .string()
      .trim()
      .refine((value) => value === '' || /^[0-9]{6}$/.test(value), 'taxRates.validation.istatCodeInvalid'),
    accommodationCategory: z.string().trim().max(100, 'taxRates.validation.categoryTooLong'),
    seasonStart: z.string().trim(),
    seasonEnd: z.string().trim(),
    calculationMethod: z.enum(TOURIST_TAX_CALCULATION_METHODS),
    ratePerPersonPerNight: z
      .number({ error: 'taxRates.validation.rateMin' })
      .min(0, 'taxRates.validation.rateMin')
      .max(1000, 'taxRates.validation.rateMax'),
    percentOfNightlyPrice: optionalAmount(100, 'taxRates.validation.percentRange'),
    capPerPersonPerNight: optionalAmount(1000, 'taxRates.validation.capRange'),
    reducedRateMaxAge: z
      .number({ error: 'taxRates.validation.reducedInvalid' })
      .int('taxRates.validation.reducedInvalid')
      .min(0, 'taxRates.validation.reducedInvalid')
      .max(17, 'taxRates.validation.reducedInvalid')
      .nullable(),
    reducedRatePerPersonPerNight: optionalAmount(1000, 'taxRates.validation.reducedInvalid'),
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
      .max(18, 'taxRates.validation.minimumAgeRange'),
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
  .superRefine((values, ctx) => {
    if (values.effectiveTo && values.effectiveTo < values.effectiveFrom) {
      ctx.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'taxRates.validation.effectiveToBeforeFrom' });
    }
    const percentage = values.calculationMethod === 'PercentOfNightlyPrice';
    if (!percentage && values.ratePerPersonPerNight < 0.01) {
      ctx.addIssue({ code: 'custom', path: ['ratePerPersonPerNight'], message: 'taxRates.validation.rateMin' });
    }
    if (percentage && values.percentOfNightlyPrice === null) {
      ctx.addIssue({ code: 'custom', path: ['percentOfNightlyPrice'], message: 'taxRates.validation.percentRange' });
    }
    const hasSeason = values.seasonStart !== '' || values.seasonEnd !== '';
    if (hasSeason && !(isSeasonDay(values.seasonStart) && isSeasonDay(values.seasonEnd))) {
      ctx.addIssue({ code: 'custom', path: ['seasonStart'], message: 'taxRates.validation.seasonInvalid' });
    }
    const hasReducedAge = values.reducedRateMaxAge !== null;
    const hasReducedAmount = values.reducedRatePerPersonPerNight !== null;
    if (
      hasReducedAge !== hasReducedAmount ||
      (hasReducedAge && (percentage || (values.reducedRateMaxAge ?? 0) < values.minimumAge))
    ) {
      ctx.addIssue({ code: 'custom', path: ['reducedRateMaxAge'], message: 'taxRates.validation.reducedInvalid' });
    }
  });

type TaxRateFormValues = z.infer<typeof taxRateSchema>;

/** `YYYY-MM-DD` of a date sent by the API (UTC midnight of the calendar date). */
function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value.slice(0, 10) : utcStayDate(value);
}

function toFormValues(existing: TouristTaxRate | null | undefined): TaxRateFormValues {
  if (!existing) {
    return {
      city: '',
      regionCode: '',
      istatCode: '',
      accommodationCategory: '',
      seasonStart: '',
      seasonEnd: '',
      calculationMethod: 'PerPersonPerNight',
      ratePerPersonPerNight: 1,
      percentOfNightlyPrice: null,
      capPerPersonPerNight: null,
      reducedRateMaxAge: null,
      reducedRatePerPersonPerNight: null,
      maxNights: null,
      minimumAge: 14,
      effectiveFrom: todayInRome(),
      effectiveTo: '',
      notes: '',
      sourceUrl: '',
      verificationLevel: '',
    };
  }

  return {
    city: existing.city,
    regionCode: existing.regionCode,
    istatCode: existing.istatCode ?? '',
    accommodationCategory: existing.accommodationCategory ?? '',
    seasonStart: existing.seasonStart ?? '',
    seasonEnd: existing.seasonEnd ?? '',
    calculationMethod: existing.calculationMethod ?? 'PerPersonPerNight',
    ratePerPersonPerNight: existing.ratePerPersonPerNight,
    percentOfNightlyPrice: existing.percentOfNightlyPrice ?? null,
    capPerPersonPerNight: existing.capPerPersonPerNight ?? null,
    reducedRateMaxAge: existing.reducedRateMaxAge ?? null,
    reducedRatePerPersonPerNight: existing.reducedRatePerPersonPerNight ?? null,
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
    control,
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

  const percentage = useWatch({ control, name: 'calculationMethod' }) === 'PercentOfNightlyPrice';

  const onFormSubmit = async (values: TaxRateFormValues) => {
    const isPercentage = values.calculationMethod === 'PercentOfNightlyPrice';
    const payload: CreateTouristTaxRateDto = {
      city: values.city,
      regionCode: values.regionCode,
      istatCode: values.istatCode || null,
      accommodationCategory: values.accommodationCategory || null,
      seasonStart: values.seasonStart || null,
      seasonEnd: values.seasonEnd || null,
      calculationMethod: values.calculationMethod,
      ratePerPersonPerNight: isPercentage ? 0 : values.ratePerPersonPerNight,
      percentOfNightlyPrice: isPercentage ? values.percentOfNightlyPrice : null,
      capPerPersonPerNight: isPercentage ? values.capPerPersonPerNight : null,
      reducedRateMaxAge: isPercentage ? null : values.reducedRateMaxAge,
      reducedRatePerPersonPerNight: isPercentage ? null : values.reducedRatePerPersonPerNight,
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="istatCode">{t('taxRates.istatCode')}</Label>
              <Input id="istatCode" inputMode="numeric" maxLength={6} {...register('istatCode')} />
              <FormFieldError error={errors.istatCode} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accommodationCategory">{t('taxRates.category')}</Label>
              <Input
                id="accommodationCategory"
                placeholder={t('taxRates.categoryPlaceholder')}
                {...register('accommodationCategory')}
              />
              <FormFieldError error={errors.accommodationCategory} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="calculationMethod">{t('taxRates.calculationMethod')} *</Label>
            <select
              id="calculationMethod"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              {...register('calculationMethod')}
            >
              {TOURIST_TAX_CALCULATION_METHODS.map((method) => (
                <option key={method} value={method}>
                  {t(`taxRates.calculationMethods.${method}`)}
                </option>
              ))}
            </select>
          </div>

          {percentage ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="percentOfNightlyPrice">{t('taxRates.percentOfNightlyPrice')} *</Label>
                <Input
                  id="percentOfNightlyPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('percentOfNightlyPrice', { setValueAs: toOptionalNumber })}
                />
                <FormFieldError error={errors.percentOfNightlyPrice} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capPerPersonPerNight">{t('taxRates.capPerPersonPerNight')}</Label>
                <Input
                  id="capPerPersonPerNight"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('capPerPersonPerNight', { setValueAs: toOptionalNumber })}
                />
                <FormFieldError error={errors.capPerPersonPerNight} />
              </div>
            </div>
          ) : (
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
          )}

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

          {!percentage && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reducedRateMaxAge">{t('taxRates.reducedRateMaxAge')}</Label>
                <Input
                  id="reducedRateMaxAge"
                  type="number"
                  min="0"
                  max="17"
                  {...register('reducedRateMaxAge', { setValueAs: toOptionalNumber })}
                />
                <FormFieldError error={errors.reducedRateMaxAge} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reducedRatePerPersonPerNight">{t('taxRates.reducedRatePerPersonPerNight')}</Label>
                <Input
                  id="reducedRatePerPersonPerNight"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('reducedRatePerPersonPerNight', { setValueAs: toOptionalNumber })}
                />
                <FormFieldError error={errors.reducedRatePerPersonPerNight} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="seasonStart">{t('taxRates.seasonStart')}</Label>
              <Input id="seasonStart" placeholder={t('taxRates.seasonPlaceholder')} maxLength={5} {...register('seasonStart')} />
              <FormFieldError error={errors.seasonStart} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seasonEnd">{t('taxRates.seasonEnd')}</Label>
              <Input id="seasonEnd" placeholder={t('taxRates.seasonPlaceholder')} maxLength={5} {...register('seasonEnd')} />
              <FormFieldError error={errors.seasonEnd} />
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
