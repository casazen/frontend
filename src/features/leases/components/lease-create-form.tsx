import { useEffect, useState } from 'react';
import { useForm, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { propertiesApi } from '@/api/properties.api';
import { useProperties } from '@/queries/use-properties';
import { leaseFormSchema } from '../schemas/lease.schema';
import { getFiscalRegimeLabel } from '@/lib/i18n-labels';
import type { LeaseFormValues } from '../schemas/lease.schema';
import type { CreateLeaseDto } from '@/types';
import { AlertTriangle } from 'lucide-react';

interface LeaseCreateFormProps {
  onSubmit: (data: CreateLeaseDto) => void;
  isLoading?: boolean;
}

export function LeaseCreateForm({ onSubmit, isLoading }: LeaseCreateFormProps) {
  const { t } = useTranslation();
  const { data: propertiesData } = useProperties();
  const properties = propertiesData ?? [];
  const [apeError, setApeError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseFormSchema),
    defaultValues: {
      fiscalRegime: 'CedolareSecca',
      landlord: { role: 'Landlord' },
      tenant: { role: 'Tenant' },
    } as LeaseFormValues,
  });

  const selectedPropertyId = watch('propertyId');

  const { data: documents, isFetching: isLoadingDocuments } = useQuery({
    queryKey: ['properties', selectedPropertyId, 'documents'],
    queryFn: () => propertiesApi.getDocuments(selectedPropertyId),
    enabled: !!selectedPropertyId,
  });

  const documentsLoaded = !!selectedPropertyId && !isLoadingDocuments && documents !== undefined;
  const hasApeDocument = documents?.some((doc) => doc.documentType === 'Ape') ?? false;

  useEffect(() => {
    if (documentsLoaded && !hasApeDocument) {
      setApeError(t('leases.form.apeMissingError'));
    } else {
      setApeError(null);
    }
  }, [documentsLoaded, hasApeDocument, t]);

  const handleFormSubmit = (values: LeaseFormValues) => {
    if (!documentsLoaded) {
      setApeError(t('leases.form.waitingDocuments'));
      return;
    }

    if (!hasApeDocument) {
      setApeError(t('leases.form.apeMissingError'));
      return;
    }

    setApeError(null);
    onSubmit({
      propertyId: values.propertyId,
      fiscalRegime: values.fiscalRegime,
      startDate: values.startDate,
      endDate: values.endDate,
      monthlyRent: values.monthlyRent,
      parties: [
        { ...values.landlord, role: 'Landlord' },
        { ...values.tenant, role: 'Tenant' },
      ],
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('leases.form.propertyTermsTitle')}</CardTitle>
          <CardDescription>{t('leases.form.propertyTermsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="propertyId">{t('leases.form.propertyLabel')}</Label>
            <select
              id="propertyId"
              {...register('propertyId')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">{t('leases.form.selectProperty')}</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} — {property.city}
                </option>
              ))}
            </select>
            {errors.propertyId && (
              <p className="text-sm text-destructive">{errors.propertyId.message}</p>
            )}
          </div>

          {apeError && (
            <div
              role="alert"
              className="flex gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{apeError}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fiscalRegime">{t('leases.form.fiscalRegimeLabel')}</Label>
            <select
              id="fiscalRegime"
              {...register('fiscalRegime')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {['CedolareSecca', 'RegimeOrdinario', 'CanoneConcordato'].map((value) => (
                <option key={value} value={value}>
                  {getFiscalRegimeLabel(value, t)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t('leases.form.startDateLabel')}</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">{t('leases.form.endDateLabel')}</Label>
              <Input id="endDate" type="date" {...register('endDate')} />
              {errors.endDate && (
                <p className="text-sm text-destructive">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyRent">{t('leases.form.monthlyRentLabel')}</Label>
            <Input
              id="monthlyRent"
              type="number"
              step="0.01"
              min="0.01"
              {...register('monthlyRent', { valueAsNumber: true })}
            />
            {errors.monthlyRent && (
              <p className="text-sm text-destructive">{errors.monthlyRent.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('leases.form.landlordTitle')}</CardTitle>
          <CardDescription>{t('leases.form.landlordDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <PartyFields prefix="landlord" register={register} errors={errors.landlord} t={t} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('leases.form.tenantTitle')}</CardTitle>
          <CardDescription>{t('leases.form.tenantDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <PartyFields prefix="tenant" register={register} errors={errors.tenant} t={t} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="submit" disabled={isLoading || isLoadingDocuments || !!apeError}>
          {isLoading ? t('leases.form.creating') : t('leases.form.createDraft')}
        </Button>
      </div>
    </form>
  );
}

function PartyFields({
  prefix,
  register,
  errors,
  t,
}: {
  prefix: 'landlord' | 'tenant';
  register: UseFormRegister<LeaseFormValues>;
  errors?: FieldErrors<LeaseFormValues['landlord']> | FieldErrors<LeaseFormValues['tenant']>;
  t: (key: string) => string;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.firstName`}>{t('leases.form.firstNameLabel')}</Label>
        <Input id={`${prefix}.firstName`} {...register(`${prefix}.firstName`)} />
        {errors?.firstName && (
          <p className="text-sm text-destructive">{errors.firstName.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.lastName`}>{t('leases.form.lastNameLabel')}</Label>
        <Input id={`${prefix}.lastName`} {...register(`${prefix}.lastName`)} />
        {errors?.lastName && (
          <p className="text-sm text-destructive">{errors.lastName.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.fiscalCode`}>{t('leases.form.fiscalCodeLabel')}</Label>
        <Input id={`${prefix}.fiscalCode`} {...register(`${prefix}.fiscalCode`)} />
        {errors?.fiscalCode && (
          <p className="text-sm text-destructive">{errors.fiscalCode.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.citizenship`}>{t('leases.form.citizenshipLabel')}</Label>
        <Input
          id={`${prefix}.citizenship`}
          maxLength={2}
          placeholder="IT"
          {...register(`${prefix}.citizenship`)}
        />
        {errors?.citizenship && (
          <p className="text-sm text-destructive">{errors.citizenship.message}</p>
        )}
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${prefix}.contactEmail`}>{t('leases.form.contactEmailLabel')}</Label>
        <Input
          id={`${prefix}.contactEmail`}
          type="email"
          {...register(`${prefix}.contactEmail`)}
        />
        {errors?.contactEmail && (
          <p className="text-sm text-destructive">{errors.contactEmail.message}</p>
        )}
      </div>
    </>
  );
}
