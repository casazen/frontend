import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { LeaseCreateForm } from './components/lease-create-form';
import { useCreateLease } from '@/queries/use-leases';
import type { CreateLeaseDto } from '@/types';

export function LeaseCreatePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const createLease = useCreateLease();

  const handleSubmit = async (data: CreateLeaseDto) => {
    const lease = await createLease.mutateAsync(data);
    navigate(`/app/long-rent/leases/${lease.id}`);
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
        />
    </div>
  );
}
