import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Link2, Smartphone } from 'lucide-react';
import { useSupplierProfile } from '@/queries/use-supplier';

export function SupplierCalendarSyncPage() {
  const { t } = useTranslation();
  const { isLoading } = useSupplierProfile();

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-64" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('supplier.calendarSyncTitle')}
        description={t('supplier.calendarSyncDescription')}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col items-center p-6 text-center">
          <Calendar className="mb-3 h-8 w-8 text-primary" />
          <h3 className="text-sm font-semibold">
            {t('supplier.googleCalendar')}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('supplier.googleCalendarHint')}
          </p>
          <Button className="mt-4 w-full" variant="outline">
            {t('supplier.connectCalendar')}
          </Button>
        </Card>

        <Card className="flex flex-col items-center p-6 text-center">
          <Link2 className="mb-3 h-8 w-8 text-primary" />
          <h3 className="text-sm font-semibold">
            {t('supplier.icalFeed')}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('supplier.icalFeedHint')}
          </p>
          <Button className="mt-4 w-full" variant="outline">
            {t('supplier.pasteIcalUrl')}
          </Button>
        </Card>

        <Card className="flex flex-col items-center p-6 text-center">
          <Smartphone className="mb-3 h-8 w-8 text-primary" />
          <h3 className="text-sm font-semibold">
            {t('supplier.whatsappOption')}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('supplier.whatsappHint')}
          </p>
          <Button className="mt-4 w-full" variant="outline">
            {t('supplier.enableWhatsapp')}
          </Button>
        </Card>
      </div>
    </div>
  );
}
