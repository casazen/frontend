import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ComunePicker } from '@/components/shared/comune-picker';
import { FormFieldError } from '@/components/shared/form-field-error';
import type { CreatePropertyDto } from '@/types';
import { DEFAULT_PROPERTY_TIMEZONE } from '../schemas/property.schema';
import { isDuplicateAddressError } from '../property-errors';

const baseShape = {
  name: z.string().min(3, 'property.validation.name.minLength').max(100, 'property.validation.name.maxLength'),
  address: z.string().min(5, 'property.validation.address.required'),
  // The comune is the one thing a property cannot do without afterwards: regional rules, CIN check and tourist tax follow it.
  comuneIstatCode: z.string().regex(/^[0-9]{6}$/, 'property.quick.validation.comuneRequired'),
  city: z.string().min(2, 'property.validation.city.required'),
  postalCode: z.string().min(3, 'property.validation.postalCode.required'),
};

const shortRentSchema = z.object({
  ...baseShape,
  maxGuests: z.number({ message: 'property.validation.maxGuests.min' }).int().min(1, 'property.validation.maxGuests.min').max(100),
  nightlyRate: z.number({ message: 'property.validation.nightlyRate.min' }).min(1, 'property.validation.nightlyRate.min').max(100000),
});
const longRentSchema = z.object(baseShape);

type QuickValues = z.infer<typeof shortRentSchema>;

interface QuickPropertyFormProps {
  variant: 'short-rent' | 'long-rent';
  onSubmit: (dto: CreatePropertyDto) => Promise<void>;
  isLoading: boolean;
  disabled?: boolean;
  /** Link to the complete form, for a host who prefers to fill in everything now. */
  onFullForm: () => void;
}

/**
 * First property of a new host (onboarding): only what the API cannot do without. Everything else (description, photos,
 * CIN, rules, fees) is asked afterwards by the checklist, one step at a time, so the host sees its property in the app
 * within a minute. The same endpoint and defaults as the complete form: nothing is invented, the rest is "not set yet".
 */
export function QuickPropertyForm({ variant, onSubmit, isLoading, disabled, onFullForm }: QuickPropertyFormProps) {
  const { t } = useTranslation();
  const shortStay = variant === 'short-rent';
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<QuickValues>({
    resolver: zodResolver(shortStay ? shortRentSchema : longRentSchema) as never,
    defaultValues: { comuneIstatCode: '', maxGuests: shortStay ? 2 : 0, nightlyRate: shortStay ? undefined : 0 },
  });
  const comuneIstatCode = watch('comuneIstatCode') || null;

  const submit = async (values: QuickValues) => {
    try {
      await onSubmit({
        name: values.name.trim(),
        address: values.address.trim(),
        city: values.city,
        comuneIstatCode: values.comuneIstatCode,
        postalCode: values.postalCode.trim(),
        description: '',
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: shortStay ? values.maxGuests : 0,
        nightlyRate: shortStay ? values.nightlyRate : 0,
        ...(shortStay ? { timezone: DEFAULT_PROPERTY_TIMEZONE } : {}),
      });
    } catch (error) {
      if (isDuplicateAddressError(error)) {
        setError('address', { type: 'server', message: 'property.quick.validation.duplicate' });
        return;
      }
      throw error;
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6" data-testid="quick-property-form">
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name">{t('property.quick.name')}</Label>
            <Input id="name" autoFocus {...register('name')} placeholder={t('property.quick.namePlaceholder')} disabled={disabled} />
            <FormFieldError error={errors.name} />
          </div>
          <div className="space-y-2" data-testid="property-comune-field">
            <Label htmlFor="comune">{t('property.form.comune.label')}</Label>
            <ComunePicker
              id="comune"
              istatCode={comuneIstatCode}
              disabled={disabled}
              describedBy="comune-hint"
              onChange={(comune) => {
                setValue('comuneIstatCode', comune?.istatCode ?? '', { shouldValidate: true });
                if (comune) setValue('city', comune.name, { shouldValidate: true });
              }}
            />
            <p id="comune-hint" className="text-xs text-muted-foreground">{t('property.form.comune.hint')}</p>
            <FormFieldError error={errors.comuneIstatCode ?? errors.city} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">{t('property.form.address')}</Label>
              <Input id="address" {...register('address')} placeholder={t('property.form.placeholder.address')} disabled={disabled} />
              <FormFieldError error={errors.address} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">{t('property.form.postalCode')}</Label>
              <Input id="postalCode" inputMode="numeric" {...register('postalCode')} disabled={disabled} />
              <FormFieldError error={errors.postalCode} />
            </div>
          </div>
          {shortStay && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxGuests">{t('property.form.maxGuests')}</Label>
                <Input id="maxGuests" type="number" min={1} {...register('maxGuests', { valueAsNumber: true })} disabled={disabled} />
                <FormFieldError error={errors.maxGuests} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nightlyRate">{t('property.form.nightlyRate')}</Label>
                <Input
                  id="nightlyRate"
                  type="number"
                  min={1}
                  step="0.01"
                  {...register('nightlyRate', { valueAsNumber: true })}
                  placeholder={t('property.form.placeholder.nightlyRate')}
                  disabled={disabled}
                />
                <p className="text-xs text-muted-foreground">{t('property.quick.rateHint')}</p>
                <FormFieldError error={errors.nightlyRate} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="link" className="h-auto p-0" onClick={onFullForm} data-testid="quick-property-full-form">
          {t('property.quick.fullForm')}
        </Button>
        <Button type="submit" size="lg" disabled={isLoading || disabled} data-testid="quick-property-submit">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {isLoading ? t('property.quick.saving') : t('property.quick.submit')}
        </Button>
      </div>
    </form>
  );
}
