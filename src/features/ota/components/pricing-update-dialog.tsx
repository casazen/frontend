import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { pricingUpdateSchema, OTA_PLATFORM_LABELS } from '../schemas/ota.schema';
import { useProperties } from '@/queries/use-properties';
import type { PricingUpdateFormValues } from '../schemas/ota.schema';
import type { OtaPlatform } from '@/types';

interface PricingUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: PricingUpdateFormValues) => void | Promise<void>;
  isLoading?: boolean;
}

export function PricingUpdateDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: PricingUpdateDialogProps) {
  const { data: propertiesData } = useProperties();
  const properties = propertiesData?.data || [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PricingUpdateFormValues>({
    resolver: zodResolver(pricingUpdateSchema),
    defaultValues: {
      platforms: [],
    } as any,
  });

  const selectedPlatforms = watch('platforms') || [];

  const togglePlatform = (platform: OtaPlatform) => {
    const current = selectedPlatforms;
    const updated = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];
    setValue('platforms', updated);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const onSubmit = async (data: PricingUpdateFormValues) => {
    await onConfirm(data);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Update OTA Pricing</DialogTitle>
            <DialogDescription>
              Update pricing across multiple OTA platforms simultaneously
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property *</Label>
              <select
                id="propertyId"
                {...register('propertyId')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
              {errors.propertyId && (
                <p className="text-sm text-destructive">{errors.propertyId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricePerNight">Price per Night *</Label>
              <Input
                id="pricePerNight"
                type="number"
                step="0.01"
                {...register('pricePerNight', { valueAsNumber: true })}
                placeholder="150.00"
              />
              {errors.pricePerNight && (
                <p className="text-sm text-destructive">{errors.pricePerNight.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date (optional)</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...register('startDate')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date (optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  {...register('endDate')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Platforms (all if none selected)</Label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(OTA_PLATFORM_LABELS).map(([platform, config]) => (
                  <div key={platform} className="flex items-center space-x-2">
                    <Checkbox
                      id={`platform-${platform}`}
                      checked={selectedPlatforms.includes(platform as OtaPlatform)}
                      onCheckedChange={() => togglePlatform(platform as OtaPlatform)}
                    />
                    <Label
                      htmlFor={`platform-${platform}`}
                      className="cursor-pointer text-sm flex items-center gap-1"
                    >
                      <span>{config.icon}</span>
                      {config.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Pricing'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
