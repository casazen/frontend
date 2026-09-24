import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { getLeaseContractTypeLabel, getLeaseTaxRegimeLabel } from '@/lib/i18n-labels';
import { getProblemMessage } from '@/lib/api-errors';
import { LONG_RENT_PROPERTY_CREATE_PATH, longRentPropertyPath } from '@/features/properties/long-rent/paths';
import type { LeaseFormValues } from '../schemas/lease.schema';
import { LEASE_CONTRACT_TYPES, LEASE_TAX_REGIMES, type ConcordatoCharacteristics, type CreateLeaseDto } from '@/types';
import { AlertTriangle } from 'lucide-react';
import { CanoneConcordatoCalculator, type ConcordatoRange } from './canone-concordato-calculator';
import { isRentInConcordatoRange } from '../lib/concordato-rent-range';
import { FormFieldError } from '@/components/shared/form-field-error';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface LeaseCreateFormProps {
  onSubmit: (data: CreateLeaseDto) => void;
  isLoading?: boolean;
  /** Property preselected once the list is loaded (link "new lease" of a property page). */
  defaultPropertyId?: string;
}

export function LeaseCreateForm({ onSubmit, isLoading, defaultPropertyId }: LeaseCreateFormProps) {
  const { t } = useTranslation();
  const {
    data: propertiesData,
    isLoading: isLoadingProperties,
    isError: propertiesFailed,
    error: propertiesError,
    refetch: refetchProperties,
    isFetching: isFetchingProperties,
  } = useProperties();
  const properties = propertiesData ?? [];
  // A failed load (e.g. 403) is an explicit error, never an empty list to pick from (A7-06).
  const noProperties = !isLoadingProperties && !propertiesFailed && propertiesData !== undefined && properties.length === 0;
  const [apeError, setApeError] = useState<string | null>(null);
  const [concordatoRange, setConcordatoRange] = useState<ConcordatoRange | null>(null);
  const [concordatoCharacteristics, setConcordatoCharacteristics] = useState<ConcordatoCharacteristics | null>(null);
  const [concordatoError, setConcordatoError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseFormSchema),
    defaultValues: {
      contractType: 'Libero',
      taxRegime: 'CedolareSecca',
      landlord: { role: 'Landlord' },
      tenant: { role: 'Tenant' },
    } as LeaseFormValues,
  });

  const selectedPropertyId = watch('propertyId');
  const contractType = watch('contractType');
  const isConcordato = contractType === 'Concordato';
  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const monthlyRent = watch('monthlyRent');
  // The range comes from the API (A7-12); with unconfirmed agreement data it is only a guide (A7-23).
  const rentOutsideRange =
    isConcordato &&
    !!concordatoRange &&
    monthlyRent > 0 &&
    !isRentInConcordatoRange(monthlyRent, concordatoRange.minMonthly, concordatoRange.maxMonthly);

  const {
    data: documents,
    isFetching: isLoadingDocuments,
    isError: documentsFailed,
    error: documentsError,
    refetch: refetchDocuments,
  } = useQuery({
    queryKey: ['properties', selectedPropertyId, 'documents'],
    queryFn: () => propertiesApi.getDocuments(selectedPropertyId),
    enabled: !!selectedPropertyId,
  });

  const documentsLoaded = !!selectedPropertyId && !isLoadingDocuments && !documentsFailed && documents !== undefined;
  const hasApeDocument = documents?.some((doc) => doc.documentType === 'Ape') ?? false;
  const apeMissing = documentsLoaded && !hasApeDocument;

  useEffect(() => {
    if (defaultPropertyId && propertiesData?.some((property) => property.id === defaultPropertyId)) {
      setValue('propertyId', defaultPropertyId, { shouldValidate: false });
    }
  }, [defaultPropertyId, propertiesData, setValue]);

  useEffect(() => {
    if (documentsLoaded && !hasApeDocument) {
      setApeError(t('leases.form.apeMissingError'));
    } else {
      setApeError(null);
    }
  }, [documentsLoaded, hasApeDocument, t]);

  // A new range (or none, after an input changed) supersedes the message of the last refused submit.
  const handleRangeChange = useCallback((range: ConcordatoRange | null) => {
    setConcordatoRange(range);
    setConcordatoError(null);
  }, []);

  const handleFormSubmit = (values: LeaseFormValues) => {
    if (documentsFailed) {
      return;
    }

    if (!documentsLoaded) {
      setApeError(t('leases.form.waitingDocuments'));
      return;
    }

    if (!hasApeDocument) {
      setApeError(t('leases.form.apeMissingError'));
      return;
    }

    if (values.contractType === 'Concordato') {
      // The API computes the range again from the same data; the form asks for it first so the landlord sees it.
      if (!concordatoRange || !concordatoCharacteristics) {
        setConcordatoError(t('leases.form.concordatoRangeRequired'));
        return;
      }
      // Verified data: the API refuses a rent outside the range, so the form does too. Partial data: a warning only.
      if (
        !concordatoRange.indicative &&
        !isRentInConcordatoRange(values.monthlyRent, concordatoRange.minMonthly, concordatoRange.maxMonthly)
      ) {
        setConcordatoError(t('leases.form.concordatoRentOutOfRange'));
        return;
      }
    }

    setApeError(null);
    setConcordatoError(null);
    onSubmit({
      propertyId: values.propertyId,
      contractType: values.contractType,
      taxRegime: values.taxRegime,
      startDate: values.startDate,
      endDate: values.endDate,
      monthlyRent: values.monthlyRent,
      securityDeposit: values.securityDeposit ?? null,
      parties: [
        { ...values.landlord, role: 'Landlord' },
        { ...values.tenant, role: 'Tenant' },
      ],
      ...(values.contractType === 'Concordato' && concordatoCharacteristics
        ? { canoneConcordato: concordatoCharacteristics }
        : {}),
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
            {propertiesFailed ? (
              <>
                <Label>{t('leases.form.propertyLabel')}</Label>
                <div
                  role="alert"
                  data-testid="lease-properties-error"
                  className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="flex-1">
                    {getProblemMessage(propertiesError, t) ?? t('leases.form.propertiesLoadError')}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void refetchProperties()}
                    disabled={isFetchingProperties}
                  >
                    {t('leases.form.retry')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Label htmlFor="propertyId">{t('leases.form.propertyLabel')}</Label>
                <select
                  id="propertyId"
                  {...register('propertyId')}
                  aria-busy={isLoadingProperties}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">
                    {isLoadingProperties ? t('leases.form.propertiesLoading') : t('leases.form.selectProperty')}
                  </option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name} — {property.city}
                    </option>
                  ))}
                </select>
                {noProperties && (
                  <div
                    role="status"
                    data-testid="lease-no-properties"
                    className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
                  >
                    <span className="flex-1">{t('leases.form.noProperties')}</span>
                    <Button asChild variant="outline" size="sm">
                      <Link to={LONG_RENT_PROPERTY_CREATE_PATH}>{t('leases.form.createProperty')}</Link>
                    </Button>
                  </div>
                )}
              </>
            )}
            <FormFieldError error={errors.propertyId} />
          </div>

          {documentsFailed && (
            <div
              role="alert"
              data-testid="lease-documents-error"
              className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                {getProblemMessage(documentsError, t) ?? t('leases.form.documentsLoadError')}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetchDocuments()}>
                {t('leases.form.retry')}
              </Button>
            </div>
          )}

          {apeError && (
            <div
              role="alert"
              className="flex flex-wrap gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{apeError}</span>
              {apeMissing && (
                <Button asChild variant="outline" size="sm">
                  <Link to={longRentPropertyPath(selectedPropertyId)}>{t('leases.form.uploadApe')}</Link>
                </Button>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contractType">{t('leases.form.contractTypeLabel')}</Label>
              <select id="contractType" {...register('contractType')} className={SELECT_CLASS}>
                {LEASE_CONTRACT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {getLeaseContractTypeLabel(value, t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxRegime">{t('leases.form.taxRegimeLabel')}</Label>
              <select id="taxRegime" {...register('taxRegime')} className={SELECT_CLASS}>
                {LEASE_TAX_REGIMES.map((value) => (
                  <option key={value} value={value}>
                    {getLeaseTaxRegimeLabel(value, t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="lease-term-rule">
            {t(`leases.form.termRule.${contractType}`)}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t('leases.form.startDateLabel')}</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
              <FormFieldError error={errors.startDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">{t('leases.form.endDateLabel')}</Label>
              <Input id="endDate" type="date" {...register('endDate')} />
              <FormFieldError error={errors.endDate} />
            </div>
          </div>

          {isConcordato && selectedPropertyId && (
            <CanoneConcordatoCalculator
              propertyId={selectedPropertyId}
              startDate={startDate}
              endDate={endDate}
              onRangeChange={handleRangeChange}
              onCharacteristicsChange={setConcordatoCharacteristics}
            />
          )}
          {isConcordato && concordatoError && (
            <p role="alert" className="text-sm text-destructive">
              {concordatoError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="monthlyRent">{t('leases.form.monthlyRentLabel')}</Label>
              <Input
                id="monthlyRent"
                type="number"
                step="0.01"
                min="0.01"
                {...register('monthlyRent', { valueAsNumber: true })}
              />
              <FormFieldError error={errors.monthlyRent} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="securityDeposit">{t('leases.form.securityDepositLabel')}</Label>
              <Input
                id="securityDeposit"
                type="number"
                step="0.01"
                min="0"
                {...register('securityDeposit', {
                  setValueAs: (value: string) => (value === '' || value == null ? undefined : Number(value)),
                })}
              />
              <FormFieldError error={errors.securityDeposit} />
            </div>
          </div>
          {isConcordato && concordatoRange && (
            <p className="text-sm text-muted-foreground" data-testid="lease-concordato-range-hint">
              {t(concordatoRange.indicative ? 'leases.form.concordatoIndicativeRangeHint' : 'leases.form.concordatoRangeHint', {
                min: concordatoRange.minMonthly.toFixed(2),
                max: concordatoRange.maxMonthly.toFixed(2),
              })}
            </p>
          )}
          {rentOutsideRange && concordatoRange && (
            <p
              className={`text-sm ${concordatoRange.indicative ? 'text-amber-700' : 'text-destructive'}`}
              data-testid="lease-concordato-out-of-range"
            >
              {t(
                concordatoRange.indicative
                  ? 'leases.form.concordatoRentOutsideIndicativeRange'
                  : 'leases.form.concordatoRentOutOfRange',
              )}
            </p>
          )}
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
        <Button
          type="submit"
          disabled={isLoading || isLoadingDocuments || documentsFailed || propertiesFailed || noProperties || !!apeError}
        >
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
        <FormFieldError error={errors?.firstName} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.lastName`}>{t('leases.form.lastNameLabel')}</Label>
        <Input id={`${prefix}.lastName`} {...register(`${prefix}.lastName`)} />
        <FormFieldError error={errors?.lastName} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.fiscalCode`}>{t('leases.form.fiscalCodeLabel')}</Label>
        <Input id={`${prefix}.fiscalCode`} {...register(`${prefix}.fiscalCode`)} />
        <FormFieldError error={errors?.fiscalCode} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.citizenship`}>{t('leases.form.citizenshipLabel')}</Label>
        <Input
          id={`${prefix}.citizenship`}
          maxLength={2}
          placeholder="IT"
          {...register(`${prefix}.citizenship`)}
        />
        <FormFieldError error={errors?.citizenship} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${prefix}.contactEmail`}>{t('leases.form.contactEmailLabel')}</Label>
        <Input
          id={`${prefix}.contactEmail`}
          type="email"
          {...register(`${prefix}.contactEmail`)}
        />
        <FormFieldError error={errors?.contactEmail} />
      </div>
    </>
  );
}
