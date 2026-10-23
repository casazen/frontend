import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PAGE_COLUMN, PAGE_COLUMNS } from '@/components/layout/page-columns';
import { propertiesApi } from '@/api/properties.api';
import { useApeAutoRead, useProperties } from '@/queries/use-properties';
import { leaseFormSchema } from '../schemas/lease.schema';
import { getLeaseContractTypeLabel, getLeaseTaxRegimeLabel } from '@/lib/i18n-labels';
import { getProblemMessage } from '@/lib/api-errors';
import { hasApeIdentification, latestApeDocument } from '@/lib/ape-documents';
import { LONG_RENT_PROPERTY_CREATE_PATH } from '@/features/properties/long-rent/paths';
import { DocumentUploadDialog } from '@/features/properties/components/document-upload-dialog';
import { ApeIdentificationForm } from '@/features/properties/components/ape-identification-form';
import type { LeaseFormValues } from '../schemas/lease.schema';
import { LEASE_CONTRACT_TYPES, LEASE_TAX_REGIMES, type CreateLeaseDto } from '@/types';
import { AlertTriangle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { PartyListCard } from './lease-party-fields';
import { emptyParty, toPartyDto } from './lease-party-model';
const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/**
 * The types this form fills in. A canone concordato contract is not here: it is chosen first on the page and prepared with the
 * partner (a draft with only the property, then the partner's module).
 */
const FORM_CONTRACT_TYPES = LEASE_CONTRACT_TYPES.filter((type) => type !== 'Concordato');


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
  } = useProperties({ mode: 'long' });
  const properties = propertiesData ?? [];
  // A failed load (e.g. 403) is an explicit error, never an empty list to pick from (A7-06).
  const noProperties = !isLoadingProperties && !propertiesFailed && propertiesData !== undefined && properties.length === 0;
  const [waitingForDocumentsAt, setWaitingForDocumentsAt] = useState<string | null>(null);
  const [apeUploadOpen, setApeUploadOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseFormSchema),
    defaultValues: {
      contractType: 'Libero',
      taxRegime: 'CedolareSecca',
      landlords: [emptyParty('Landlord')],
      tenants: [emptyParty('Tenant')],
    } as LeaseFormValues,
  });

  const [selectedPropertyId, contractType] = useWatch({
    control,
    name: ['propertyId', 'contractType'],
  });

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
  // The contract states the code and the energy class of the last APE uploaded (LT-10): the draft waits for them, and they are
  // also what confirms a certificate the automatic reading could not read whole.
  const ape = latestApeDocument(documents);
  const apeMissing = documentsLoaded && !ape;
  const apeToIdentify = documentsLoaded && !!ape && !hasApeIdentification(ape);
  const waitingForDocuments = !documentsLoaded && !!selectedPropertyId && waitingForDocumentsAt === selectedPropertyId;

  // An APE whose code and class are not there yet (uploaded before they were read automatically): the server reads it again, the
  // file and the register of the region, once per document; the fields come only for what is still missing. An APE just uploaded
  // was read by its upload, which puts that answer in the same cache.
  const apeRead = useApeAutoRead(selectedPropertyId, documentsLoaded ? ape : undefined);
  const readingApe = apeToIdentify && apeRead.isFetching;

  useEffect(() => {
    if (defaultPropertyId && propertiesData?.some((property) => property.id === defaultPropertyId)) {
      setValue('propertyId', defaultPropertyId, { shouldValidate: false });
    }
  }, [defaultPropertyId, propertiesData, setValue]);

  const handleFormSubmit = (values: LeaseFormValues) => {
    if (documentsFailed) {
      return;
    }

    if (!documentsLoaded) {
      setWaitingForDocumentsAt(selectedPropertyId ?? null);
      return;
    }

    if (!ape || !hasApeIdentification(ape)) {
      return;
    }

    setWaitingForDocumentsAt(null);
    onSubmit({
      propertyId: values.propertyId,
      contractType: values.contractType,
      taxRegime: values.taxRegime,
      startDate: values.startDate,
      endDate: values.endDate,
      monthlyRent: values.monthlyRent,
      securityDeposit: values.securityDeposit ?? null,
      // Every landlord, then every tenant, in the order entered (LT-14): the API keeps that order.
      parties: [
        ...values.landlords.map((party) => toPartyDto(party, 'Landlord')),
        ...values.tenants.map((party) => toPartyDto(party, 'Tenant')),
      ],
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className={PAGE_COLUMNS}>
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

            {waitingForDocuments && (
              <p role="status" className="text-sm text-muted-foreground">
                {t('leases.form.waitingDocuments')}
              </p>
            )}

            {/* The APE is uploaded here, in a window over the form: nothing typed is lost (it used to open the property page). */}
            {apeMissing && (
              <div
                role="alert"
                data-testid="lease-ape-missing"
                className="flex flex-wrap gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex-1">{t('leases.form.apeMissingError')}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setApeUploadOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('leases.form.uploadApe')}
                </Button>
              </div>
            )}
            {/* Outside the box above: once the APE is on file the box goes, the window stays for its code and class. */}
            {selectedPropertyId ? (
              <DocumentUploadDialog propertyId={selectedPropertyId} onlyType="Ape" open={apeUploadOpen} onOpenChange={setApeUploadOpen} />
            ) : null}

            {apeToIdentify && ape && readingApe && (
              <p role="status" data-testid="lease-ape-reading" className="flex items-center gap-2 text-sm text-foreground/80">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t('leases.form.apeReadingFromDocument')}
              </p>
            )}

            {apeToIdentify && ape && !readingApe && (
              <div
                role="status"
                data-testid="lease-ape-identification"
                className="space-y-1 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
              >
                <p className="font-medium">{t('leases.form.apeIdentificationRequired')}</p>
                <p className="text-foreground/80">{t('leases.form.apeIdentificationHelp')}</p>
                <ApeIdentificationForm
                  key={`${ape.id}-${ape.apeCode ?? ''}-${ape.apeEnergyClass ?? ''}`}
                  propertyId={selectedPropertyId}
                  document={ape}
                  initiallyEditing
                  required
                />
              </div>
            )}

            {documentsLoaded && ape && hasApeIdentification(ape) && (
              <p className="flex items-center gap-2 text-sm text-foreground/80" data-testid="lease-ape-ready">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                {t('leases.form.apeReady', { code: ape.apeCode, energyClass: ape.apeEnergyClass })}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contractType">{t('leases.form.contractTypeLabel')}</Label>
                <select id="contractType" {...register('contractType')} className={SELECT_CLASS}>
                  {FORM_CONTRACT_TYPES.map((value) => (
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
          </CardContent>
        </Card>

        <div className={PAGE_COLUMN}>
          <PartyListCard role="Landlord" control={control} register={register} errors={errors.landlords} t={t} />
          <PartyListCard role="Tenant" control={control} register={register} errors={errors.tenants} t={t} />
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button
          type="submit"
          disabled={isLoading || isLoadingDocuments || documentsFailed || propertiesFailed || noProperties || apeMissing || apeToIdentify}
        >
          {isLoading ? t('leases.form.creating') : t('leases.form.createDraft')}
        </Button>
      </div>
    </form>
  );
}
