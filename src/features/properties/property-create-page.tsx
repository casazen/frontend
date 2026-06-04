import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PropertyForm } from './components/property-form';
import { useCreateProperty } from '@/queries/use-properties';
import type { PropertyFormValues } from './schemas/property.schema';

export function PropertyCreatePage() {
  const navigate = useNavigate();
  const createProperty = useCreateProperty();

  const handleSubmit = async (data: PropertyFormValues) => {
    await createProperty.mutateAsync(data);
    navigate('/app/short-rent/properties');
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Create Property"
          description="Add a new vacation rental property to your portfolio"
        />

        <PropertyForm onSubmit={handleSubmit} isLoading={createProperty.isPending} />
      </div>
    </AppShell>
  );
}
