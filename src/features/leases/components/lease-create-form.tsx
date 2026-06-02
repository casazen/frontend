import { useEffect, useState } from 'react';
import { useForm, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { propertiesApi } from '@/api/properties.api';
import { useProperties } from '@/queries/use-properties';
import { FISCAL_REGIME_LABELS, leaseFormSchema } from '../schemas/lease.schema';
import type { LeaseFormValues } from '../schemas/lease.schema';
import type { CreateLeaseDto } from '@/types';
import { AlertTriangle } from 'lucide-react';

interface LeaseCreateFormProps {
  onSubmit: (data: CreateLeaseDto) => void;
  isLoading?: boolean;
}

export function LeaseCreateForm({ onSubmit, isLoading }: LeaseCreateFormProps) {
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
      setApeError(
        'An APE (energy performance certificate) document must be uploaded for this property before creating a lease.'
      );
    } else {
      setApeError(null);
    }
  }, [documentsLoaded, hasApeDocument]);

  const handleFormSubmit = (values: LeaseFormValues) => {
    if (!documentsLoaded) {
      setApeError('Please wait while property documents are being verified.');
      return;
    }

    if (!hasApeDocument) {
      setApeError(
        'An APE (energy performance certificate) document must be uploaded for this property before creating a lease.'
      );
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
          <CardTitle>Property &amp; terms</CardTitle>
          <CardDescription>Select the property and define lease terms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="propertyId">Property *</Label>
            <select
              id="propertyId"
              {...register('propertyId')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select a property</option>
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
            <Label htmlFor="fiscalRegime">Fiscal regime *</Label>
            <select
              id="fiscalRegime"
              {...register('fiscalRegime')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {Object.entries(FISCAL_REGIME_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date *</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End date *</Label>
              <Input id="endDate" type="date" {...register('endDate')} />
              {errors.endDate && (
                <p className="text-sm text-destructive">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyRent">Monthly rent (€) *</Label>
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
          <CardTitle>Landlord</CardTitle>
          <CardDescription>Contract party — property owner or representative</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <PartyFields prefix="landlord" register={register} errors={errors.landlord} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenant</CardTitle>
          <CardDescription>Contract party — lessee</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <PartyFields prefix="tenant" register={register} errors={errors.tenant} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="submit" disabled={isLoading || isLoadingDocuments || !!apeError}>
          {isLoading ? 'Creating…' : 'Create lease draft'}
        </Button>
      </div>
    </form>
  );
}

function PartyFields({
  prefix,
  register,
  errors,
}: {
  prefix: 'landlord' | 'tenant';
  register: UseFormRegister<LeaseFormValues>;
  errors?: FieldErrors<LeaseFormValues['landlord']> | FieldErrors<LeaseFormValues['tenant']>;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.firstName`}>First name *</Label>
        <Input id={`${prefix}.firstName`} {...register(`${prefix}.firstName`)} />
        {errors?.firstName && (
          <p className="text-sm text-destructive">{errors.firstName.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.lastName`}>Last name *</Label>
        <Input id={`${prefix}.lastName`} {...register(`${prefix}.lastName`)} />
        {errors?.lastName && (
          <p className="text-sm text-destructive">{errors.lastName.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.fiscalCode`}>Fiscal code *</Label>
        <Input id={`${prefix}.fiscalCode`} {...register(`${prefix}.fiscalCode`)} />
        {errors?.fiscalCode && (
          <p className="text-sm text-destructive">{errors.fiscalCode.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.citizenship`}>Citizenship (ISO) *</Label>
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
        <Label htmlFor={`${prefix}.contactEmail`}>Contact email *</Label>
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
