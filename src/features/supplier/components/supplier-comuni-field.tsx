import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ComunePicker } from '@/components/shared/comune-picker';
import { comuneLabel } from '@/lib/comune-label';
import { useComuneDatasetStatus } from '@/queries/use-comuni';
import type { Comune } from '@/types/comune.types';

/** What the field edits: the comuni chosen from the official list (ISTAT codes) and the ones written as text. */
export interface SupplierComuniValue {
  istatCodes: string[];
  legacy: string[];
}

interface SupplierComuniFieldProps {
  /** Id of the picker input (the caller's `<Label htmlFor>`). */
  id: string;
  value: SupplierComuniValue;
  /** The chosen comuni the API already described (`profile.operatingComuni`): name, province, region. */
  known?: Comune[];
  onChange: (value: SupplierComuniValue) => void;
  disabled?: boolean;
}

/**
 * Comuni where a supplier operates (SU-04): comuni picked from the official ISTAT list, shown as removable chips, matched
 * with the properties by code. What the supplier wrote as text before the list (or while it is not imported) stays visible
 * and removable, flagged as not linked to the list; while the list is not imported the text field of old is offered instead
 * of the picker, never a silent loss of what was written.
 */
export function SupplierComuniField({ id, value, known = [], onChange, disabled = false }: SupplierComuniFieldProps) {
  const { t } = useTranslation();
  const status = useComuneDatasetStatus();
  const listAvailable = status.data?.datasetAvailable === true;

  // Details of the comuni picked here or described by the API, by ISTAT code.
  const [details, setDetails] = useState<Record<string, Comune>>(() =>
    Object.fromEntries(known.map((comune) => [comune.istatCode, comune])),
  );
  const [text, setText] = useState(() => value.legacy.join(', '));

  const add = (comune: Comune) => {
    setDetails((current) => ({ ...current, [comune.istatCode]: comune }));
    if (!value.istatCodes.includes(comune.istatCode)) {
      onChange({ ...value, istatCodes: [...value.istatCodes, comune.istatCode] });
    }
  };

  const removeCode = (code: string) =>
    onChange({ ...value, istatCodes: value.istatCodes.filter((candidate) => candidate !== code) });

  const removeLegacy = (entry: string) =>
    onChange({ ...value, legacy: value.legacy.filter((candidate) => candidate !== entry) });

  const writtenFallback = (
    <div className="space-y-1">
      <Input
        id={`${id}-text`}
        data-testid="supplier-comuni-text"
        value={text}
        disabled={disabled}
        placeholder={t('supplier.comuniPlaceholder')}
        onChange={(event) => {
          setText(event.target.value);
          onChange({
            ...value,
            legacy: event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean),
          });
        }}
      />
      <p className="text-xs text-muted-foreground">{t('supplier.comuniHint')}</p>
    </div>
  );

  return (
    <div className="space-y-3" data-testid="supplier-comuni-field">
      <ComunePicker
        id={id}
        istatCode={null}
        onChange={(comune) => comune && add(comune)}
        disabled={disabled}
        placeholder={t('supplier.comuni.pickerPlaceholder')}
        unavailableFallback={writtenFallback}
      />

      {value.istatCodes.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t('supplier.comuni.chosenTitle')} data-testid="supplier-comuni-chosen">
          {value.istatCodes.map((code) => {
            const comune = details[code];
            const label = comune ? comuneLabel(comune) : t('supplier.comuni.codeOnly', { code });
            return (
              <li
                key={code}
                data-testid={`supplier-comune-chip-${code}`}
                className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-3 pr-1 text-xs font-medium"
              >
                <span>{label}</span>
                {comune && comune.regionName && <span className="text-muted-foreground">· {comune.regionName}</span>}
                {listAvailable && !disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    aria-label={t('supplier.comuni.remove', { name: label })}
                    onClick={() => removeCode(code)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        listAvailable && <p className="text-sm text-muted-foreground">{t('supplier.comuni.noneChosen')}</p>
      )}

      {listAvailable && value.legacy.length > 0 && (
        <div className="space-y-1" data-testid="supplier-comuni-legacy">
          <p className="text-xs font-medium text-amber-800">{t('supplier.comuni.legacyTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('supplier.comuni.legacyHint')}</p>
          <ul className="flex flex-wrap gap-2">
            {value.legacy.map((entry) => (
              <li
                key={entry}
                data-testid={`supplier-comune-legacy-${entry}`}
                className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 py-0.5 pl-3 pr-1 text-xs font-medium text-amber-900"
              >
                <span>{entry}</span>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    aria-label={t('supplier.comuni.remove', { name: entry })}
                    onClick={() => removeLegacy(entry)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
