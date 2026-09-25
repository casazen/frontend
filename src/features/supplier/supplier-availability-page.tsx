import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useSupplierAvailability, useUpdateSupplierAvailability } from '@/queries/use-supplier';
import { addDays, formatStayDate, todayInRome } from '@/lib/stay-dates';

const VISIBLE_DAYS = 14;

/** The next days (`YYYY-MM-DD`) from today in Europe/Rome, as the backend counts them. */
function buildVisibleDays(): string[] {
  const today = todayInRome();
  return Array.from({ length: VISIBLE_DAYS }, (_, index) => addDays(today, index));
}

export function SupplierAvailabilityPage() {
  const { t } = useTranslation();
  const days = useMemo(() => buildVisibleDays(), []);
  const from = days[0];
  const to = days[days.length - 1];
  const { data, isLoading } = useSupplierAvailability(from, to);
  const updateAvailability = useUpdateSupplierAvailability();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize local state from server data on first load only.
  // After that local state is the source of truth — we don't overwrite
  // it on subsequent refetches (e.g. after save triggers invalidateQueries).
  if (!initialized && data?.dates) {
    setInitialized(true);
    setSelected(Object.fromEntries(data.dates.map((entry) => [entry.date, entry.available])));
  }

  const toggleDay = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };

  const save = async () => {
    const dates = days.map((date) => ({ date, available: selected[date] ?? true }));

    try {
      await updateAvailability.mutateAsync(dates);
      toast.success(t('supplier.availabilityUpdated'));
    } catch {
      toast.error(t('supplier.availabilitySaveError'));
    }
  };

  if (isLoading) {
    return <LoadingScreen message={t('supplier.availabilityLoading')} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('supplier.availabilityTitle')} description={t('supplier.availabilityDescription')} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {days.map((key) => {
          const available = selected[key] ?? true;
          return (
            <Card key={key}>
              <CardContent className="p-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => toggleDay(key)}
                  data-testid={`availability-${key}`}
                >
                  <p className="text-sm font-medium">{formatStayDate(key, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                  <p className="text-xs text-muted-foreground">{available ? t('supplier.available') : t('supplier.notAvailable')}</p>
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Button onClick={() => void save()} disabled={updateAvailability.isPending}>
        {t('supplier.saveAvailability')}
      </Button>
    </div>
  );
}
