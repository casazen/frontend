import { useMemo, useState } from 'react';
import type { PublicTouristTaxRateSummary } from '@/types/seo.types';
import { useCalculateTouristTax } from '@/queries/use-public-seo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface TouristTaxCalculatorWidgetProps {
  comuneSlug: string;
  rateSummary?: PublicTouristTaxRateSummary | null;
}

function defaultCheckIn(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function defaultCheckOut(): string {
  const date = new Date();
  date.setDate(date.getDate() + 11);
  return date.toISOString().slice(0, 10);
}

export function TouristTaxCalculatorWidget({
  comuneSlug,
  rateSummary,
}: TouristTaxCalculatorWidgetProps) {
  const [numberOfAdults, setNumberOfAdults] = useState(2);
  const [numberOfChildren, setNumberOfChildren] = useState(0);
  const [checkInDate, setCheckInDate] = useState(defaultCheckIn);
  const [checkOutDate, setCheckOutDate] = useState(defaultCheckOut);

  const calculateMutation = useCalculateTouristTax();

  const rateLabel = useMemo(() => {
    if (!rateSummary) return null;
    const maxNightsText =
      rateSummary.maxNights != null ? `, max ${rateSummary.maxNights} notti` : '';
    return `${formatCurrency(rateSummary.ratePerPersonPerNight)}/persona/notte${maxNightsText}`;
  }, [rateSummary]);

  async function handleCalculate() {
    await calculateMutation.mutateAsync({
      comuneSlug,
      numberOfAdults,
      numberOfChildren,
      checkInDate,
      checkOutDate,
    });
  }

  return (
    <section
      className="my-8 rounded-lg border p-6"
      data-testid="tourist-tax-calculator-widget"
    >
      <h2 className="text-xl font-semibold">Calcola la tassa di soggiorno</h2>
      {rateLabel && (
        <p className="mt-1 text-sm text-muted-foreground" data-testid="tourist-tax-rate-summary">
          Tariffa ufficiale: {rateLabel}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tax-adults">Adulti</Label>
          <Input
            id="tax-adults"
            type="number"
            min={1}
            value={numberOfAdults}
            onChange={(e) => setNumberOfAdults(Number(e.target.value))}
            data-testid="tax-adults-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax-children">Bambini</Label>
          <Input
            id="tax-children"
            type="number"
            min={0}
            value={numberOfChildren}
            onChange={(e) => setNumberOfChildren(Number(e.target.value))}
            data-testid="tax-children-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax-checkin">Check-in</Label>
          <Input
            id="tax-checkin"
            type="date"
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
            data-testid="tax-checkin-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax-checkout">Check-out</Label>
          <Input
            id="tax-checkout"
            type="date"
            value={checkOutDate}
            onChange={(e) => setCheckOutDate(e.target.value)}
            data-testid="tax-checkout-input"
          />
        </div>
      </div>

      <Button
        className="mt-4"
        onClick={() => void handleCalculate()}
        disabled={calculateMutation.isPending}
        data-testid="tax-calculate-button"
      >
        {calculateMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Calcolo…
          </>
        ) : (
          'Calcola'
        )}
      </Button>

      {calculateMutation.data && (
        <div className="mt-4 rounded-md bg-muted p-4" data-testid="tax-calculation-result">
          <p className="text-lg font-semibold">
            Tassa stimata: {formatCurrency(calculateMutation.data.taxAmount)}
          </p>
          <p className="text-sm text-muted-foreground">
            {calculateMutation.data.nights} notti · {calculateMutation.data.numberOfAdults} adulti
            {calculateMutation.data.numberOfChildren > 0
              ? ` · ${calculateMutation.data.numberOfChildren} bambini`
              : ''}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{calculateMutation.data.disclaimer}</p>
        </div>
      )}

      {calculateMutation.isError && (
        <p className="mt-4 text-sm text-destructive" data-testid="tax-calculation-error">
          Impossibile calcolare la tassa. Verifica i dati inseriti.
        </p>
      )}
    </section>
  );
}
