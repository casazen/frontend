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

  const toggleActive = async (property: Property) => {
    try {
      await updateProperty.mutateAsync({
        id: property.id,
        data: { isActive: !property.isActive },
      });
    } catch (error) {
      // Error toast already handled by mutation
    }
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

        {propertyList.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-lg font-semibold mb-2">No properties yet</p>
              <p className="text-sm text-muted-foreground mb-6">
                Get started by adding your first vacation rental property
              </p>
              <Button>
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
