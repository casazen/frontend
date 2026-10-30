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
  /** A message of the form (the rule of a step: an i18n key or a text): said under the field, in place of the refusal of the server. */
  error?: string;
  optional?: boolean;
}

/** From here on the counter is read aloud as it changes: before, it would repeat itself at every key. */
const ANNOUNCE_BELOW = 10;

/** A text of the showcase with its counter ("12 caratteri rimasti") and the server's refusal, if there is one. */
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
