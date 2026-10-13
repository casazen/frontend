import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdatePropertyCadastral } from '@/queries/use-properties';
import { formatCurrency } from '@/lib/utils';
import type { Property } from '@/types';

interface Props {
  property: Property;
}

/**
 * Cadastral identification of the unit (LT-10): foglio, particella, subalterno, categoria, rendita. The lease contract
 * states them; the sheet also finds the canone concordato zone. Only lengths are checked by the API.
 */
export function PropertyCadastralCard({ property }: Props) {
  const { t } = useTranslation();
  const update = useUpdatePropertyCadastral();
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState(property.cadastralSheet ?? '');
  const [parcel, setParcel] = useState(property.cadastralParcel ?? '');
  const [subaltern, setSubaltern] = useState(property.cadastralSubaltern ?? '');
  const [category, setCategory] = useState(property.cadastralCategory ?? '');
  const [income, setIncome] = useState(property.cadastralIncome != null ? String(property.cadastralIncome) : '');

  const complete =
    !!property.cadastralSheet && !!property.cadastralParcel && !!property.cadastralCategory && property.cadastralIncome != null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedIncome = income.trim() === '' ? null : Number(income.replace(',', '.'));
    try {
      await update.mutateAsync({
        propertyId: property.id,
        data: {
          sheet: sheet.trim() || null,
          parcel: parcel.trim() || null,
          subaltern: subaltern.trim() || null,
          category: category.trim() || null,
          income: parsedIncome != null && Number.isFinite(parsedIncome) ? parsedIncome : null,
        },
      });
      setEditing(false);
    } catch {
      // useUpdatePropertyCadastral.onError shows the server's reason; the form stays open to fix it.
    }
  };

  return (
    <Card data-testid="property-cadastral">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{t('longRentProperties.cadastral.title')}</CardTitle>
        {!editing && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            {t('longRentProperties.cadastral.edit')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!editing ? (
          <>
            {!complete && (
              <p className="text-amber-700" data-testid="property-cadastral-missing">
                {t('longRentProperties.cadastral.missing')}
              </p>
            )}
            <dl className="grid gap-2 sm:grid-cols-2">
              <Item label={t('longRentProperties.cadastral.sheet')} value={property.cadastralSheet} />
              <Item label={t('longRentProperties.cadastral.parcel')} value={property.cadastralParcel} />
              <Item label={t('longRentProperties.cadastral.subaltern')} value={property.cadastralSubaltern} />
              <Item label={t('longRentProperties.cadastral.category')} value={property.cadastralCategory} />
              <Item
                label={t('longRentProperties.cadastral.income')}
                value={property.cadastralIncome != null ? formatCurrency(property.cadastralIncome) : null}
              />
            </dl>
          </>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3 sm:grid-cols-2">
            <Field id="cadastral-sheet" label={t('longRentProperties.cadastral.sheet')}>
              <Input id="cadastral-sheet" maxLength={10} value={sheet} onChange={(e) => setSheet(e.target.value)} />
            </Field>
            <Field id="cadastral-parcel" label={t('longRentProperties.cadastral.parcel')}>
              <Input id="cadastral-parcel" maxLength={20} value={parcel} onChange={(e) => setParcel(e.target.value)} />
            </Field>
            <Field id="cadastral-subaltern" label={t('longRentProperties.cadastral.subaltern')}>
              <Input id="cadastral-subaltern" maxLength={10} value={subaltern} onChange={(e) => setSubaltern(e.target.value)} />
            </Field>
            <Field id="cadastral-category" label={t('longRentProperties.cadastral.category')}>
              <Input
                id="cadastral-category"
                maxLength={10}
                placeholder={t('longRentProperties.cadastral.categoryPlaceholder')}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </Field>
            <Field id="cadastral-income" label={t('longRentProperties.cadastral.income')}>
              <Input
                id="cadastral-income"
                type="number"
                min={0}
                step="0.01"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('longRentProperties.cadastral.save')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={update.isPending}>
                {t('longRentProperties.cadastral.cancel')}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  const { t } = useTranslation();
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || t('longRentProperties.cadastral.notSet')}</dd>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
