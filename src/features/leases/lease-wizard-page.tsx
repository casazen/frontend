import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { BackLink } from '@/components/shared/back-link';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import { useDraftReading, useLandlordDefaults, useLeaseDraft, useLongRentRules } from '@/queries/use-lease-draft';
import { LONG_RENT_PROPERTIES_PATH, longRentPropertyPath } from '@/features/properties/long-rent/paths';
import { LeaseWizard } from './wizard/lease-wizard';
import { SignedWizard } from './wizard/signed-wizard';
import { AFTER_STEP, DONE_STEP } from './wizard/wizard-model';

const LEASES_PATH = '/app/long-rent/leases';

function DraftWizard({ id }: { id: string }) {
  const { t } = useTranslation();
  const draft = useLeaseDraft(id);
  const rules = useLongRentRules();
  const needsLandlord = draft.data !== undefined && draft.data.values.landlords.length === 0;
  const landlord = useLandlordDefaults(needsLandlord);
  const reading = useDraftReading(id, draft.data?.origin === 'Imported');

  if (draft.isError) {
    const status = getHttpStatus(draft.error);
    const code = isAxiosError(draft.error) ? getProblemCode(draft.error.response?.data) : undefined;
    if (status === 404 && code === 'lease_not_draft') return <Navigate to={`${LEASES_PATH}/${id}`} replace />;
    if (status === 404) {
      return (
        <div data-testid="lease-not-found">
          <EmptyState icon={FileText} title={t('leases.notFound')} description={t('leases.notFoundDescription')} action={{ label: t('longRentProperties.detail.backToList'), href: LONG_RENT_PROPERTIES_PATH }} />
        </div>
      );
    }
    return (
      <div className="min-w-0 space-y-4">
        <BackLink to={LONG_RENT_PROPERTIES_PATH} label={t('nav.properties')} className="md:inline-flex" />
        <ErrorState testId="lease-load-error" title={t('leases.detailLoadError')} error={draft.error} onRetry={() => void draft.refetch()} />
      </div>
    );
  }

  if (draft.isLoading || rules.isLoading || (needsLandlord && landlord.isLoading)) {
    return <LoadingScreen message={t('leases.detailLoading')} className="h-auto flex-1" />;
  }

  if (rules.isError || !rules.data || !draft.data) {
    return (
      <div className="min-w-0 space-y-4">
        <BackLink to={LONG_RENT_PROPERTIES_PATH} label={t('nav.properties')} className="md:inline-flex" />
        <ErrorState testId="lease-wizard-error" title={t('leaseWizard.loadError')} error={rules.error} onRetry={() => void rules.refetch()} />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6" data-testid="lease-wizard-page">
      <BackLink to={draft.data.values.propertyId ? `${longRentPropertyPath(draft.data.values.propertyId)}?tab=contracts` : LONG_RENT_PROPERTIES_PATH} label={t('nav.properties')} className="md:inline-flex" />
      <PageHeader title={t('leaseWizard.title')} />
      <LeaseWizard
        key={draft.dataUpdatedAt}
        draft={draft.data}
        defaults={landlord.data ?? null}
        rules={rules.data}
        onReload={() => void draft.refetch()}
        reading={reading.data ?? null}
      />
    </div>
  );
}

export function LeaseWizardPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const step = searchParams.get('step');

  if (step === String(AFTER_STEP) || step === DONE_STEP) {
    return (
      <div className="min-w-0 space-y-6" data-testid="lease-signed-wizard-page">
        <BackLink to={LONG_RENT_PROPERTIES_PATH} label={t('nav.properties')} className="md:inline-flex" />
        <PageHeader title={t('leaseWizard.title')} />
        <SignedWizard leaseId={id} view={step === DONE_STEP ? 'done' : 'after'} />
      </div>
    );
  }

  return <DraftWizard id={id} />;
}
