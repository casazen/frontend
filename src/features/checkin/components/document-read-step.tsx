import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Camera } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getDocumentTypeLabel, getGenderLabel } from '@/lib/i18n-labels';
import {
  PREFILL_DOCUMENT_KINDS,
  PREFILL_INPUT,
  prefillFieldKey,
  type DocumentPrefill,
  type PrefillRow,
  type PrefillValues,
} from '../lib/document-prefill';
import { ALLOGGIATI_GENDERS } from '../schemas/checkin.schema';

interface DocumentReadStepProps {
  reading: boolean;
  review: string | null;
  onConfirm: () => void;
  message: string | null;
  readCount: number;
  onFile: (file: File) => void;
  onManual: () => void;
  onContinue: () => void;
  /** The property keeps no image of the document (canton Ticino, decision D6): the step says the photo is not stored. Nothing is said otherwise. */
  notArchived?: boolean;
  prefill?: DocumentPrefill | null;
  onConfirmPrefill?: (values: PrefillValues) => void;
  onDiscardPrefill?: () => void;
}

export function DocumentReadStep({
  review,
  onConfirm,
  reading,
  message,
  readCount,
  onFile,
  onManual,
  onContinue,
  notArchived = false,
  prefill = null,
  onConfirmPrefill,
  onDiscardPrefill,
}: DocumentReadStepProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4" data-testid="checkin-document-step">
      <p className="text-sm text-muted-foreground">{t('checkin.scanIntro')}</p>
      <div className="rounded-md border border-dashed p-6 text-center space-y-3">
        <Camera className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          id={inputId}
          disabled={reading}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label={t('checkin.scanButton')}
          data-testid="checkin-document-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onFile(file);
          }}
        />
        <Button
          type="button"
          variant={readCount > 0 ? 'outline' : 'default'}
          disabled={reading}
          onClick={() => inputRef.current?.click()}
          aria-describedby={hintId}
          data-testid="checkin-document-pick"
        >
          {reading ? t('checkin.scanReading') : readCount > 0 ? t('checkin.scanAnother') : t('checkin.scanButton')}
        </Button>
        <p id={hintId} className="text-xs text-foreground/70" data-testid="checkin-document-hint">{t('checkin.scanHint')}</p>
        {notArchived && (
          <p className="text-xs font-medium" data-testid="checkin-document-not-archived">
            {t('checkin.identity.documentNotArchived')}
          </p>
        )}
      </div>
      {prefill && onConfirmPrefill && (
        <DocumentPrefillPanel prefill={prefill} busy={reading} onConfirm={onConfirmPrefill} onDiscard={onDiscardPrefill} />
      )}
      {review && <div role="status" className="space-y-2">
        <p>{review}</p>
        <Button type="button" onClick={onConfirm} disabled={reading}>{t('checkin.scanConfirmButton')}</Button>
      </div>}
      {message && (
        <p className="text-sm" role="status" data-testid="checkin-document-message">
          {message}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" disabled={reading} onClick={onManual} data-testid="checkin-enter-manually">
          {t('checkin.scanManual')}
        </Button>
        {readCount > 0 && (
          <Button type="button" disabled={reading || !!review || !!prefill} onClick={onContinue} data-testid="checkin-scan-continue">
            {t('checkin.next')}
          </Button>
        )}
      </div>
    </div>
  );
}

interface DocumentPrefillPanelProps {
  prefill: DocumentPrefill;
  busy: boolean;
  onConfirm: (values: PrefillValues) => void;
  onDiscard?: () => void;
}

/**
 * What the local reading of the document gave, for the guest to check (E71/F02/US01/T02, NF-190): every value is marked «read from the document» and can be changed, and the data the reading did not give
 * are listed, so that the guest knows what the next steps will ask and nothing else. The values are in the state of this panel only: not in a storage, not in the address, and they are gone when the
 * guest confirms (the page puts them in the form, in memory) or drops the reading.
 */
function DocumentPrefillPanel({ prefill, busy, onConfirm, onDiscard }: DocumentPrefillPanelProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [values, setValues] = useState<PrefillValues>(() => Object.fromEntries(prefill.rows.map((row) => [row.name, row.value])));

  const change = (name: PrefillRow['name'], value: string) => setValues((current) => ({ ...current, [name]: value }));

  const keepTheFormUnsent = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') event.preventDefault();
  };

  const asked = [...new Map(prefill.missing.map((name) => [prefillFieldKey(name), name])).entries()];

  return (
    <section className="space-y-4 rounded-md border p-4" aria-labelledby={titleId} onKeyDown={keepTheFormUnsent} data-testid="checkin-prefill">
      <div className="space-y-1">
        <h3 id={titleId} className="text-base font-semibold">
          {t('checkin.prefill.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('checkin.prefill.intro')}</p>
      </div>

      {prefill.rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {prefill.rows.map((row) => (
            <Field
              key={row.name}
              label={t(prefillFieldKey(row.name))}
              hint={
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge variant="outline" className="gap-1" data-testid={`checkin-prefill-marker-${row.name}`}>
                    <BadgeCheck className="size-3.5" aria-hidden="true" />
                    {t('checkin.prefill.readFromDocument')}
                  </Badge>
                  {row.source === 'viz' && <span>{t('checkin.prefill.checkIt')}</span>}
                </span>
              }
            >
              {PREFILL_INPUT[row.name] === 'gender' ? (
                <Select value={values[row.name] ?? ''} onChange={(event) => change(row.name, event.target.value)} data-testid={`checkin-prefill-value-${row.name}`}>
                  <option value="">{t('checkin.selectGender')}</option>
                  {ALLOGGIATI_GENDERS.map((gender) => (
                    <option key={gender} value={gender}>
                      {getGenderLabel(gender, t)}
                    </option>
                  ))}
                </Select>
              ) : PREFILL_INPUT[row.name] === 'kind' ? (
                <Select value={values[row.name] ?? ''} onChange={(event) => change(row.name, event.target.value)} data-testid={`checkin-prefill-value-${row.name}`}>
                  <option value="">{t('checkin.selectDocumentType')}</option>
                  {PREFILL_DOCUMENT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {getDocumentTypeLabel(kind, t)}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={PREFILL_INPUT[row.name] === 'date' ? 'date' : 'text'}
                  value={values[row.name] ?? ''}
                  onChange={(event) => change(row.name, event.target.value)}
                  autoComplete="off"
                  data-testid={`checkin-prefill-value-${row.name}`}
                />
              )}
            </Field>
          ))}
        </div>
      )}

      {asked.length > 0 ? (
        <div className="space-y-1 rounded-md bg-muted p-3 text-sm" data-testid="checkin-prefill-missing">
          <p className="font-medium">{t('checkin.prefill.missingTitle')}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {asked.map(([key, name]) => (
              <li key={key} data-testid="checkin-prefill-missing-item" data-field={name}>
                {t(key)}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">{t('checkin.prefill.missingText')}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="checkin-prefill-complete">
          {t('checkin.prefill.complete')}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" disabled={busy} onClick={() => onConfirm(values)} data-testid="checkin-prefill-confirm">
          {t('checkin.prefill.confirm')}
        </Button>
        {onDiscard && (
          <Button type="button" size="lg" variant="outline" disabled={busy} onClick={onDiscard} data-testid="checkin-prefill-discard">
            {t('checkin.prefill.discard')}
          </Button>
        )}
      </div>
    </section>
  );
}
