import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useProperties, useUpdateProperty, useCreateProperty } from '@/queries/use-properties';
import { useCinCompliance } from '@/queries/use-cin';
import { CinDeadlineBanner } from '@/features/cin';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { PropertyForm } from './components/property-form';
import { isPlanLimitError, PLAN_LIMIT_MESSAGE } from '@/lib/entitlement-error';
import type { Property } from '@/types';
import type { PropertyFormValues } from './schemas/property.schema';

export function PropertiesPage() {
  const { data: properties, isLoading, error } = useProperties();
  const { data: cinCompliance } = useCinCompliance();
  const updateProperty = useUpdateProperty();
  const createProperty = useCreateProperty();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const toggleActive = async (property: Property) => {
    try {
      await updateProperty.mutateAsync({
        id: property.id,
        data: { isActive: !property.isActive },
      });
    } catch {
      // Error toast already handled by mutation
    }
  };

  const handleCreateProperty = async (data: PropertyFormValues) => {
    try {
      await createProperty.mutateAsync(data);
      setIsDialogOpen(false);
    } catch (error) {
      // Plan-limit (403/409) is suppressed by the mutation's onError; surface the Italian
      // message here so the dialog still informs the owner (#202, AC12).
      if (isPlanLimitError(error)) {
        toast.error(PLAN_LIMIT_MESSAGE);
        return;
      }
      // Other errors already surfaced by the mutation's onError toast.
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-destructive">Failed to load properties</p>
            <p className="text-sm text-muted-foreground">Please try refreshing the page</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const propertyList = properties ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        {cinCompliance?.summary && <CinDeadlineBanner summary={cinCompliance.summary} />}

        <div className="flex items-center justify-between">
          <PageHeader title="Properties" description="Manage your vacation rental properties" />
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Property
          </Button>
        </div>

        {propertyList.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-lg font-semibold mb-2">No properties yet</p>
              <p className="text-sm text-muted-foreground mb-6">
                Get started by adding your first vacation rental property
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Property
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {['Property', 'Location', 'Rooms', 'Guests', 'Price / night', 'Amenities', 'Status', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {propertyList.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <Link to={`/properties/${p.id}`} className="hover:underline">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.city}, {p.country}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.bedrooms}bd · {p.bathrooms}ba</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.maxGuests}</td>
                        <td className="px-4 py-3 font-medium">{p.currency === 'EUR' ? '€' : '$'}{p.nightlyRate}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(p.amenities || []).slice(0, 3).map((a) => (
                              <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                            ))}
                            {(p.amenities || []).length > 3 && (
                              <Badge variant="outline" className="text-xs">+{p.amenities.length - 3}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={p.isActive ? 'default' : 'secondary'}>
                            {p.isActive ? 'Active' : 'Paused'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActive(p)}
                              disabled={updateProperty.isPending}
                              className="text-xs"
                            >
                              {p.isActive ? 'Pause' : 'Activate'}
                            </Button>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
              <DialogDescription>
                Create a new vacation rental property
              </DialogDescription>
            </DialogHeader>
            <PropertyForm
              onSubmit={handleCreateProperty}
              onCancel={() => setIsDialogOpen(false)}
              isLoading={createProperty.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
