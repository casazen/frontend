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
import type { TouristTaxRate, CreateTouristTaxRateDto, UpdateTouristTaxRateDto } from '@/types';

const taxRateSchema = z.object({
  city: z.string().min(2, 'La città è obbligatoria'),
  regionCode: z.string().min(2, 'La regione è obbligatoria'),
  ratePerPersonPerNight: z.number().min(0.01, 'La tariffa deve essere maggiore di 0'),
  maxNights: z.number().min(0).optional().nullable(),
  minimumAge: z.number().min(0).optional(),
  effectiveFrom: z.string().min(1, 'La data di entrata in vigore è obbligatoria'),
  effectiveTo: z.string().optional().nullable(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

type TaxRateFormValues = z.infer<typeof taxRateSchema>;

interface TaxRateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateTouristTaxRateDto | UpdateTouristTaxRateDto) => Promise<void>;
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
    defaultValues: existing
      ? {
          city: existing.city,
          regionCode: existing.regionCode,
          ratePerPersonPerNight: existing.ratePerPersonPerNight,
          maxNights: existing.maxNights,
          minimumAge: existing.minimumAge,
          effectiveFrom:
            typeof existing.effectiveFrom === 'string'
              ? existing.effectiveFrom.slice(0, 10)
              : '',
          effectiveTo:
            typeof existing.effectiveTo === 'string'
              ? existing.effectiveTo.slice(0, 10)
              : existing.effectiveTo
                ? String(existing.effectiveTo).slice(0, 10)
                : '',
          notes: existing.notes ?? '',
          isActive: existing.isActive,
        }
      : {
          city: '',
          regionCode: '',
          ratePerPersonPerNight: 1.0,
          maxNights: null,
          minimumAge: 14,
          effectiveFrom: new Date().toISOString().slice(0, 10),
          effectiveTo: null,
          notes: '',
          isActive: true,
        },
  });

  const onFormSubmit = async (values: TaxRateFormValues) => {
    const payload: CreateTouristTaxRateDto | UpdateTouristTaxRateDto = {
      city: values.city,
      regionCode: values.regionCode,
      ratePerPersonPerNight: values.ratePerPersonPerNight,
      maxNights: values.maxNights ?? undefined,
      minimumAge: values.minimumAge,
      effectiveFrom: values.effectiveFrom,
      effectiveTo: values.effectiveTo || undefined,
      notes: values.notes || undefined,
      isActive: values.isActive ?? true,
    };
    await onSubmit(payload);
    reset();
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

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="city">{t('taxRates.city')} *</Label>
            <Input id="city" {...register('city')} />
            {errors.city && (
              <p className="text-sm text-destructive">{errors.city.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="regionCode">{t('taxRates.region')} *</Label>
            <Input id="regionCode" {...register('regionCode')} />
            {errors.regionCode && (
              <p className="text-sm text-destructive">{errors.regionCode.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ratePerPersonPerNight">{t('taxRates.ratePerNight')} *</Label>
            <Input
              id="ratePerPersonPerNight"
              type="number"
              step="0.01"
              min="0"
              {...register('ratePerPersonPerNight', { valueAsNumber: true })}
            />
            {errors.ratePerPersonPerNight && (
              <p className="text-sm text-destructive">{errors.ratePerPersonPerNight.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxNights">{t('taxRates.maxNights')}</Label>
              <Input
                id="maxNights"
                type="number"
                min="0"
                {...register('maxNights', { valueAsNumber: true })}
              />
              {errors.maxNights && (
                <p className="text-sm text-destructive">{errors.maxNights.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimumAge">{t('taxRates.minimumAge')}</Label>
              <Input
                id="minimumAge"
                type="number"
                min="0"
                {...register('minimumAge', { valueAsNumber: true })}
              />
              {errors.minimumAge && (
                <p className="text-sm text-destructive">{errors.minimumAge.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="effectiveFrom">{t('taxRates.effectiveFrom')} *</Label>
            <Input
              id="effectiveFrom"
              type="date"
              {...register('effectiveFrom')}
            />
            {errors.effectiveFrom && (
              <p className="text-sm text-destructive">{errors.effectiveFrom.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="effectiveTo">{t('taxRates.effectiveTo')}</Label>
            <Input
              id="effectiveTo"
              type="date"
              {...register('effectiveTo')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t('taxRates.notes')}</Label>
            <Input id="notes" {...register('notes')} />
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
