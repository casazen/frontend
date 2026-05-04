import { useState } from 'react';
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
import { PropertyForm } from './components/property-form';
import { useCreateProperty } from '@/queries/use-properties';
import type { PropertyFormValues } from './schemas/property.schema';

const PROPERTIES = [
  { id: 1, name: 'Villa Serena', city: 'Amalfi', country: 'Italy', bedrooms: 4, bathrooms: 3, maxGuests: 8, price: 250, currency: 'EUR', isActive: true, amenities: ['Pool', 'Sea View', 'WiFi', 'AC'] },
  { id: 2, name: 'Casa Blu', city: 'Positano', country: 'Italy', bedrooms: 2, bathrooms: 1, maxGuests: 4, price: 195, currency: 'EUR', isActive: true, amenities: ['Sea View', 'WiFi', 'Balcony'] },
  { id: 3, name: 'Apt Roma Centro', city: 'Rome', country: 'Italy', bedrooms: 1, bathrooms: 1, maxGuests: 2, price: 120, currency: 'EUR', isActive: true, amenities: ['WiFi', 'AC', 'Parking'] },
  { id: 4, name: 'Trullo Alberobello', city: 'Alberobello', country: 'Italy', bedrooms: 2, bathrooms: 2, maxGuests: 4, price: 160, currency: 'EUR', isActive: false, amenities: ['Garden', 'WiFi'] },
  { id: 5, name: 'Palazzo Venezia', city: 'Venice', country: 'Italy', bedrooms: 3, bathrooms: 2, maxGuests: 6, price: 320, currency: 'EUR', isActive: true, amenities: ['Canal View', 'WiFi', 'Concierge'] },
];

export function PropertiesPage() {
  const [properties, setProperties] = useState(PROPERTIES);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const createProperty = useCreateProperty();

  const toggleActive = (id: number) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
  };

  const handleCreateProperty = async (data: PropertyFormValues) => {
    try {
      await createProperty.mutateAsync(data);
      setIsDialogOpen(false);
    } catch (error) {
      // Error toast already handled by mutation
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title="Properties" description="Manage your vacation rental properties" />
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Property
          </Button>
        </div>

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
                  {properties.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.city}, {p.country}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.bedrooms}bd · {p.bathrooms}ba</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.maxGuests}</td>
                      <td className="px-4 py-3 font-medium">€{p.price}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.amenities.slice(0, 3).map((a) => (
                            <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                          ))}
                          {p.amenities.length > 3 && (
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
                            onClick={() => toggleActive(p.id)}
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
