import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { saveBlobAs } from '@/lib/file-download';
import { getHttpStatus } from '@/lib/api-errors';
import {
  useAnnualDataset,
  useDownloadF24Pdf,
  useF24Record,
  useGenerateAnnualDataset,
  useGenerateF24,
  useSetDatasetFilingState,
  useSetF24FilingState,
  useTaxReconciliation,
} from '@/queries/use-owner-accounting';
import type { TaxFilingCommand, TaxF24Record, TaxReportingDataset } from '@/types';
import { failureText, messageOf, nextFilingStates, toCents, type Period } from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';
import { FilingStatus } from './filing-status';

/** The currency of the withholding: it is declared on an F24 in euro (the server refuses any other). */
const TAX_CURRENCY = 'EUR';

type Step = TaxFilingCommand['state'];
type Target = { file: 'f24'; id: string; step: Step } | { file: 'annual'; id: string; step: Step };

interface TaxFilingPanelProps {
  period: Period;
}

/**
 * The tax files of the withholding (E06/F05/US02/T04, AC-NF110-4, AC-NF110-5): the F24 of the month and the annual data of the year, each with
 * the word its proof allows, the evidence and the next step. The withholding is decided at the payout, never by a statement; a month with none
 * has no F24. CasaZen does not file anything with the Revenue Agency: a file is «inviato» only when the person records who sent it and how, and
 * «accettato» only with the receipt. Reading this panel creates nothing: the F24 is made by «Genera», on the person's click.
 */
export function TaxFilingPanel({ period }: TaxFilingPanelProps) {
  const { t } = useTranslation();
  const { money, month } = useOwnerFormat();
  const reconciliation = useTaxReconciliation(period.year);
  const row = reconciliation.data?.months.find((candidate) => candidate.month === period.month);
  const hasF24 = row?.f24 !== null && row?.f24 !== undefined;
  const f24 = useF24Record(period.month, period.year, hasF24);
  const f24Record = f24.data;
  const annual = useAnnualDataset(period.year);
  const annualDataset = annual.data;
  const generateF24 = useGenerateF24();
  const generateAnnual = useGenerateAnnualDataset();
  const [target, setTarget] = useState<Target | null>(null);

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast.success(done);
    } catch (error) {
      toast.error(messageOf(error, t));
    }
  };

  let body: ReactNode = null;
  if (reconciliation.isPending) {
    body = (
      <p role="status" className="text-sm text-foreground/70">
        {t('ownerAccounting.tax.loading')}
      </p>
    );
  } else if (reconciliation.isError) {
    body = (
      <Alert
        variant={getHttpStatus(reconciliation.error) === 403 ? 'warning' : 'danger'}
        action={
          <Button type="button" size="sm" variant="outline" onClick={() => void reconciliation.refetch()}>
            {t('shared.errorState.retry')}
          </Button>
        }
        data-testid="tax-error"
      >
        {getHttpStatus(reconciliation.error) === 403 ? t('ownerAccounting.tax.noAccess') : messageOf(reconciliation.error, t)}
      </Alert>
    );
  } else if (reconciliation.data) {
    const data = reconciliation.data;
    const obligations = row?.obligations ?? 0;
    body = (
      <div className="space-y-6">
        <div className="space-y-2" data-testid="tax-f24">
          <h3 className="text-base font-semibold">{t('ownerAccounting.tax.f24Title', { period: month(period.year, period.month) })}</h3>
          {hasF24 ? (
            f24.isPending ? (
              <p role="status" className="text-sm text-foreground/70">
                {t('ownerAccounting.tax.loading')}
              </p>
            ) : f24Record ? (
              <F24View record={f24Record} obligations={obligations} onStep={(step) => setTarget({ file: 'f24', id: f24Record.id, step })} onRegenerate={() => void run(() => generateF24.mutateAsync({ month: period.month, year: period.year }), t('ownerAccounting.tax.f24Regenerated'))} regenerating={generateF24.isPending} />
            ) : (
              <Alert variant="danger">{messageOf(f24.error, t)}</Alert>
            )
          ) : toCents(obligations) > 0 ? (
            <div className="space-y-2">
              <FilingStatus file={null} />
              <p className="break-words text-sm" data-testid="tax-calculated">
                {t('ownerAccounting.tax.calculated', { amount: money(obligations, TAX_CURRENCY) })}
              </p>
              <Button type="button" size="sm" variant="outline" loading={generateF24.isPending} onClick={() => void run(() => generateF24.mutateAsync({ month: period.month, year: period.year }), t('ownerAccounting.tax.f24Generated'))} data-testid="tax-generate-f24">
                {t('ownerAccounting.tax.generateF24')}
              </Button>
            </div>
          ) : (
            <p className="break-words text-sm text-foreground/70" data-testid="tax-none">
              {t('ownerAccounting.tax.none')}
            </p>
          )}
        </div>

        <div className="space-y-2" data-testid="tax-annual">
          <h3 className="text-base font-semibold">{t('ownerAccounting.tax.annualTitle', { year: period.year })}</h3>
          {annual.isPending ? (
            <p role="status" className="text-sm text-foreground/70">
              {t('ownerAccounting.tax.loading')}
            </p>
          ) : annual.isError ? (
            <Alert variant="danger">{messageOf(annual.error, t)}</Alert>
          ) : annualDataset ? (
            <AnnualView dataset={annualDataset} onStep={(step) => setTarget({ file: 'annual', id: annualDataset.id, step })} onRegenerate={() => void run(() => generateAnnual.mutateAsync(period.year), t('ownerAccounting.tax.annualRegenerated'))} regenerating={generateAnnual.isPending} />
          ) : (
            <div className="space-y-2">
              <FilingStatus file={null} />
              <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.tax.annualNone')}</p>
              {toCents(data.obligationsTotal) > 0 ? (
                <Button type="button" size="sm" variant="outline" loading={generateAnnual.isPending} onClick={() => void run(() => generateAnnual.mutateAsync(period.year), t('ownerAccounting.tax.annualGenerated'))} data-testid="tax-generate-annual">
                  {t('ownerAccounting.tax.generateAnnual')}
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <p className="break-words text-sm" data-testid="tax-year-check" data-reconciled={data.reconciled}>
          {data.reconciled
            ? t('ownerAccounting.tax.yearReconciled', { year: data.year, amount: money(data.obligationsTotal, TAX_CURRENCY) })
            : t('ownerAccounting.tax.yearNotReconciled', { year: data.year, obligations: money(data.obligationsTotal, TAX_CURRENCY), f24: money(data.f24Total, TAX_CURRENCY) })}
        </p>
        <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.tax.note')}</p>
      </div>
    );
  }

  return (
    <PlainSection title={t('ownerAccounting.tax.title')} data-testid="tax-filing-panel">
      {body}
      {target ? <FilingDialog target={target} onClose={() => setTarget(null)} /> : null}
    </PlainSection>
  );
}

interface FileViewProps {
  onStep: (step: Step) => void;
  onRegenerate: () => void;
  regenerating: boolean;
}

function StepButtons({ file, onStep }: { file: TaxF24Record | TaxReportingDataset; onStep: (step: Step) => void }) {
  const { t } = useTranslation();
  return (
    <>
      {nextFilingStates(file).map((step) => (
        <Button key={step} type="button" size="sm" variant={step === 'Rejected' ? 'danger-outline' : 'outline'} onClick={() => onStep(step)} data-testid={`filing-step-${step}`}>
          {t(`ownerAccounting.filing.step.${step}`)}
        </Button>
      ))}
    </>
  );
}

function F24View({ record, obligations, onStep, onRegenerate, regenerating }: FileViewProps & { record: TaxF24Record; obligations: number }) {
  const { t } = useTranslation();
  const { money, dateTime } = useOwnerFormat();
  const download = useDownloadF24Pdf();
  const mismatch = toCents(record.totalAmount) !== toCents(obligations);

  return (
    <div className="space-y-2">
      <FilingStatus file={record} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-foreground/70">{t('ownerAccounting.tax.amount')}</dt>
          <dd className="tabular-nums" data-testid="f24-amount">
            {money(record.totalAmount, TAX_CURRENCY)}
          </dd>
        </div>
        <div>
          <dt className="text-foreground/70">{t('ownerAccounting.tax.taxCode')}</dt>
          <dd>{record.taxCode}</dd>
        </div>
        <div>
          <dt className="text-foreground/70">{t('ownerAccounting.tax.dueDate')}</dt>
          <dd>{dateTime(record.dueDate)}</dd>
        </div>
        <div>
          <dt className="text-foreground/70">{t('ownerAccounting.tax.payment')}</dt>
          <dd data-testid="f24-payment">{record.paidAt ? t('ownerAccounting.tax.paidAt', { date: dateTime(record.paidAt) }) : record.isOverdue ? t('ownerAccounting.tax.overdue') : t('ownerAccounting.tax.toPay')}</dd>
        </div>
      </dl>
      {record.ruleVersion ? <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.tax.ruleVersion', { version: record.ruleVersion })}</p> : null}
      {mismatch && record.filingState === 'Generated' ? (
        <Alert variant="warning" data-testid="f24-mismatch">
          {t('ownerAccounting.tax.mismatch', { f24: money(record.totalAmount, TAX_CURRENCY), obligations: money(obligations, TAX_CURRENCY) })}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          loading={download.isPending}
          onClick={() =>
            download.mutate(
              { month: record.referenceMonth, year: record.referenceYear, fileName: `f24-${record.referenceYear}-${String(record.referenceMonth).padStart(2, '0')}.pdf` },
              { onError: (error) => toast.error(messageOf(error, t)) },
            )
          }
          data-testid="f24-pdf"
        >
          {t('ownerAccounting.tax.downloadPdf')}
        </Button>
        <StepButtons file={record} onStep={onStep} />
        {record.filingState === 'Generated' ? (
          <Button type="button" size="sm" variant="ghost" loading={regenerating} onClick={onRegenerate}>
            {t('ownerAccounting.tax.regenerate')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AnnualView({ dataset, onStep, onRegenerate, regenerating }: FileViewProps & { dataset: TaxReportingDataset }) {
  const { t } = useTranslation();
  const { money, dateTime } = useOwnerFormat();

  const save = () => saveBlobAs(new Blob([dataset.payloadJson], { type: 'application/json' }), `certificazione-unica-${dataset.year}-dati.json`);

  return (
    <div className="space-y-2">
      <FilingStatus file={dataset} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-foreground/70">{t('ownerAccounting.tax.base')}</dt>
          <dd className="tabular-nums">{money(dataset.totalGrossBase, TAX_CURRENCY)}</dd>
        </div>
        <div>
          <dt className="text-foreground/70">{t('ownerAccounting.tax.withheld')}</dt>
          <dd className="tabular-nums" data-testid="annual-withheld">
            {money(dataset.totalWithheld, TAX_CURRENCY)}
          </dd>
        </div>
        <div>
          <dt className="text-foreground/70">{t('ownerAccounting.tax.evidenceCount')}</dt>
          <dd className="tabular-nums">{dataset.evidenceCount}</dd>
        </div>
        <div>
          <dt className="text-foreground/70">{t('ownerAccounting.tax.generatedAt')}</dt>
          <dd>{dateTime(dataset.generatedAt)}</dd>
        </div>
      </dl>
      <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.tax.evidenceHash', { hash: dataset.evidenceSha256.slice(0, 12) })}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={save} data-testid="annual-download">
          {t('ownerAccounting.tax.downloadData')}
        </Button>
        <StepButtons file={dataset} onStep={onStep} />
        {dataset.filingState === 'Generated' ? (
          <Button type="button" size="sm" variant="ghost" loading={regenerating} onClick={onRegenerate}>
            {t('ownerAccounting.tax.regenerate')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** One move of a tax file: «verificato» needs only a confirmation; the others ask for the proof they are called by (the handoff, the receipt, the reason). */
function FilingDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const setF24 = useSetF24FilingState();
  const setDataset = useSetDatasetFilingState();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pending = setF24.isPending || setDataset.isPending;
  const needsText = target.step !== 'Reviewed';
  const field = target.step === 'Submitted' ? 'handoffReference' : target.step === 'Accepted' ? 'receiptReference' : 'reason';

  const onConfirm = async () => {
    setError(null);
    const command: TaxFilingCommand = { state: target.step, ...(needsText ? { [field]: text.trim() } : {}) };
    try {
      if (target.file === 'f24') await setF24.mutateAsync({ f24Id: target.id, command });
      else await setDataset.mutateAsync({ datasetId: target.id, command });
      toast.success(t(`ownerAccounting.filing.done.${target.step}`));
    } catch (failure) {
      setError(failureText(failure, t, i18n.exists));
      throw failure;
    }
  };

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(`ownerAccounting.filing.dialog.${target.step}.title`)}
      description={t(`ownerAccounting.filing.dialog.${target.step}.description`)}
      confirmLabel={t(`ownerAccounting.filing.dialog.${target.step}.confirm`)}
      variant={target.step === 'Rejected' ? 'destructive' : 'default'}
      isLoading={pending}
      confirmDisabled={needsText && text.trim().length === 0}
      onConfirm={onConfirm}
    >
      <div className="space-y-3">
        {needsText ? (
          <Field label={t(`ownerAccounting.filing.dialog.${target.step}.field`)} hint={t(`ownerAccounting.filing.dialog.${target.step}.hint`)}>
            {target.step === 'Rejected' ? (
              <Textarea value={text} maxLength={500} rows={3} onChange={(event) => setText(event.target.value)} data-testid="filing-text" />
            ) : (
              <Input value={text} maxLength={200} autoComplete="off" onChange={(event) => setText(event.target.value)} data-testid="filing-text" />
            )}
          </Field>
        ) : null}
        {error ? (
          <Alert variant="danger" data-testid="filing-error">
            {error}
          </Alert>
        ) : null}
      </div>
    </ConfirmationDialog>
  );
}
