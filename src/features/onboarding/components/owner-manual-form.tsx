import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { manualOwnerRow, ownerManualCsv, type ManualOwnerRow, type ManualOwnerValues } from '@/lib/owner-onboarding';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

const EMPTY: ManualOwnerValues = { property: '', ownerKey: '', legalName: '', email: '', entityKind: 'person', fiscalCode: '', sharePercent: '', ownershipStart: '' };

/** The fields the form needs before it asks the server: the rest is judged by the server, row by row, in words. */
const REQUIRED: readonly (keyof ManualOwnerValues)[] = ['property', 'legalName', 'sharePercent', 'ownershipStart'];

interface OwnerManualFormProps {
  /** A request of the card is in flight: the form waits. */
  disabled: boolean;
  /** The one row as a file, to be checked exactly as a file chosen from the computer is: the check, then the confirmed import; with the row as the confirmation will name it. */
  onFile: (file: File, row: ManualOwnerRow) => void;
  /** A field of the form changed: the file that was made of it before (and its check) is not what the form holds any more. */
  onEdit: () => void;
}

/**
 * One owner of one property entered by hand (E10/F03/US05/T01, AC-NF109-1, «manual completion»): the same data as a row of the file, built in the browser into a
 * one-row file and sent through the same check and the same confirmed import, so the server is the only one that judges it (no second set of rules here). What is typed
 * (a name, an address, a tax code) lives in this form only while it is on the page: it is not written to the URL, the storage or the log, and it is not kept by the cache of
 * the mutations (the file goes through `useImportOwners`). The form is not a form of the page: the card around it never submits.
 */
export function OwnerManualForm({ disabled, onFile, onEdit }: OwnerManualFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ManualOwnerValues>(EMPTY);
  const [problem, setProblem] = useState<string | null>(null);

  const set = (key: keyof ManualOwnerValues) => (value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    // What was checked is the row as it was sent: a change makes that check be about another row, so the panel forgets it and asks for a new one.
    onEdit();
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const missing = REQUIRED.filter((key) => values[key].trim() === '');
    if (missing.length > 0) {
      setProblem(t('ownerOnboarding.manual.required', { fields: missing.map((key) => t(`ownerOnboarding.manual.${key === 'sharePercent' ? 'share' : key === 'ownershipStart' ? 'start' : key}`)).join(', ') }));
      return;
    }
    if (values.ownerKey.trim() === '' && values.fiscalCode.trim() === '') {
      setProblem(t('ownerOnboarding.manual.needsIdentity'));
      return;
    }
    setProblem(null);
    onFile(new File([ownerManualCsv(values)], 'proprietario-manuale.csv', { type: 'text/csv' }), manualOwnerRow(values));
  }

  return (
    <form onSubmit={submit} className="min-w-0 space-y-3 rounded-lg border p-4" noValidate data-testid="owner-manual-form" autoComplete="off">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{t('ownerOnboarding.manual.title')}</h3>
        <p className="text-sm text-foreground/70">{t('ownerOnboarding.manual.description')}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('ownerOnboarding.manual.property')} hint={t('ownerOnboarding.manual.propertyHint')}>
          <Input value={values.property} onChange={(event) => set('property')(event.target.value)} disabled={disabled} autoComplete="off" data-testid="owner-manual-property" />
        </Field>
        <Field label={t('ownerOnboarding.manual.legalName')}>
          <Input value={values.legalName} onChange={(event) => set('legalName')(event.target.value)} disabled={disabled} autoComplete="off" data-testid="owner-manual-name" />
        </Field>
        <Field label={t('ownerOnboarding.manual.ownerKey')} hint={t('ownerOnboarding.manual.ownerKeyHint')} optional>
          <Input value={values.ownerKey} onChange={(event) => set('ownerKey')(event.target.value)} disabled={disabled} autoComplete="off" data-testid="owner-manual-key" />
        </Field>
        <Field label={t('ownerOnboarding.manual.fiscalCode')} optional>
          <Input value={values.fiscalCode} onChange={(event) => set('fiscalCode')(event.target.value)} disabled={disabled} autoComplete="off" spellCheck={false} data-testid="owner-manual-fiscal" />
        </Field>
        <Field label={t('ownerOnboarding.manual.email')} optional>
          <Input type="email" value={values.email} onChange={(event) => set('email')(event.target.value)} disabled={disabled} autoComplete="off" data-testid="owner-manual-email" />
        </Field>
        <Field label={t('ownerOnboarding.manual.entityKind')}>
          <select
            value={values.entityKind}
            onChange={(event) => set('entityKind')(event.target.value)}
            disabled={disabled}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="owner-manual-kind"
          >
            <option value="person">{t('ownerOnboarding.manual.person')}</option>
            <option value="company">{t('ownerOnboarding.manual.company')}</option>
          </select>
        </Field>
        <Field label={t('ownerOnboarding.manual.share')} hint={t('ownerOnboarding.manual.shareHint')}>
          <Input inputMode="decimal" value={values.sharePercent} onChange={(event) => set('sharePercent')(event.target.value)} disabled={disabled} autoComplete="off" data-testid="owner-manual-share" />
        </Field>
        <Field label={t('ownerOnboarding.manual.start')}>
          <Input type="date" value={values.ownershipStart} onChange={(event) => set('ownershipStart')(event.target.value)} disabled={disabled} autoComplete="off" data-testid="owner-manual-start" />
        </Field>
      </div>
      {problem ? (
        <Alert variant="danger" role="alert" data-testid="owner-manual-problem">
          {problem}
        </Alert>
      ) : null}
      <p className="text-sm text-foreground/70">{t('ownerOnboarding.manual.privacy')}</p>
      <Button type="submit" className={TOUCH_TARGET} disabled={disabled} data-testid="owner-manual-submit">
        {t('ownerOnboarding.manual.submit')}
      </Button>
    </form>
  );
}
