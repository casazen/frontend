import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { PropertiesList } from './components/properties-list';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { useProperties, useDeleteProperty } from '@/queries/use-properties';
import { Plus } from 'lucide-react';
import type { Property } from '@/types';

export function PropertiesPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useProperties();
  const deleteProperty = useDeleteProperty();

  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);

  const handleEdit = (property: Property) => {
    navigate(`/properties/${property.id}/edit`);
  };

  const handleView = (property: Property) => {
    navigate(`/properties/${property.id}`);
  };

  const handleDelete = async () => {
    if (propertyToDelete) {
      await deleteProperty.mutateAsync(propertyToDelete.id);
      setPropertyToDelete(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Properties"
          description="Manage your vacation rental properties"
          action={
            <Button onClick={() => navigate('/properties/create')}>
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </Button>
          }
        />

        <PropertiesList
          properties={data?.data || []}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={setPropertyToDelete}
          onView={handleView}
          onAdd={() => navigate('/properties/create')}
        />

        <ConfirmationDialog
          open={!!propertyToDelete}
          onOpenChange={(open) => !open && setPropertyToDelete(null)}
          title="Delete Property"
          description={`Are you sure you want to delete "${propertyToDelete?.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={handleDelete}
          isLoading={deleteProperty.isPending}
        />
      </div>
    </AppShell>
  );
}
