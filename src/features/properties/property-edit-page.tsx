import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PropertyForm } from './components/property-form';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { useProperty, useUpdateProperty } from '@/queries/use-properties';
import type { PropertyFormValues } from './schemas/property.schema';

export function PropertyEditPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: property, isLoading } = useProperty(id!);
  const updateProperty = useUpdateProperty();

  const handleSubmit = async (data: PropertyFormValues) => {
    if (id) {
      await updateProperty.mutateAsync({ id, data });
      navigate('/app/short-rent/properties');
    }
  };

  if (isLoading) {
    return <LoadingScreen message={t('property.edit.loading')} />;
  }

  if (!property) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">{t('property.edit.notFound')}</h2>
          <p className="text-muted-foreground">{t('property.edit.notFoundDescription')}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title={t('property.edit.title')}
          description={t('property.edit.description', { name: property.name })}
        />

        <div className="flex flex-wrap gap-3" data-testid="property-activation-cta">
          <Button asChild variant="outline">
            <Link to={`/app/short-rent/properties/${property.id}/activation`}>
              {t('compliance.activation.openWizard', { defaultValue: 'Wizard attivazione' })}
            </Link>
          </Button>
        </div>

        <PropertyForm
          property={property}
          onSubmit={handleSubmit}
          isLoading={updateProperty.isPending}
        />
      </div>
    </AppShell>
  );
}
