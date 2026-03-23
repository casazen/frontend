import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, X } from 'lucide-react';
import { searchFiltersSchema } from '../schemas/search.schema';
import type { SearchFiltersFormValues } from '../schemas/search.schema';

interface SearchFiltersProps {
  onSearch: (filters: SearchFiltersFormValues) => void;
  onReset: () => void;
}

export function SearchFilters({ onSearch, onReset }: SearchFiltersProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SearchFiltersFormValues>({
    resolver: zodResolver(searchFiltersSchema),
  });

  const onSubmit = (data: SearchFiltersFormValues) => {
    onSearch(data);
  };

  const handleReset = () => {
    reset();
    onReset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Search Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              {...register('city')}
              placeholder="e.g., Rome, Milan, Florence..."
            />
            {errors.city && (
              <p className="text-sm text-destructive">{errors.city.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minPrice">Min Price (€/night)</Label>
              <Input
                id="minPrice"
                type="number"
                {...register('minPrice', { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPrice">Max Price (€/night)</Label>
              <Input
                id="maxPrice"
                type="number"
                {...register('maxPrice', { valueAsNumber: true })}
                placeholder="1000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minBedrooms">Min Bedrooms</Label>
              <Input
                id="minBedrooms"
                type="number"
                {...register('minBedrooms', { valueAsNumber: true })}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxBedrooms">Max Bedrooms</Label>
              <Input
                id="maxBedrooms"
                type="number"
                {...register('maxBedrooms', { valueAsNumber: true })}
                placeholder="10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minBathrooms">Min Bathrooms</Label>
              <Input
                id="minBathrooms"
                type="number"
                {...register('minBathrooms', { valueAsNumber: true })}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxBathrooms">Max Bathrooms</Label>
              <Input
                id="maxBathrooms"
                type="number"
                {...register('maxBathrooms', { valueAsNumber: true })}
                placeholder="10"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              <X className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
