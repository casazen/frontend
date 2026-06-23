import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateOtaIntegration } from '@/queries/use-ota';
import { useProperties } from '@/queries/use-properties';
import { getOtaPlatformLabel } from '@/lib/i18n-labels';
import { otaIntegrationFormSchema, OTA_PLATFORM_COLORS, OTA_PLATFORM_ICONS } from './schemas/ota.schema';
import type { OtaIntegrationFormValues } from './schemas/ota.schema';

export function OtaSetupPage() {
  const { t } = useTranslation();
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
  const platformColor = selectedPlatform ? OTA_PLATFORM_COLORS[selectedPlatform] : '#888';
  const platformIcon = selectedPlatform ? OTA_PLATFORM_ICONS[selectedPlatform] : '';
  const platformLabel = selectedPlatform ? getOtaPlatformLabel(selectedPlatform, t) : '';

  const onSubmit = async (data: OtaIntegrationFormValues) => {
    await createIntegration.mutateAsync(data);
    navigate('/app/short-rent/ota');
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title={t('ota.setup.title')}
          description={t('ota.setup.description')}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('ota.setup.platformTitle')}</CardTitle>
              <CardDescription>{t('ota.setup.platformDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform">{t('ota.setup.platformLabel')}</Label>
                <select
                  id="platform"
                  {...register('platform')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">{t('ota.setup.selectPlatform')}</option>
                  {Object.keys(OTA_PLATFORM_COLORS).map((value) => (
                    <option key={value} value={value}>
                      {OTA_PLATFORM_ICONS[value]} {getOtaPlatformLabel(value, t)}
                    </option>
                  ))}
                </select>
                {errors.platform && (
                  <p className="text-sm text-destructive">{errors.platform.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertyId">{t('ota.setup.propertyLabel')}</Label>
                <select
                  id="propertyId"
                  {...register('propertyId')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">{t('ota.setup.selectProperty')}</option>
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
                  {t('ota.setup.activeLabel')}
                </Label>
              </div>
            </CardContent>
          </Card>

          {selectedPlatform && (
            <Card style={{ borderTop: `4px solid ${platformColor}` }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">{platformIcon}</span>
                  {t('ota.setup.credentialsTitle', { platform: platformLabel })}
                </CardTitle>
                <CardDescription>
                  {t('ota.setup.credentialsDescription', { platform: platformLabel })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="credentials.apiKey">{t('ota.setup.apiKey')}</Label>
                  <Input
                    id="credentials.apiKey"
                    type="password"
                    {...register('credentials.apiKey')}
                    placeholder={t('ota.setup.apiKeyPlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credentials.apiSecret">{t('ota.setup.apiSecret')}</Label>
                  <Input
                    id="credentials.apiSecret"
                    type="password"
                    {...register('credentials.apiSecret')}
                    placeholder={t('ota.setup.apiSecretPlaceholder')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="credentials.username">{t('ota.setup.username')}</Label>
                    <Input
                      id="credentials.username"
                      {...register('credentials.username')}
                      placeholder={t('ota.setup.usernamePlaceholder')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="credentials.password">{t('ota.setup.password')}</Label>
                    <Input
                      id="credentials.password"
                      type="password"
                      {...register('credentials.password')}
                      placeholder={t('ota.setup.passwordPlaceholder')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credentials.propertyId">{t('ota.setup.platformPropertyId')}</Label>
                  <Input
                    id="credentials.propertyId"
                    {...register('credentials.propertyId')}
                    placeholder={t('ota.setup.platformPropertyIdPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('ota.setup.platformPropertyIdHint', { platform: platformLabel })}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/app/short-rent/ota')}>
              {t('ota.setup.cancel')}
            </Button>
            <Button type="submit" disabled={createIntegration.isPending}>
              {createIntegration.isPending ? t('ota.setup.creating') : t('ota.setup.create')}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
