import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const EU_COUNTRIES = [
  { code: 'IT', name: 'Italia' },
  { code: 'DE', name: 'Germania' },
  { code: 'FR', name: 'Francia' },
  { code: 'ES', name: 'Spagna' },
  { code: 'NL', name: 'Paesi Bassi' },
  { code: 'BE', name: 'Belgio' },
  { code: 'AT', name: 'Austria' },
  { code: 'PT', name: 'Portogallo' },
] as const;

export interface BillingProfileFormValues {
  billingCountry: string;
  vatId: string;
}

interface BillingProfileFormProps {
  values: BillingProfileFormValues;
  onChange: (values: BillingProfileFormValues) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function BillingProfileForm({
  values,
  onChange,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Continua al pagamento',
}: BillingProfileFormProps) {
  return (
    <form
      className="space-y-4"
      data-testid="billing-profile-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="billing-country">Paese</Label>
        <select
          id="billing-country"
          data-testid="billing-country-select"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={values.billingCountry}
          onChange={(event) =>
            onChange({ ...values, billingCountry: event.target.value })
          }
        >
          {EU_COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="billing-vat-id">Partita IVA</Label>
        <Input
          id="billing-vat-id"
          data-testid="billing-vat-input"
          placeholder="Opzionale"
          value={values.vatId}
          onChange={(event) => onChange({ ...values, vatId: event.target.value })}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Avvio checkout...' : submitLabel}
      </Button>
    </form>
  );
}
