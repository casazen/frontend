import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import { useUpdateProperty } from '@/queries/use-properties';

/** The identifier as the backend stores it (`TicinoStructureId.Normalize`): no spaces, uppercase; empty when blank. */
function normalizeTicinoStructureId(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/** 3 to 20 letters and digits, groups joined by single hyphens (`TicinoStructureId.IsValid` of the backend), e.g. `NL-12345678`. */
function isValidTicinoStructureId(value: string): boolean {
  const normalized = normalizeTicinoStructureId(value);
  return normalized.length >= 3 && normalized.length <= 20 && /^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(normalized);
}

interface TicinoStructureIdFormProps {
  propertyId: string;
  value: string | null | undefined;
  /** Called after a successful save (the page reloads its day). */
  onSaved?: () => void;
}

/**
 * The «Numero identificativo LEAR / NO-LEAR» of a Ticino property (casazen/backend#979): the first field of every row of the file for the
 * police portal, received from Ticino Turismo when the structure registers. Saved with `PUT /properties/{id}` (only this field).
 */
export function TicinoStructureIdForm({ propertyId, value, onSaved }: TicinoStructureIdFormProps) {
  const { t } = useTranslation();
  const update = useUpdateProperty();
  const [draft, setDraft] = useState(value ?? '');
  const [invalid, setInvalid] = useState(false);
  const inputId = `ticino-structure-id-${propertyId}`;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidTicinoStructureId(draft)) {
      setInvalid(true);
      return;
    }
    await update.mutateAsync({ id: propertyId, data: { ticinoStructureId: normalizeTicinoStructureId(draft) } });
    onSaved?.();
  };

  return (
    <form onSubmit={save} className="space-y-2" data-testid="ticino-structure-id-form">
      <Label htmlFor={inputId}>{t('swiss.structureId.label')}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={inputId}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value.toUpperCase());
            setInvalid(false);
          }}
          placeholder="NL-12345678"
          className="max-w-xs"
          aria-invalid={invalid}
          aria-describedby={invalid ? `${inputId}-error` : `${inputId}-hint`}
        />
        <Button type="submit" variant="outline" disabled={update.isPending}>
          {update.isPending ? t('swiss.structureId.saving') : t('swiss.structureId.save')}
        </Button>
      </div>
      {invalid ? <FormFieldError id={`${inputId}-error`} message={t('swiss.structureId.invalid')} /> : null}
      <p id={`${inputId}-hint`} className="text-sm text-foreground/70">{t('swiss.structureId.hint')}</p>
    </form>
  );
}
