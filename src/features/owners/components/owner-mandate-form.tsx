import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BedDouble, CalendarRange, ChevronDown, Download, FileSignature, Lock, Percent, Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/dropzone';
import { ownerAccountingApi } from '@/api/owner-accounting.api';
import { saveBlobAs } from '@/lib/file-download';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getHttpStatus } from '@/lib/api-errors';
import { parseEuroAmount } from '@/lib/euro-amount';
import { addDays, todayInRome } from '@/lib/stay-dates';
import { useCreateOwnerMandate, useOwnerMandates } from '@/queries/use-owner-accounting';
import type { CommissionBase, OwnerMandate, OwnerMandateCommand } from '@/types';
import { FormDialog } from '@/features/owner-accounting/components/form-dialog';
import { OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import { MAX_FLAT_FEE, failureText, latestMandateStart, mandateCovers } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { Fact, FactGrid, Metric, MetricRow, OwnerCard, QuietNote, StateChip } from './owner-ui';

interface OwnerMandateSectionProps {
  ownerId: string;
  currency: string | null;
  canManage: boolean;
}

const BASES: readonly CommissionBase[] = ['GrossExclTouristTax', 'GrossExclTouristTaxAndCleaning'];

export function OwnerMandateSection({ ownerId, currency, canManage }: OwnerMandateSectionProps) {
  const { t } = useTranslation();
  const mandates = useOwnerMandates(ownerId);
  const [adding, setAdding] = useState(false);
  const today = todayInRome();
  const versions = mandates.data;
  const hasFees = (versions ?? []).some((mandate) => mandate.cleaningFlatRate !== null || mandate.linenFlatRate !== null);
  const inForce = (versions ?? []).some((mandate) => mandateCovers(mandate, today));

  let content;
  if (getHttpStatus(mandates.error) === 404) {
    content = <p className="break-words text-sm text-foreground/70" data-testid="owner-mandate-not-found">{t('ownerMandate.notFound')}</p>;
  } else if (mandates.isPending) {
    content = (
      <p role="status" className="text-sm text-foreground/70">
        {t('ownerMandate.loading')}
      </p>
    );
  } else if (mandates.isError || !versions) {
    content = <OwnerAccountingError error={mandates.error} title={t('ownerMandate.loadError')} onRetry={() => void mandates.refetch()} />;
  } else if (versions.length === 0) {
    content = (
      <QuietNote icon={AlertTriangle} data-testid="owner-mandate-missing">
        {t('ownerMandate.missing')}
      </QuietNote>
    );
  } else {
    const current = versions.find((mandate) => mandateCovers(mandate, today)) ?? versions[0];
    const others = versions.filter((mandate) => mandate.id !== current.id);
    content = (
      <ul role="list" className="space-y-4" data-testid="owner-mandate-versions">
        <CurrentMandate mandate={current} currency={currency} today={today} canManage={canManage} />
        {others.length > 0 ? (
          <li>
            <details className="group rounded-lg border border-border">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-sm font-medium">
                {t('ownerMandate.version.others', { count: others.length })}
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <ul role="list" className="divide-y divide-border border-t border-border">
                {others.map((mandate) => (
                  <OtherMandate key={mandate.id} mandate={mandate} currency={currency} today={today} />
                ))}
              </ul>
            </details>
          </li>
        ) : null}
      </ul>
    );
  }

  const chip = inForce ? <StateChip tone="success">{t('ownerMandate.version.inForce')}</StateChip> : versions && versions.length === 0 ? <StateChip tone="warning">{t('owners.row.mandateMissing')}</StateChip> : null;
  const action =
    canManage && mandates.isSuccess ? (
      <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} data-testid="mandate-new-version">
        <Plus aria-hidden="true" className="size-4" />
        {t('ownerMandate.newVersion')}
      </Button>
    ) : undefined;

  return (
    <OwnerCard icon={FileSignature} title={t('ownerMandate.title')} chip={chip} action={action} data-testid="owner-mandate-section">
      {content}
      {currency === null && hasFees ? (
        <QuietNote icon={AlertTriangle} data-testid="owner-mandate-currency-missing">
          {t('ownerMandate.currencyMissing')}
        </QuietNote>
      ) : null}
      {!canManage ? (
        <QuietNote icon={Lock} data-testid="owner-mandate-read-only">
          {t('ownerMandate.readOnly')}
        </QuietNote>
      ) : null}
      {adding && versions ? <MandateDialog open onOpenChange={(open) => !open && setAdding(false)} ownerId={ownerId} currency={currency} versions={versions} /> : null}
    </OwnerCard>
  );
}

interface MandateRowProps {
  mandate: OwnerMandate;
  currency: string | null;
  today: string;
}

function useMandateTerms(mandate: OwnerMandate, currency: string | null) {
  const { t } = useTranslation();
  const { date, percent, money, amount } = useOwnerFormat();
  return {
    range: mandate.validTo ? t('ownerMandate.version.between', { from: date(mandate.validFrom), to: date(mandate.validTo) }) : t('ownerMandate.version.from', { from: date(mandate.validFrom) }),
    commission: `${percent(mandate.commissionPercent)} ${mandate.commissionIncludesVat ? t('ownerMandate.vat.included') : t('ownerMandate.vat.excluded')}`,
    fee: (value: number) => (currency ? money(value, currency) : amount(value)),
  };
}

function CurrentMandate({ mandate, currency, today, canManage }: MandateRowProps & { canManage: boolean }) {
  const { t } = useTranslation();
  const { range, commission, fee } = useMandateTerms(mandate, currency);
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    setDownloading(true);
    try {
      const file = await ownerAccountingApi.downloadMandateDocument(mandate.ownerId, mandate.id);
      saveBlobAs(file.blob, `mandato-${mandate.id}.pdf`);
    } catch { toast.error(t('ownerMandate.wizard.downloadError')); }
    finally { setDownloading(false); }
  };
  const inForce = mandateCovers(mandate, today);
  const metrics = [
    { key: 'commission', icon: Percent, label: t('ownerMandate.dialog.commission'), value: commission, detail: undefined },
    ...(mandate.cleaningFlatRate !== null ? [{ key: 'cleaning', icon: Sparkles, label: t('ownerMandate.fields.cleaningFlatRate'), value: fee(mandate.cleaningFlatRate), detail: t('ownerMandate.version.perStay') }] : []),
    ...(mandate.linenFlatRate !== null ? [{ key: 'linen', icon: BedDouble, label: t('ownerMandate.fields.linenFlatRate'), value: fee(mandate.linenFlatRate), detail: t('ownerMandate.version.perStay') }] : []),
  ];

  return (
    <li className="space-y-4" data-testid="owner-mandate-version" data-in-force={inForce}>
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <CalendarRange aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
        <span className="break-words">{range}</span>
        {inForce ? null : mandate.validFrom > today ? <StateChip tone="info">{t('ownerMandate.version.upcoming')}</StateChip> : <StateChip tone="neutral">{t('ownerMandate.version.ended')}</StateChip>}
      </p>
      <MetricRow columns={metrics.length as 1 | 2 | 3} data-testid="owner-mandate-terms">
        {metrics.map(({ key, ...metric }) => (
          <Metric key={key} {...metric} />
        ))}
      </MetricRow>
      <FactGrid>
        <Fact label={t('ownerMandate.fields.commissionBase')} value={t(`ownerMandate.base.${mandate.commissionBase}`)} wide />
        <Fact label={t('ownerMandate.fields.passthroughPaymentFees')} value={mandate.passthroughPaymentFees ? t('ownerMandate.version.feesOwnerShort') : t('ownerMandate.version.feesAgencyShort')} />
        <Fact label={t('ownerMandate.fields.documentReference')} value={mandate.hasDocument ? <StateChip tone="success">{t('ownerMandate.version.documentPresent')}</StateChip> : t('ownerMandate.version.documentMissing')} />
      </FactGrid>
      {canManage && mandate.documentUploaded ? (
        <Button type="button" variant="outline" size="sm" loading={downloading} onClick={() => void download()}>
          <Download aria-hidden="true" className="size-4" />
          {t('ownerMandate.wizard.download')}
        </Button>
      ) : null}
    </li>
  );
}

function OtherMandate({ mandate, currency, today }: MandateRowProps) {
  const { t } = useTranslation();
  const { range, commission } = useMandateTerms(mandate, currency);
  const inForce = mandateCovers(mandate, today);
  const upcoming = mandate.validFrom > today;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm" data-testid="owner-mandate-version" data-in-force={inForce}>
      <CalendarRange aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
      <span className="min-w-0 break-words font-medium">{range}</span>
      <span className="min-w-0 break-words text-foreground/70">{commission}</span>
      <StateChip tone={upcoming ? 'info' : 'neutral'} className="ms-auto">
        {upcoming ? t('ownerMandate.version.upcoming') : t('ownerMandate.version.ended')}
      </StateChip>
    </li>
  );
}

interface FormState {
  validFrom: string;
  commissionPercent: string;
  commissionBase: CommissionBase;
  commissionIncludesVat: boolean;
  cleaningFlatRate: string;
  linenFlatRate: string;
  passthroughPaymentFees: boolean;
  documentReference: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS = /^https:\/\/\S+$/i;
const DOCUMENT_MAX = 500;

const asField = (value: number): string => value.toFixed(2).replace('.', ',');

function initial(from: OwnerMandate | null, latestStart: string | null): FormState {
  const today = todayInRome();
  const earliest = latestStart === null ? today : addDays(latestStart, 1);
  return {
    validFrom: today >= earliest ? today : earliest,
    commissionPercent: from ? asField(from.commissionPercent) : '',
    commissionBase: from?.commissionBase ?? 'GrossExclTouristTax',
    commissionIncludesVat: from?.commissionIncludesVat ?? false,
    cleaningFlatRate: from?.cleaningFlatRate != null ? asField(from.cleaningFlatRate) : '',
    linenFlatRate: from?.linenFlatRate != null ? asField(from.linenFlatRate) : '',
    passthroughPaymentFees: from?.passthroughPaymentFees ?? false,
    documentReference: '',
  };
}

/** A flat fee that may be left out: `ok` and no value for an empty field, a value from 0 to what the server stores, otherwise not ok. */
function flatFeeOf(raw: string): { ok: boolean; value: number | null } {
  if (raw.trim() === '') return { ok: true, value: null };
  const value = parseEuroAmount(raw);
  return value !== null && value >= 0 && value <= MAX_FLAT_FEE ? { ok: true, value } : { ok: false, value: null };
}

interface MandateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  currency: string | null;
  versions: readonly OwnerMandate[];
}

/** A new version of the mandate: the commission and its base, whether it holds the VAT, the flat fees of a stay, who bears the card fees, and where the signed mandate is. */
function MandateDialog({ open, onOpenChange, ownerId, currency, versions }: MandateDialogProps) {
  const { t, i18n } = useTranslation();
  const { date } = useOwnerFormat();
  const save = useCreateOwnerMandate(ownerId);
  const ofTheOwner = versions.filter((mandate) => mandate.ownershipId === null);
  const latestStart = latestMandateStart(ofTheOwner);
  const from = ofTheOwner.find((mandate) => mandate.validFrom === latestStart) ?? null;
  const [form, setForm] = useState<FormState>(() => initial(from, latestStart));
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const readController = useRef<AbortController | null>(null);
  useEffect(() => () => readController.current?.abort(), []);
  const dirty = useRef(new Set<keyof FormState>());
  const suggested = useRef(new Set<keyof FormState>());
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const set = (patch: Partial<FormState>) => {
    for (const key of Object.keys(patch) as (keyof FormState)[]) dirty.current.add(key);
    setForm((current) => ({ ...current, ...patch }));
  };
  const choose = (files: File[]) => {
    const chosen = files[0];
    if (!chosen) return;
    setReadNote(null);
    setError(null);
    const baseline = initial(from, latestStart);
    setForm((current) => {
      const next = { ...current };
      for (const key of suggested.current) if (!dirty.current.has(key)) Object.assign(next, { [key]: baseline[key] });
      return next;
    });
    suggested.current.clear();
    if (!/\.pdf$/i.test(chosen.name) || chosen.size < 5 || chosen.size > 20 * 1024 * 1024) {
      setFile(null);
      setFileError(t('ownerMandate.wizard.fileError'));
      return;
    }
    setFileError(null);
    setFile(chosen);
  };
  const readDocument = async () => {
    if (!file) { setStep(1); return; }
    setReading(true);
    setReadNote(null);
    const controller = new AbortController();
    readController.current = controller;
    try {
      const values = await ownerAccountingApi.readMandateDocument(ownerId, file, controller.signal);
      const patch: Partial<FormState> = {};
      if (values.validFrom && DAY.test(values.validFrom) && (latestStart === null || values.validFrom > latestStart)) patch.validFrom = values.validFrom;
      if (values.commissionPercent !== null) patch.commissionPercent = asField(values.commissionPercent);
      if (values.commissionBase !== null) patch.commissionBase = values.commissionBase;
      if (values.commissionIncludesVat !== null) patch.commissionIncludesVat = values.commissionIncludesVat;
      if (currency && values.currency?.toUpperCase() === currency.toUpperCase()) {
        if (values.cleaningFlatRate !== null) patch.cleaningFlatRate = asField(values.cleaningFlatRate);
        if (values.linenFlatRate !== null) patch.linenFlatRate = asField(values.linenFlatRate);
      }
      if (values.passthroughPaymentFees !== null) patch.passthroughPaymentFees = values.passthroughPaymentFees;
      for (const key of Object.keys(patch) as (keyof FormState)[]) {
        if (dirty.current.has(key)) delete patch[key];
        else suggested.current.add(key);
      }
      setForm((current) => ({ ...current, ...patch }));
      setReadNote(t(Object.keys(patch).length ? 'ownerMandate.wizard.readDone' : 'ownerMandate.wizard.readUnavailable'));
    } catch { setReadNote(t('ownerMandate.wizard.readUnavailable')); }
    finally { setReading(false); setStep(1); }
  };

  const percent = parseEuroAmount(form.commissionPercent);
  const percentOk = percent !== null && percent >= 0 && percent <= 100;
  const cleaning = flatFeeOf(form.cleaningFlatRate);
  const linen = flatFeeOf(form.linenFlatRate);
  const document = form.documentReference.trim();
  const documentOk = document === '' || (HTTPS.test(document) && document.length <= DOCUMENT_MAX);
  const startsAfterTheLast = latestStart === null || !DAY.test(form.validFrom) || form.validFrom > latestStart;
  const valid = DAY.test(form.validFrom) && startsAfterTheLast && percentOk && cleaning.ok && linen.ok && documentOk;

  const feeLabel = (kind: 'cleaningFlatRate' | 'linenFlatRate') => (currency ? t('ownerMandate.dialog.feeWithCurrency', { fee: t(`ownerMandate.fields.${kind}`), currency }) : t(`ownerMandate.fields.${kind}`));
  const cleaningLabel = feeLabel('cleaningFlatRate');
  const linenLabel = feeLabel('linenFlatRate');
  const feeHint = currency ? t('ownerMandate.dialog.feeHint') : t('ownerMandate.dialog.feeHintNoCurrency');

  const stepValid = step === 0 ? !fileError && (file !== null || documentOk) : step === 1 ? DAY.test(form.validFrom) && startsAfterTheLast && percentOk : step === 2 ? cleaning.ok && linen.ok : valid;
  const onSubmit = async () => {
    if (!stepValid) return;
    if (step === 0) { await readDocument(); return; }
    if (step < 3) { setStep((current) => current + 1); return; }
    if (!valid || percent === null) return;
    setError(null);
    const command: OwnerMandateCommand = {
      validFrom: form.validFrom,
      commissionPercent: percent,
      commissionBase: form.commissionBase,
      commissionIncludesVat: form.commissionIncludesVat,
      cleaningFlatRate: cleaning.value,
      linenFlatRate: linen.value,
      passthroughPaymentFees: form.passthroughPaymentFees,
      withholdingTreatment: from?.withholdingTreatment ?? 'Deductible',
      ...(document === '' ? {} : { documentReference: document }),
    };
    try {
      await save.mutateAsync(file ? { command, file } : command);
      toast.success(t('ownerMandate.dialog.done'));
      onOpenChange(false);
    } catch (failure) {
      setError(failureText(failure, t, i18n.exists));
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => { if (!reading && !save.isPending) onOpenChange(next); }}
      title={t('ownerMandate.dialog.title')}
      description={t('ownerMandate.wizard.description')}
      submitLabel={t(step === 3 ? 'ownerMandate.dialog.submit' : step === 0 && file ? 'ownerMandate.wizard.readNext' : 'ownerMandate.wizard.next')}
      pending={save.isPending || reading}
      submitDisabled={!stepValid}
      error={error}
      onSubmit={onSubmit}
      testId="mandate-dialog"
    >
      <p className="text-sm text-muted-foreground" role="status">{t('ownerMandate.wizard.progress', { current: step + 1, total: 4 })}</p>
      <h3 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">{t(`ownerMandate.wizard.steps.${step}`)}</h3>
      {step === 0 ? <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('ownerMandate.wizard.optional')}</p>
        <Dropzone accept={['application/pdf', '.pdf']} multiple={false} onFiles={choose} disabled={reading}
          title={file ? file.name : t('ownerMandate.wizard.drop')} buttonLabel={t('ownerMandate.wizard.choose')}
          hint={t('ownerMandate.wizard.fileHint')} data-testid="mandate-upload" />
        {fileError ? <Alert variant="danger">{fileError}</Alert> : null}
        {file ? <Button type="button" variant="ghost" disabled={reading} onClick={() => { setFile(null); setFileError(null); }}>{t('ownerMandate.wizard.remove')}</Button> : null}
        <Button type="button" variant="ghost" disabled={reading} onClick={() => { setFileError(null); if (!file) set({ documentReference: '' }); setStep(1); }}>{t(file ? 'ownerMandate.wizard.manualWithFile' : 'ownerMandate.wizard.manual')}</Button>
        {reading ? <div className="space-y-2"><p role="status" className="text-sm text-muted-foreground">{t('ownerMandate.wizard.reading')}</p><Button type="button" variant="outline" onClick={() => readController.current?.abort()}>{t('ownerMandate.wizard.stopReading')}</Button></div> : null}
      </div> : null}
      {readNote && step > 0 ? <Alert variant="info">{readNote}</Alert> : null}
      {step === 1 ? <>
      <Field
        label={t('ownerMandate.fields.validFrom')}
        hint={t('ownerMandate.dialog.validFromHint')}
        error={startsAfterTheLast || latestStart === null ? undefined : t('ownerMandate.dialog.validFromTooEarly', { date: date(latestStart) })}
      >
        <Input type="date" value={form.validFrom} onChange={(event) => set({ validFrom: event.target.value })} data-testid="mandate-valid-from" />
      </Field>

      <fieldset className="grid gap-4 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{t('ownerMandate.dialog.commission')}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('ownerMandate.fields.commissionPercent')}
            hint={t('ownerMandate.dialog.percentHint')}
            error={form.commissionPercent.trim() === '' || percentOk ? undefined : t('ownerMandate.dialog.percentInvalid')}
          >
            <Input value={form.commissionPercent} inputMode="decimal" maxLength={7} autoComplete="off" onChange={(event) => set({ commissionPercent: event.target.value })} data-testid="mandate-percent" />
          </Field>
          <Field label={t('ownerMandate.fields.commissionBase')}>
            <Select value={form.commissionBase} onChange={(event) => set({ commissionBase: event.target.value as CommissionBase })} data-testid="mandate-base">
              {BASES.map((base) => (
                <option key={base} value={base}>
                  {t(`ownerMandate.base.${base}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('ownerMandate.fields.commissionIncludesVat')} hint={t('ownerMandate.dialog.vatHint')}>
            <Select value={form.commissionIncludesVat ? 'included' : 'excluded'} onChange={(event) => set({ commissionIncludesVat: event.target.value === 'included' })} data-testid="mandate-vat">
              <option value="excluded">{t('ownerMandate.vat.excluded')}</option>
              <option value="included">{t('ownerMandate.vat.included')}</option>
            </Select>
          </Field>
        </div>
      </fieldset>

      </> : null}
      {step === 2 ? <fieldset className="grid gap-4">
        <legend className="px-1 text-sm font-medium">{t('ownerMandate.dialog.fees')}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={cleaningLabel} optional hint={feeHint} error={cleaning.ok ? undefined : t('ownerMandate.dialog.feeInvalid')}>
            <Input value={form.cleaningFlatRate} inputMode="decimal" maxLength={14} autoComplete="off" onChange={(event) => set({ cleaningFlatRate: event.target.value })} data-testid="mandate-cleaning" />
          </Field>
          <Field label={linenLabel} optional hint={feeHint} error={linen.ok ? undefined : t('ownerMandate.dialog.feeInvalid')}>
            <Input value={form.linenFlatRate} inputMode="decimal" maxLength={14} autoComplete="off" onChange={(event) => set({ linenFlatRate: event.target.value })} data-testid="mandate-linen" />
          </Field>
        </div>
        <Field label={t('ownerMandate.fields.passthroughPaymentFees')}>
          <Select
            value={form.passthroughPaymentFees ? 'owner' : 'agency'}
            onChange={(event) => set({ passthroughPaymentFees: event.target.value === 'owner' })}
            data-testid="mandate-fees"
          >
            <option value="agency">{t('ownerMandate.version.feesAgency')}</option>
            <option value="owner">{t('ownerMandate.version.feesOwner')}</option>
          </Select>
        </Field>
      </fieldset> : null}
      {step === 3 ? <div className="space-y-4" data-testid="mandate-review">
        <dl className="grid gap-4 sm:grid-cols-2">
          {[
            [t('ownerMandate.fields.validFrom'), date(form.validFrom)],
            [t('ownerMandate.fields.commissionPercent'), form.commissionPercent + '%'],
            [t('ownerMandate.fields.commissionBase'), t(`ownerMandate.base.${form.commissionBase}`)],
            [t('ownerMandate.fields.commissionIncludesVat'), t(form.commissionIncludesVat ? 'ownerMandate.vat.included' : 'ownerMandate.vat.excluded')],
            [cleaningLabel, form.cleaningFlatRate || '—'],
            [linenLabel, form.linenFlatRate || '—'],
            [t('ownerMandate.fields.passthroughPaymentFees'), t(form.passthroughPaymentFees ? 'ownerMandate.version.feesOwner' : 'ownerMandate.version.feesAgency')],
            [t('ownerMandate.fields.documentReference'), file?.name ?? (document || t('ownerMandate.version.noDocument'))],
          ].map(([label, value]) => <div key={label} className="min-w-0 border-b border-border pb-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
        </dl>
        <p className="text-sm text-muted-foreground">{t('ownerMandate.wizard.reviewHint')}</p>
      </div> : null}
      {step === 0 && !file ? <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">{t('ownerMandate.wizard.linkInstead')}</summary>
      <Field label={t('ownerMandate.fields.documentReference')} optional hint={t('ownerMandate.dialog.documentHint')} error={documentOk ? undefined : t('ownerMandate.dialog.documentInvalid')}>
        <Input value={form.documentReference} maxLength={DOCUMENT_MAX} autoComplete="off" inputMode="url" onChange={(event) => set({ documentReference: event.target.value })} data-testid="mandate-document" />
      </Field>
      </details> : null}
      {step > 0 ? <Button type="button" variant="ghost" disabled={save.isPending || reading} className="justify-self-start" onClick={() => setStep((current) => current - 1)} data-testid="mandate-back">{t('ownerMandate.wizard.back')}</Button> : null}
    </FormDialog>
  );
}
