import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { useSupplierInbox } from '@/queries/use-supplier';

export function SupplierInboxPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useSupplierInbox();

  return (
    <div className="space-y-6" data-testid="supplier-inbox-page">
      <PageHeader
        title={t('supplier.inboxTitle')}
        description={t('supplier.inboxDescription')}
      />

      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {isLoading ? t('supplier.loading') : data?.total === 0 ? t('supplier.noAssignments') : t('supplier.assignmentsCount', { count: data?.total })}
        </CardContent>
      </Card>
    </div>
  );
}
