import { useTranslation } from 'react-i18next';
import { useAuth0 } from '@auth0/auth0-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSupplierProfile, useSupplierActivation } from '@/queries/use-supplier';

export function SupplierDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth0();
  const { data: profile, isLoading: profileLoading } = useSupplierProfile();
  const { isLoading: activationLoading } = useSupplierActivation();

  const isLoading = profileLoading || activationLoading;

  return (
    <div>
      <PageHeader
        title={t('supplier.dashboardTitle')}
        description={t('supplier.dashboardDescription')}
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t('supplier.status')}
            </h3>
            <p className="mt-1 text-xl font-semibold">
              {profile?.status === 'Active'
                ? t('supplier.statusActive')
                : t('supplier.statusPending')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.status === 'Active'
                ? t('supplier.visibleToHosts')
                : t('supplier.completeActivationHint')}
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t('supplier.categories')}
            </h3>
            <p className="mt-1 text-lg">
              {profile?.categories?.length
                ? profile.categories.join(', ')
                : t('supplier.noneSet')}
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t('supplier.municipalities')}
            </h3>
            <p className="mt-1 text-lg">
              {profile?.comuni?.length
                ? profile.comuni.join(', ')
                : t('supplier.noneSet')}
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t('supplier.welcomeBack')}
            </h3>
            <p className="mt-1 text-lg">
              {user?.name ?? t('supplier.supplierDefault')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {user?.email}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
