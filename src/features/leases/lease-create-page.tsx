import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { LeaseCreateForm } from './components/lease-create-form';
import { useCreateLease } from '@/queries/use-leases';
import type { CreateLeaseDto } from '@/types';

export function LeaseCreatePage() {
  const navigate = useNavigate();
  const createLease = useCreateLease();

  const handleSubmit = async (data: CreateLeaseDto) => {
    const lease = await createLease.mutateAsync(data);
    navigate(`/leases/${lease.id}`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="Create lease"
          description="Define contract parties and terms — a draft will be saved for review"
        />
        <LeaseCreateForm
          onSubmit={handleSubmit}
          isLoading={createLease.isPending}
        />
      </div>
    </AppShell>
  );
}
