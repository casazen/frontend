import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface CountedFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  invalid?: boolean;
  error?: string;
  optional?: boolean;
}

const ANNOUNCE_BELOW = 10;

export function CountedField({ label, value, onChange, max, multiline = false, rows = 3, hint, invalid = false, error, optional = false }: CountedFieldProps) {
  const { t } = useTranslation();
  const left = max - [...value].length;

  return (
    <Field
      label={label}
      hint={hint}
      optional={optional}
      error={error ?? (invalid ? t('supplier.showcase.editor.invalidField') : undefined)}
      counter={<span aria-live={left <= ANNOUNCE_BELOW ? 'polite' : 'off'}>{t('supplier.showcase.editor.charsLeft', { count: left })}</span>}
    >
      {multiline ? (
        <Textarea value={value} rows={rows} maxLength={max} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input value={value} maxLength={max} onChange={(event) => onChange(event.target.value)} />
      )}
    </Field>
  );
}
