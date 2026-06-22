import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUpdateSupplierAvailability } from '@/queries/use-supplier';

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function SupplierAvailabilityPage() {
  const updateAvailability = useUpdateSupplierAvailability();
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return date;
  });

  const toggleDay = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };

  const save = async () => {
    const dates = Object.entries(selected).map(([date, available]) => ({ date, available }));
    if (dates.length === 0) {
      toast.message('Seleziona almeno un giorno');
      return;
    }
    await updateAvailability.mutateAsync(dates);
    toast.success('Disponibilità aggiornata');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Disponibilità" description="Tocca un giorno per segnare indisponibilità" />
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
                  <p className="text-sm font-medium">{day.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                  <p className="text-xs text-muted-foreground">{available ? 'Disponibile' : 'Non disponibile'}</p>
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Button onClick={() => void save()} disabled={updateAvailability.isPending}>
        Salva disponibilità
      </Button>
    </div>
  );
}
