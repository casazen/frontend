import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateOtaIntegration } from '@/queries/use-ota';
import { useProperties } from '@/queries/use-properties';
import { otaIntegrationFormSchema, OTA_PLATFORM_LABELS } from './schemas/ota.schema';
import type { OtaIntegrationFormValues } from './schemas/ota.schema';

export function OtaSetupPage() {
  const navigate = useNavigate();
  const createIntegration = useCreateOtaIntegration();
  const { data: propertiesData } = useProperties();
  const properties = propertiesData ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OtaIntegrationFormValues>({
    resolver: zodResolver(otaIntegrationFormSchema),
    defaultValues: {
      isActive: true,
      credentials: {},
    } as any,
  });

  const selectedPlatform = watch('platform');
  const platformConfig = selectedPlatform ? OTA_PLATFORM_LABELS[selectedPlatform] : null;

  const onSubmit = async (data: OtaIntegrationFormValues) => {
    await createIntegration.mutateAsync(data);
    navigate('/ota');
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Add OTA Integration"
          description="Connect a property to an online travel agency platform"
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Selection</CardTitle>
              <CardDescription>Choose the OTA platform to integrate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform">Platform *</Label>
                <select
                  id="platform"
                  {...register('platform')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select a platform</option>
                  {Object.entries(OTA_PLATFORM_LABELS).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.icon} {config.label}
                    </option>
                  ))}
                </select>
                {errors.platform && (
                  <p className="text-sm text-destructive">{errors.platform.message}</p>
                )}
              </div>

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
                      {property.name} - {property.city}
                    </option>
                  ))}
                </select>
                {errors.propertyId && (
                  <p className="text-sm text-destructive">{errors.propertyId.message}</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={watch('isActive')}
                  onCheckedChange={(checked) => setValue('isActive', !!checked)}
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active (start syncing immediately)
                </Label>
              </div>
            </CardContent>
          </Card>

          {selectedPlatform && (
            <Card style={{ borderTop: `4px solid ${platformConfig?.color}` }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">{platformConfig?.icon}</span>
                  {platformConfig?.label} Credentials
                </CardTitle>
                <CardDescription>
                  Enter your API credentials for {platformConfig?.label}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="credentials.apiKey">API Key</Label>
                  <Input
                    id="credentials.apiKey"
                    type="password"
                    {...register('credentials.apiKey')}
                    placeholder="Enter API key..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credentials.apiSecret">API Secret</Label>
                  <Input
                    id="credentials.apiSecret"
                    type="password"
                    {...register('credentials.apiSecret')}
                    placeholder="Enter API secret..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="credentials.username">Username</Label>
                    <Input
                      id="credentials.username"
                      {...register('credentials.username')}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="credentials.password">Password</Label>
                    <Input
                      id="credentials.password"
                      type="password"
                      {...register('credentials.password')}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credentials.propertyId">Platform Property ID</Label>
                  <Input
                    id="credentials.propertyId"
                    {...register('credentials.propertyId')}
                    placeholder="Property ID on the OTA platform"
                  />
                  <p className="text-xs text-muted-foreground">
                    The unique identifier for your property on {platformConfig?.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/ota')}>
              Cancel
            </Button>
            <Button type="submit" disabled={createIntegration.isPending}>
              {createIntegration.isPending ? 'Creating...' : 'Create Integration'}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
