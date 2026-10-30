import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface CountedFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The most characters (the server's bound): the field stops there and the counter says how many are left. */
  max: number;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  /** The server refused this value: said under the field. */
  invalid?: boolean;
  optional?: boolean;
}

/** A text of the showcase with its counter ("12 caratteri rimasti") and the server's refusal, if there is one. */
export function CountedField({ label, value, onChange, max, multiline = false, rows = 3, hint, invalid = false, optional = false }: CountedFieldProps) {
  const { t } = useTranslation();
  const left = max - [...value].length;

  return (
    <Field
      label={label}
      hint={hint}
      optional={optional}
      error={invalid ? t('supplier.showcase.editor.invalidField') : undefined}
      counter={<span aria-live="polite">{t('supplier.showcase.editor.charsLeft', { count: left })}</span>}
    >
      {multiline ? (
        <Textarea value={value} rows={rows} maxLength={max} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input value={value} maxLength={max} onChange={(event) => onChange(event.target.value)} />
      )}
    </Field>
  );
}
