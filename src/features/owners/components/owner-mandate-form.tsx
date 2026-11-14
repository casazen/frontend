import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PlainSection } from '@/components/shared/calm';
import { Badge } from '@/components/ui/badge';
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

interface OwnerMandateSectionProps {
  ownerId: string;
  /** The settlement currency of the owner (its fiscal profile); `null` while the profile has none. The flat fees of a stay are in it. */
  currency: string | null;
  /** Who may write (`agency.owner.financial.manage`). Without it the versions are read and no form is offered. */
  canManage: boolean;
}

const BASES: readonly CommissionBase[] = ['GrossExclTouristTax', 'GrossExclTouristTaxAndCleaning'];

/**
 * «Mandato» of an owner (E13/F02/US01/T01, NF-110, NF-115): the versions of the terms between the agency and the owner, the newest first, with the one in force marked, and «Nuova versione»
 * for who manages the finances of the owners. A new version starts on a day after the start of every other and ends the one in force the day before; nothing already posted changes.
 * The commission is «+ IVA» unless the terms say they already hold it (⚖ R4); the flat fees are per stay, in the settlement currency of the owner, and written without a symbol while the
 * profile of the owner has none (the page says so, it never assumes a euro). A version that could not be read is never told as «no mandate».
 */
export function OwnerMandateSection({ ownerId, currency, canManage }: OwnerMandateSectionProps) {
  const { t } = useTranslation();
  const mandates = useOwnerMandates(ownerId);
  const [adding, setAdding] = useState(false);
  const today = todayInRome();
  const versions = mandates.data;
  const hasFees = (versions ?? []).some((mandate) => mandate.cleaningFlatRate !== null || mandate.linenFlatRate !== null);

  let content;
  // A 404 is «not found» whatever the cache still holds (a failed read keeps the old data).
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
    content = <p className="break-words text-sm text-foreground/70" data-testid="owner-mandate-missing">{t('ownerMandate.missing')}</p>;
  } else {
    content = (
      <ul role="list" className="divide-y divide-border text-sm" data-testid="owner-mandate-versions">
        {versions.map((mandate) => (
          <MandateVersion key={mandate.id} mandate={mandate} currency={currency} today={today} />
        ))}
      </ul>
    );
  }

  const newVersion = canManage && mandates.isSuccess ? { actionLabel: t('ownerMandate.newVersion'), onAction: () => setAdding(true), actionTestId: 'mandate-new-version' } : {};

  return (
    <PlainSection title={t('ownerMandate.title')} count={versions?.length} {...newVersion} data-testid="owner-mandate-section">
      {content}
      {currency === null && hasFees ? <p className="break-words text-sm text-foreground/70" data-testid="owner-mandate-currency-missing">{t('ownerMandate.currencyMissing')}</p> : null}
      {!canManage ? <p className="break-words text-sm text-foreground/70" data-testid="owner-mandate-read-only">{t('ownerMandate.readOnly')}</p> : null}
      {adding && versions ? (
        <MandateDialog open onOpenChange={(open) => !open && setAdding(false)} ownerId={ownerId} currency={currency} versions={versions} />
      ) : null}
    </PlainSection>
  );
}

function MandateVersion({ mandate, currency, today }: { mandate: OwnerMandate; currency: string | null; today: string }) {
  const { t } = useTranslation();
  const { date, percent, money, amount } = useOwnerFormat();
  const inForce = mandateCovers(mandate, today);
  const fee = (value: number) => (currency ? money(value, currency) : amount(value));

  return (
    <li className="space-y-1 py-3" data-testid="owner-mandate-version" data-in-force={inForce}>
      <p className="flex flex-wrap items-center gap-2 font-medium">
        <span className="break-words">
          {mandate.validTo ? t('ownerMandate.version.between', { from: date(mandate.validFrom), to: date(mandate.validTo) }) : t('ownerMandate.version.from', { from: date(mandate.validFrom) })}
        </span>
        {inForce ? <Badge variant="success">{t('ownerMandate.version.inForce')}</Badge> : mandate.validFrom > today ? <Badge variant="outline">{t('ownerMandate.version.upcoming')}</Badge> : null}
      </p>
      <p className="break-words" data-testid="owner-mandate-terms">
        {t('ownerMandate.version.terms', {
          percent: percent(mandate.commissionPercent),
          base: t(`ownerMandate.base.${mandate.commissionBase}`),
          vat: mandate.commissionIncludesVat ? t('ownerMandate.vat.included') : t('ownerMandate.vat.excluded'),
        })}
      </p>
      {mandate.cleaningFlatRate !== null ? <p className="break-words text-foreground/70">{t('ownerMandate.version.cleaning', { amount: fee(mandate.cleaningFlatRate) })}</p> : null}
      {mandate.linenFlatRate !== null ? <p className="break-words text-foreground/70">{t('ownerMandate.version.linen', { amount: fee(mandate.linenFlatRate) })}</p> : null}
      <p className="break-words text-foreground/70">{mandate.passthroughPaymentFees ? t('ownerMandate.version.feesOwner') : t('ownerMandate.version.feesAgency')}</p>
      <p className="break-words text-foreground/70">{mandate.hasDocument ? t('ownerMandate.version.document') : t('ownerMandate.version.noDocument')}</p>
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

/** A number as the person types it in Italian: two decimals, a comma. */
const asField = (value: number): string => value.toFixed(2).replace('.', ',');

/**
 * The form starts from the version the person is replacing (the newest): the terms change on a day, they are not typed again. The first day is today, or the day after the newest
 * version starts when that is later (the server refuses a day that is not). The signed document is never returned by the server, so it is asked again, and left blank it stays absent.
 */
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
  /** The versions of the owner, the newest first: the form starts from the first. */
  versions: readonly OwnerMandate[];
}

/** A new version of the mandate: the commission and its base, whether it holds the VAT, the flat fees of a stay, who bears the card fees, and where the signed mandate is. */
function MandateDialog({ open, onOpenChange, ownerId, currency, versions }: MandateDialogProps) {
  const { t, i18n } = useTranslation();
  const { date } = useOwnerFormat();
  const save = useCreateOwnerMandate(ownerId);
  // The versions the server checks the overlap on are those of the owner (the shape of before E13, of one ownership, is not): the newest of them is what a new version replaces.
  const ofTheOwner = versions.filter((mandate) => mandate.ownershipId === null);
  const latestStart = latestMandateStart(ofTheOwner);
  // Its terms are the ones the form starts from, and the treatment of the commission is carried over from it: the form has no field for it.
  const from = ofTheOwner.find((mandate) => mandate.validFrom === latestStart) ?? null;
  const [form, setForm] = useState<FormState>(() => initial(from, latestStart));
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const percent = parseEuroAmount(form.commissionPercent);
  const percentOk = percent !== null && percent >= 0 && percent <= 100;
  const cleaning = flatFeeOf(form.cleaningFlatRate);
  const linen = flatFeeOf(form.linenFlatRate);
  const document = form.documentReference.trim();
  const documentOk = document === '' || (HTTPS.test(document) && document.length <= DOCUMENT_MAX);
  // The server refuses a version that does not start after the newest one (409 `owner_mandate_overlap`): the form says so before it is sent.
  const startsAfterTheLast = latestStart === null || !DAY.test(form.validFrom) || form.validFrom > latestStart;
  const valid = DAY.test(form.validFrom) && startsAfterTheLast && percentOk && cleaning.ok && linen.ok && documentOk;

  const feeLabel = (kind: 'cleaningFlatRate' | 'linenFlatRate') => (currency ? t('ownerMandate.dialog.feeWithCurrency', { fee: t(`ownerMandate.fields.${kind}`), currency }) : t(`ownerMandate.fields.${kind}`));
  const cleaningLabel = feeLabel('cleaningFlatRate');
  const linenLabel = feeLabel('linenFlatRate');
  const feeHint = currency ? t('ownerMandate.dialog.feeHint') : t('ownerMandate.dialog.feeHintNoCurrency');

  const onSubmit = async () => {
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
      await save.mutateAsync(command);
      toast.success(t('ownerMandate.dialog.done'));
      onOpenChange(false);
    } catch (failure) {
      setError(failureText(failure, t, i18n.exists));
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('ownerMandate.dialog.title')}
      description={t('ownerMandate.dialog.description')}
      submitLabel={t('ownerMandate.dialog.submit')}
      pending={save.isPending}
      submitDisabled={!valid}
      error={error}
      onSubmit={onSubmit}
      testId="mandate-dialog"
    >
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
            error={form.commissionPercent.trim() === '' || percentOk ? undefined : 'ownerMandate.dialog.percentInvalid'}
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

      <fieldset className="grid gap-4 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{t('ownerMandate.dialog.fees')}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={cleaningLabel} optional hint={feeHint} error={cleaning.ok ? undefined : 'ownerMandate.dialog.feeInvalid'}>
            <Input value={form.cleaningFlatRate} inputMode="decimal" maxLength={14} autoComplete="off" onChange={(event) => set({ cleaningFlatRate: event.target.value })} data-testid="mandate-cleaning" />
          </Field>
          <Field label={linenLabel} optional hint={feeHint} error={linen.ok ? undefined : 'ownerMandate.dialog.feeInvalid'}>
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
      </fieldset>

      <Field label={t('ownerMandate.fields.documentReference')} optional hint={t('ownerMandate.dialog.documentHint')} error={documentOk ? undefined : 'ownerMandate.dialog.documentInvalid'}>
        <Input value={form.documentReference} maxLength={DOCUMENT_MAX} autoComplete="off" inputMode="url" onChange={(event) => set({ documentReference: event.target.value })} data-testid="mandate-document" />
      </Field>
    </FormDialog>
  );
}
