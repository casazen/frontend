import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PropertyForm } from './components/property-form';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useProperty, useUpdateProperty } from '@/queries/use-properties';
import type { PropertyFormValues } from './schemas/property.schema';

export function PropertyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: property, isLoading } = useProperty(id!);
  const updateProperty = useUpdateProperty();

  const handleSubmit = async (data: PropertyFormValues) => {
    if (id) {
      await updateProperty.mutateAsync({ id, data });
      navigate('/properties');
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading property..." />;
  }

  if (!property) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Property not found</h2>
          <p className="text-muted-foreground">The property you're looking for doesn't exist.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Edit Property"
          description={`Update details for ${property.name}`}
        />

        <PropertyForm
          property={property}
          onSubmit={handleSubmit}
          isLoading={updateProperty.isPending}
        />
      </div>
    </AppShell>
  );
}
