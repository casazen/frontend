import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  guestCheckInFormSchema,
  type GuestCheckInFormValues,
} from '../schemas/checkin.schema';
import { getDocumentTypeLabel, getGenderLabel } from '@/lib/i18n-labels';

const DOCUMENT_TYPES = ['Passport', 'IdentityCard', 'DriversLicense', 'Other'] as const;
const GENDERS = ['Male', 'Female', 'Other'] as const;
import type { CheckInGuestDto } from '@/types/alloggiati.types';

interface GuestDataFormProps {
  guest: CheckInGuestDto;
  onSubmit: (values: GuestCheckInFormValues) => Promise<void>;
  isSubmitting?: boolean;
}

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export function GuestDataForm({ guest, onSubmit, isSubmitting }: GuestDataFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GuestCheckInFormValues>({
    resolver: zodResolver(guestCheckInFormSchema),
    defaultValues: {
      dateOfBirth: toDateInputValue(guest.dateOfBirth),
      placeOfBirth: guest.placeOfBirth ?? '',
      nationality: guest.nationality ?? '',
      gender: guest.gender ?? undefined,
      documentType: guest.documentType ?? undefined,
      documentNumber: guest.documentNumber ?? '',
      documentExpiryDate: toDateInputValue(guest.documentExpiryDate),
      documentIssuingCountry: guest.documentIssuingCountry ?? '',
      address: guest.address ?? '',
      city: guest.city ?? '',
      postalCode: guest.postalCode ?? '',
      country: guest.country ?? '',
      consentAccepted: false,
    },
  });

  const consentAccepted = watch('consentAccepted');

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      data-testid="guest-data-form"
    >
      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        <p className="font-medium">
          {guest.firstName} {guest.lastName}
        </p>
        <p className="text-muted-foreground">{guest.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Data di nascita *</Label>
          <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
          {errors.dateOfBirth && (
            <p className="text-sm text-destructive">{errors.dateOfBirth.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="placeOfBirth">Luogo di nascita *</Label>
          <Input id="placeOfBirth" {...register('placeOfBirth')} />
          {errors.placeOfBirth && (
            <p className="text-sm text-destructive">{errors.placeOfBirth.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nationality">Nazionalità *</Label>
          <Input id="nationality" {...register('nationality')} />
          {errors.nationality && (
            <p className="text-sm text-destructive">{errors.nationality.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">Sesso *</Label>
          <select id="gender" {...register('gender')} className={selectClassName}>
            <option value="">Seleziona</option>
            {GENDERS.map((value) => (
              <option key={value} value={value}>
                {getGenderLabel(value, t)}
              </option>
            ))}
          </select>
          {errors.gender && (
            <p className="text-sm text-destructive">{errors.gender.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="documentType">Tipo documento *</Label>
          <select id="documentType" {...register('documentType')} className={selectClassName}>
            <option value="">Seleziona</option>
            {DOCUMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {getDocumentTypeLabel(value, t)}
              </option>
            ))}
          </select>
          {errors.documentType && (
            <p className="text-sm text-destructive">{errors.documentType.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="documentNumber">Numero documento *</Label>
          <Input id="documentNumber" {...register('documentNumber')} />
          {errors.documentNumber && (
            <p className="text-sm text-destructive">{errors.documentNumber.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="documentExpiryDate">Scadenza documento</Label>
          <Input id="documentExpiryDate" type="date" {...register('documentExpiryDate')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="documentIssuingCountry">Paese di rilascio *</Label>
          <Input id="documentIssuingCountry" {...register('documentIssuingCountry')} />
          {errors.documentIssuingCountry && (
            <p className="text-sm text-destructive">{errors.documentIssuingCountry.message}</p>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Indirizzo</Label>
          <Input id="address" {...register('address')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">Città</Label>
          <Input id="city" {...register('city')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postalCode">CAP</Label>
          <Input id="postalCode" {...register('postalCode')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Paese di residenza</Label>
          <Input id="country" {...register('country')} />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border p-4" data-testid="checkin-gdpr-consent">
        <Checkbox
          id="consentAccepted"
          checked={consentAccepted === true}
          onCheckedChange={(value) => setValue('consentAccepted', value === true, { shouldValidate: true })}
        />
        <Label htmlFor="consentAccepted" className="text-sm leading-relaxed cursor-pointer">
          Acconsento al trattamento dei miei dati personali per adempiere all&apos;obbligo di
          comunicazione alla Questura (Art. 109 TULPS), in conformità con l&apos;informativa privacy
          dell&apos;operatore.
        </Label>
      </div>
      {errors.consentAccepted && (
        <p className="text-sm text-destructive">{errors.consentAccepted.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Salvataggio…' : 'Salva dati'}
      </Button>
    </form>
  );
}
