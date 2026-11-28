import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { MINOR_MAX_AGE } from '@/lib/tourist-tax';

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface ChildrenAgesFieldsProps {
  ages: (number | null)[];
  onChange: (ages: (number | null)[]) => void;
  idPrefix: string;
  showMissing?: boolean;
}

export function ChildrenAgesFields({ ages, onChange, idPrefix, showMissing = false }: ChildrenAgesFieldsProps) {
  const { t } = useTranslation();
  if (ages.length === 0) return null;

  const setAge = (index: number, value: string) => {
    const next = [...ages];
    next[index] = value === '' ? null : Number(value);
    onChange(next);
  };

  return (
    <fieldset className="space-y-2" data-testid={`${idPrefix}-children-ages`}>
      <legend className="text-sm font-medium">{t('touristTaxRules.childAgesTitle')}</legend>
      <p className="text-xs text-muted-foreground">{t('touristTaxRules.childAgesHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {ages.map((age, index) => {
          const id = `${idPrefix}-child-age-${index}`;
          const missing = showMissing && age === null;
          return (
            <div className="space-y-1" key={id}>
              <Label htmlFor={id}>{t('touristTaxRules.childAgeLabel', { index: index + 1 })}</Label>
              <select
                id={id}
                className={selectClassName}
                value={age ?? ''}
                aria-invalid={missing}
                onChange={(event) => setAge(index, event.target.value)}
              >
                <option value="">{t('touristTaxRules.childAgePlaceholder')}</option>
                {Array.from({ length: MINOR_MAX_AGE + 1 }, (_, value) => (
                  <option key={value} value={value}>
                    {t('touristTaxRules.childAgeOption', { count: value })}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
