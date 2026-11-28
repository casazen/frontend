import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, FileSpreadsheet, Home, Mail, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { ImportResult } from '@/api/marketing-studio.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Dropzone } from '@/components/ui/dropzone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CrmAvatar } from '@/features/crm/lib/crm-avatar';
import { cn } from '@/lib/utils';
import {
  IMPORT_BASES,
  IMPORT_FIELDS,
  canImport,
  importReasonKey,
  sampleGuest,
  type ColumnMapping,
  type ImportBasis,
  type ImportField,
  type SampleGuest,
} from './import-columns';
import { PropertyChoice } from './property-choice';
import type { PropertyOption } from './property-options';
import { ToneTile } from './tone-tile';

const EXAMPLE_COLUMNS = ['name', 'email', 'lastStay'] as const;
const EXAMPLE_ROWS = ['1', '2'] as const;
const BASIS_ICONS: Record<ImportBasis, LucideIcon> = { consent: ShieldCheck, softOptIn: CalendarCheck, serviceOnly: Mail };
const SOURCE_IDEAS: Record<ImportBasis, readonly string[]> = {
  consent: ['site', 'inPerson', 'newsletter'],
  softOptIn: ['bookings', 'direct'],
  serviceOnly: ['archive', 'ota'],
};
const SHOWN_ERRORS = 8;

function columnLabel(header: string, index: number, unnamed: (number: number) => string): string {
  return header.trim() || unnamed(index + 1);
}

interface FileStepProps {
  file: File | null;
  reading: boolean;
  rows: number | null;
  problem: 'type' | 'size' | null;
  error: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
}

export function FileStep({ file, reading, rows, problem, error, onFile, onClear }: FileStepProps) {
  const { t } = useTranslation();
  const base = 'marketingHub.importWizard.file';

  if (file) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-inset ring-border" data-testid="import-file">
          <ToneTile icon={FileSpreadsheet} tone="success" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{file.name}</p>
            <p className="text-sm text-foreground/75" role="status">
              {reading ? t(`${base}.reading`) : rows !== null ? t(`${base}.ready`, { count: rows }) : null}
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClear} disabled={reading} data-testid="import-file-change">
            {t(`${base}.change`)}
          </Button>
        </div>
        {error ? <Alert variant="danger">{error}</Alert> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Dropzone
        accept={['.csv', '.xlsx']}
        multiple={false}
        onFiles={(files) => onFile(files[0])}
        title={t(`${base}.drop`)}
        buttonLabel={t(`${base}.button`)}
        hint={t(`${base}.hint`)}
        data-testid="import-dropzone"
      />
      {problem ? <Alert variant="danger">{t(`${base}.problems.${problem}`)}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <section aria-labelledby="import-example-title" className="space-y-2">
        <h4 id="import-example-title" className="text-sm font-semibold text-foreground/80">
          {t(`${base}.example.title`)}
        </h4>
        <div className="overflow-x-auto rounded-xl ring-1 ring-inset ring-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60">
              <tr>
                {EXAMPLE_COLUMNS.map((column) => (
                  <th key={column} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                    {t(`${base}.example.columns.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_ROWS.map((row) => (
                <tr key={row} className="border-t">
                  {EXAMPLE_COLUMNS.map((column) => (
                    <td key={column} className="whitespace-nowrap px-3 py-2 text-foreground/80">
                      {t(`${base}.example.rows.${row}.${column}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SampleGuestCard({ guest }: { guest: SampleGuest }) {
  const title = guest.name || guest.email || guest.phone;
  const details = [guest.name ? guest.email : '', guest.phone && guest.phone !== title ? guest.phone : '', guest.country, guest.lastStay].filter(Boolean);
  return (
    <div className="flex h-full min-w-0 items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-inset ring-border">
      <CrmAvatar name={title} />
      <div className="min-w-0">
        <p className="truncate font-semibold">{title}</p>
        {details.map((detail) => (
          <p key={detail} className="break-words text-sm text-foreground/70">
            {detail}
          </p>
        ))}
      </div>
    </div>
  );
}

interface ColumnsStepProps {
  headers: readonly string[];
  sample: readonly (readonly string[])[];
  mapping: ColumnMapping;
  detected: ColumnMapping;
  onChange: (field: ImportField, column: number | null) => void;
}

export function ColumnsStep({ headers, sample, mapping, detected, onChange }: ColumnsStepProps) {
  const { t } = useTranslation();
  const base = 'marketingHub.importWizard.columns';
  const unnamed = (number: number) => t(`${base}.unnamed`, { number });
  const usedBy = new Map<number, ImportField>();
  for (const field of IMPORT_FIELDS) {
    const column = mapping[field];
    if (column !== undefined) usedBy.set(column, field);
  }
  const guests = sample.slice(0, 3).map((row) => sampleGuest(row, mapping));

  return (
    <div className="space-y-6">
      <section aria-labelledby="import-sample-title" className="space-y-2">
        <h4 id="import-sample-title" className="font-semibold">
          {t(`${base}.sampleTitle`)}
        </h4>
        {canImport(mapping) ? (
          <ul role="list" className="grid gap-2 sm:grid-cols-3 max-sm:[&>li:nth-child(n+3)]:hidden" data-testid="import-sample">
            {guests.map((guest, index) => (
              <li key={index} className="min-w-0">
                <SampleGuestCard guest={guest} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-muted/50 p-3 text-sm text-foreground/80">{t(`${base}.sampleEmpty`)}</p>
        )}
      </section>

      <section aria-labelledby="import-fields-title" className="space-y-3">
        <h4 id="import-fields-title" className="font-semibold">
          {t(`${base}.fieldsTitle`)}
        </h4>
        {!canImport(mapping) ? (
          <Alert variant="warning" data-testid="import-need-contact">
            {t(`${base}.needContact`)}
          </Alert>
        ) : null}
        <ul role="list" className="divide-y rounded-2xl bg-card ring-1 ring-inset ring-border">
          {IMPORT_FIELDS.map((field) => {
            const column = mapping[field];
            const example = column === undefined ? '' : (sample[0]?.[column] ?? '').trim();
            return (
              <li key={field} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <Label htmlFor={`import-column-${field}`} className="flex flex-wrap items-center gap-2 font-semibold">
                    {t(`${base}.fields.${field}.label`)}
                    {column !== undefined && column === detected[field] ? (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-foreground">{t(`${base}.found`)}</span>
                    ) : null}
                  </Label>
                  <p className="text-sm text-foreground/70">{t(`${base}.fields.${field}.hint`)}</p>
                </div>
                <div className="min-w-0 space-y-1">
                  <Select
                    id={`import-column-${field}`}
                    value={column ?? ''}
                    onChange={(event) => onChange(field, event.target.value === '' ? null : Number(event.target.value))}
                    data-testid={`import-column-${field}`}
                  >
                    <option value="">{t(`${base}.none`)}</option>
                    {headers.map((header, index) => {
                      const owner = usedBy.get(index);
                      const taken = owner !== undefined && owner !== field;
                      return (
                        <option key={index} value={index} disabled={taken}>
                          {taken ? `${columnLabel(header, index, unnamed)} (${t(`${base}.used`)})` : columnLabel(header, index, unnamed)}
                        </option>
                      );
                    })}
                  </Select>
                  {example ? <p className="truncate text-xs text-foreground/70">{t(`${base}.example`, { value: example })}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
        {mapping.phone !== undefined ? <p className="text-sm text-foreground/75">{t(`${base}.phoneNote`)}</p> : null}
      </section>
    </div>
  );
}

interface PermissionStepProps {
  basis: ImportBasis | null;
  headers: readonly string[];
  mapping: ColumnMapping;
  onBasis: (basis: ImportBasis) => void;
  onLastStay: (column: number | null) => void;
}

export function PermissionStep({ basis, headers, mapping, onBasis, onLastStay }: PermissionStepProps) {
  const { t } = useTranslation();
  const base = 'marketingHub.importWizard.permission';
  const taken = new Set(Object.values(mapping));
  const unnamed = (number: number) => t('marketingHub.importWizard.columns.unnamed', { number });

  return (
    <div className="space-y-5">
      <div>
        <ChoiceGroup legend={t(`${base}.legend`)} minCardWidth={28}>
          {IMPORT_BASES.map((item) => (
            <ChoiceCard
              key={item}
              name="import-basis"
              value={item}
              checked={basis === item}
              onChange={() => onBasis(item)}
              icon={BASIS_ICONS[item]}
              title={t(`${base}.${item}.title`)}
              description={t(`${base}.${item}.description`)}
              data-testid={`import-basis-${item}`}
            />
          ))}
        </ChoiceGroup>
      </div>
      <p className="text-sm text-foreground/75">{t(`${base}.prudent`)}</p>
      {basis === 'softOptIn' && mapping.lastStay === undefined ? (
        <Alert variant="warning" title={t(`${base}.needDateTitle`)} data-testid="import-need-date">
          <div className="space-y-2">
            <Label htmlFor="import-last-stay-column">{t(`${base}.needDatePick`)}</Label>
            <Select
              id="import-last-stay-column"
              value=""
              onChange={(event) => onLastStay(event.target.value === '' ? null : Number(event.target.value))}
              data-testid="import-last-stay-column"
            >
              <option value="">{t('marketingHub.importWizard.columns.none')}</option>
              {headers.map((header, index) => (
                <option key={index} value={index} disabled={taken.has(index)}>
                  {columnLabel(header, index, unnamed)}
                </option>
              ))}
            </Select>
            <p className="text-foreground/80">{t(`${base}.needDateNone`)}</p>
          </div>
        </Alert>
      ) : null}
    </div>
  );
}

interface OriginStepProps {
  basis: ImportBasis;
  properties: PropertyOption[];
  loadingProperties: boolean;
  propertiesError: string | null;
  propertyId: string;
  onProperty: (id: string) => void;
  source: string;
  onSource: (value: string) => void;
  fileName: string;
  rows: number;
  fields: readonly ImportField[];
  error: string | null;
}

export function OriginStep({
  basis,
  properties,
  loadingProperties,
  propertiesError,
  propertyId,
  onProperty,
  source,
  onSource,
  fileName,
  rows,
  fields,
  error,
}: OriginStepProps) {
  const { t } = useTranslation();
  const base = 'marketingHub.importWizard.origin';
  const chosen = properties.find((item) => item.id === propertyId);

  return (
    <div className="space-y-6">
      <section aria-labelledby="import-property-title" className="space-y-3">
        <h4 id="import-property-title" className="font-semibold">
          {t(`${base}.property`)}
        </h4>
        {propertiesError ? <Alert variant="danger">{propertiesError}</Alert> : null}
        {loadingProperties ? <Skeleton className="h-24 w-full rounded-xl" /> : null}
        {!loadingProperties && !propertiesError && properties.length === 0 ? (
          <Alert
            variant="warning"
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/app/short-rent/properties">{t(`${base}.noPropertiesAction`)}</Link>
              </Button>
            }
          >
            {t(`${base}.noProperties`)}
          </Alert>
        ) : null}
        {properties.length === 1 && chosen ? (
          <div className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-inset ring-border" data-testid="import-single-property">
            <ToneTile icon={Home} tone="neutral" />
            <p className="min-w-0 break-words font-semibold">{chosen.name}</p>
          </div>
        ) : null}
        {properties.length > 1 ? (
          <>
            <PropertyChoice legend={t(`${base}.property`)} name="import-property" options={properties} value={propertyId} onChange={onProperty} testIdPrefix="import-property" />
            <p className="text-sm text-foreground/70">{t(`${base}.propertyHint`)}</p>
          </>
        ) : null}
      </section>

      <section aria-labelledby="import-source-title" className="space-y-3">
        <div className="space-y-1">
          <Label id="import-source-title" htmlFor="import-source" className="font-semibold">
            {t(`${base}.source`)}
          </Label>
          <p className="text-sm text-foreground/70">{t(`${base}.sourceHint`)}</p>
        </div>
        <Input
          id="import-source"
          value={source}
          maxLength={100}
          placeholder={t(`${base}.sourcePlaceholder`)}
          onChange={(event) => onSource(event.target.value)}
          data-testid="import-source"
        />
        <div className="flex flex-wrap gap-2">
          {SOURCE_IDEAS[basis].map((idea) => {
            const text = t(`${base}.ideas.${basis}.${idea}`);
            return (
              <button
                key={idea}
                type="button"
                onClick={() => onSource(text)}
                className={cn(
                  'min-h-9 rounded-full bg-card px-3.5 text-sm ring-1 ring-inset ring-border hover:bg-muted pointer-coarse:min-h-11',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                {text}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="import-summary-title" className="space-y-3 rounded-2xl bg-muted/50 p-4 ring-1 ring-inset ring-border">
        <h4 id="import-summary-title" className="text-sm font-semibold text-foreground/80">
          {t(`${base}.summaryTitle`)}
        </h4>
        <ul role="list" className="space-y-1.5 text-sm">
          <li className="break-words">{t(`${base}.summaryFile`, { file: fileName, count: rows })}</li>
          <li className="break-words">{t(`${base}.summaryColumns`, { list: fields.map((field) => t(`marketingHub.importWizard.columns.fields.${field}.label`)).join(', ') })}</li>
          <li className="break-words">{t(`${base}.summaryPermission`, { permission: t(`marketingHub.importWizard.permission.${basis}.title`) })}</li>
        </ul>
        <p className="text-sm text-foreground/75">{t(`${base}.noteRelay`)}</p>
      </section>

      {error ? <Alert variant="danger">{error}</Alert> : null}
    </div>
  );
}

export function ImportDone({ result }: { result: ImportResult }) {
  const { t } = useTranslation();
  const base = 'marketingHub.importWizard.done';
  const tiles = [
    { id: 'imported', count: result.imported, tone: 'bg-success-soft ring-success-border' },
    { id: 'skipped', count: result.skipped, tone: 'bg-muted/60 ring-border' },
    { id: 'errors', count: result.errors.length, tone: result.errors.length > 0 ? 'bg-warning-soft ring-warning-border' : 'bg-muted/60 ring-border' },
  ] as const;

  return (
    <div className="space-y-5" data-testid="import-done">
      <div className="flex items-start gap-4 rounded-2xl bg-success-soft p-5 ring-1 ring-inset ring-success-border">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-success-foreground" />
        <p className="text-foreground/85">{t(result.imported > 0 ? `${base}.text` : `${base}.noneText`)}</p>
      </div>
      <ul role="list" className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.id} className={cn('rounded-2xl p-4 ring-1 ring-inset', tile.tone)} data-testid={`import-result-${tile.id}`}>
            <p className="text-3xl font-bold tabular-nums tracking-tight">{tile.count}</p>
            <p className="text-sm text-foreground/80">{t(`${base}.${tile.id}`, { count: tile.count })}</p>
          </li>
        ))}
      </ul>
      {result.errors.length > 0 ? (
        <section aria-labelledby="import-errors-title" className="space-y-2">
          <h4 id="import-errors-title" className="font-semibold">
            {t(`${base}.errorsTitle`)}
          </h4>
          <ul role="list" className="space-y-1 text-sm">
            {result.errors.slice(0, SHOWN_ERRORS).map((item) => (
              <li key={item.row} className="rounded-lg bg-card px-3 py-2 ring-1 ring-inset ring-border">
                {t(`${base}.row`, { row: item.row, reason: t(importReasonKey(item.reason)) })}
              </li>
            ))}
          </ul>
          {result.errors.length > SHOWN_ERRORS ? <p className="text-sm text-foreground/70">{t(`${base}.more`, { count: result.errors.length - SHOWN_ERRORS })}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
