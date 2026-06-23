import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useSupplierAvailability, useUpdateSupplierAvailability } from '@/queries/use-supplier';

const VISIBLE_DAYS = 14;

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildVisibleDays(): Date[] {
  return Array.from({ length: VISIBLE_DAYS }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return date;
  });
}

export function SupplierAvailabilityPage() {
  const { t } = useTranslation();
  const days = useMemo(() => buildVisibleDays(), []);
  const from = formatDateKey(days[0]);
  const to = formatDateKey(days[days.length - 1]);
  const { data, isLoading } = useSupplierAvailability(from, to);
  const updateAvailability = useUpdateSupplierAvailability();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const initialized = useRef(false);

  // Initialize local state from server data on first load only.
  // After that local state is the source of truth — we don't overwrite
  // it on subsequent refetches (e.g. after save triggers invalidateQueries).
  useEffect(() => {
    if (!data?.dates || initialized.current) return;
    initialized.current = true;
    setSelected(Object.fromEntries(data.dates.map((entry) => [entry.date, entry.available])));
  }, [data]);

  const toggleDay = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };

  const save = async () => {
    const dates = days.map((day) => {
      const date = formatDateKey(day);
      return { date, available: selected[date] ?? true };
    });

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
        {days.map((day) => {
          const key = formatDateKey(day);
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
                  <p className="text-sm font-medium">{day.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
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
