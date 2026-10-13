import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { LeaseCreateForm } from './components/lease-create-form';
import { useCreateLease } from '@/queries/use-leases';
import type { CreateLeaseDto } from '@/types';

export function LeaseCreatePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const createLease = useCreateLease();
  // "New lease" from a property page preselects it.
  const [searchParams] = useSearchParams();
  const defaultPropertyId = searchParams.get('propertyId') ?? undefined;

  const handleSubmit = async (data: CreateLeaseDto) => {
    try {
      const lease = await createLease.mutateAsync(data);
      navigate(`/app/long-rent/leases/${lease.id}`);
    } catch {
      // useCreateLease.onError shows the server's reason; the form stays filled in to fix and resubmit.
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title={t('leases.createPageTitle')}
          description={t('leases.createPageDescription')}
        />
        <LeaseCreateForm
          onSubmit={handleSubmit}
          isLoading={createLease.isPending}
          defaultPropertyId={defaultPropertyId}
        />
    </div>
  );
}
