import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { translateErrorCode } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useConfirmPayout, usePayoutPreview } from '@/queries/use-owner-accounting';
import { useProperties } from '@/queries/use-properties';
import type { OwnerPayout, OwnerPayoutPreview } from '@/types';
import {
  buildPayoutCommand,
  fieldNameOf,
  messageOf,
  ownerFinancialPath,
  payoutKeyFor,
  problemFacts,
  settlePayoutKey,
  type ActionContext,
  type PayoutForm,
  type PayoutFormErrors,
} from '../owner-accounting-model';
import { decisionReasonWords, payoutBlockOf, type PayoutBlock } from '../payout-facts-model';
import { useOwnerFormat } from '../use-owner-format';
import { PayoutFactsView } from './payout-facts-view';
import { TaxEvidenceView } from './tax-evidence';

interface PayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: ActionContext;
}

/** What stops the payout, in words: the way out of a rule that is not usable is the data of the owner. */
function BlockNotice({ block, ctx }: { block: PayoutBlock; ctx: ActionContext }) {
  const { t, i18n } = useTranslation();

  if (block.kind === 'rule') {
    return (
      <Alert
        variant="warning"
        title={t('ownerAccounting.payout.ruleBlocked')}
        action={
          <Button asChild size="sm" variant="outline">
            <Link to={ownerFinancialPath(ctx.ownerId, ctx.period)}>{t('ownerAccounting.payout.openProfile')}</Link>
          </Button>
        }
        data-testid="payout-rule-blocked"
      >
        {t(`ownerAccounting.payout.blocked.${block.reason}`)}
      </Alert>
    );
  }
  if (block.kind === 'nothingLeft') {
    return (
      <Alert variant="info" data-testid="payout-nothing-left">
        {t('ownerAccounting.payout.nothingLeft')}
      </Alert>
    );
  }
  if (block.kind === 'unresolved') {
    return (
      <Alert variant="warning" title={t('ownerAccounting.payout.ruleBlocked')} data-testid="payout-unresolved">
        {t('ownerAccounting.payout.unresolved', { field: fieldNameOf(block.field, t, i18n.exists) })}
      </Alert>
    );
  }
  return (
    <Alert variant="warning" title={t('ownerAccounting.payout.ruleBlocked')} data-testid="payout-blocked-other">
      {translateErrorCode(block.code, t) ?? t('ownerAccounting.payout.blocked.other', { code: block.code })}
    </Alert>
  );
}

/** What the rule decided on the facts, with the figures of the preview: nothing here is typed and nothing is computed by the page. */
function DecisionSummary({ preview }: { preview: OwnerPayoutPreview }) {
  const { t } = useTranslation();
  const { money, percent } = useOwnerFormat();
  const euro = preview.facts.withholdingCurrency;
  const applicable = preview.decision === 'Applicable';
  // The net is the server's: with no withholding it is the balance, with one it is the figure the server worked out, and with neither it is not told.
  const net = preview.netAmount ?? (preview.decision === 'NotApplicable' ? preview.balance : null);

  return (
    <div className="space-y-2 rounded-md border border-border p-3 text-sm" data-testid="payout-decision" data-decision={preview.decision ?? ''}>
      <p className="break-words font-medium">{applicable ? t('ownerAccounting.payout.decision.applicable') : t('ownerAccounting.payout.decision.notApplicable')}</p>
      {preview.reasonCode ? <p className="break-words text-foreground/70">{decisionReasonWords(t, preview.reasonCode)}</p> : null}
      {applicable ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          <div>
            <dt className="text-foreground/70">{t('ownerAccounting.tax.base')}</dt>
            <dd className="tabular-nums" data-testid="payout-base">
              {preview.grossBase !== null ? money(preview.grossBase, euro) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-foreground/70">{t('ownerAccounting.tax.rate')}</dt>
            <dd className="tabular-nums">{preview.ratePercent !== null ? percent(preview.ratePercent) : '—'}</dd>
          </div>
          <div>
            <dt className="text-foreground/70">{t('ownerAccounting.payout.decision.inEuro')}</dt>
            <dd className="tabular-nums" data-testid="payout-withholding-euro">
              {preview.withholdingInEuro !== null ? money(preview.withholdingInEuro, euro) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-foreground/70">{t('ownerAccounting.tax.taxCode')}</dt>
            <dd>{preview.taxCode ?? '—'}</dd>
          </div>
        </dl>
      ) : null}
      {applicable && preview.withholdingAmount !== null && preview.currency !== euro ? (
        <p className="break-words" data-testid="payout-withholding-kept">
          {t('ownerAccounting.payout.decision.kept', { amount: money(preview.withholdingAmount, preview.currency) })}
        </p>
      ) : null}
      {net !== null ? (
        <p className="break-words font-medium" data-testid="payout-net">
          {t('ownerAccounting.payout.decision.net', { amount: money(net, preview.currency) })}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Registers a payout to the owner (E06/F05/US02/T04, «prepare payout»; E18/F01/US01/T01, E18/F02/US01/T01): what is paid is the balance the statement still owes, and the facts the withholding is decided on are read by the server from the
 * owner ledger and shown here as evidence, read only. The person writes the day and, if they want, the reference of the wire: no amount, no «the agency collected», no «it is a short let», no base. The withholding is not
 * computed here either: the preview of the server says what the approved rule in force on that day decides on those facts, and the server decides it again when the payout is confirmed.
 *
 * A payout is confirmed once: its key belongs to what is asked (owner, statement, balance, day), not to this dialog, so a retry, a second click or the dialog opened again with the same facts is the same payout; and the
 * dialog is not left while the request is on its way. What the preview says it would refuse (a rule that is not usable, nothing left to pay, a fact it cannot resolve) is told before the person presses anything,
 * and the button waits for the preview of the day it is on.
 */
export function PayoutDialog({ open, onOpenChange, ctx }: PayoutDialogProps) {
  const { t, i18n } = useTranslation();
  const { money } = useOwnerFormat();
  const { version } = ctx;
  const [form, setForm] = useState<PayoutForm>(() => ({ paidOn: todayInRome(), reference: '' }));
  const [errors, setErrors] = useState<PayoutFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<OwnerPayout | null>(null);

  const confirm = useConfirmPayout();
  const read = usePayoutPreview(version?.id, form.paidOn, done === null);
  const properties = useProperties();
  const propertyNames = useMemo(() => new Map((Array.isArray(properties.data) ? properties.data : []).map((property) => [property.id, property.name] as const)), [properties.data]);

  // A read that failed is the server's word, whatever an earlier answer of the same day left in the cache.
  const preview = read.isError ? undefined : read.data;
  const block = preview ? payoutBlockOf(preview) : null;
  // The preview of this day is being read again (the window came back, the day changed): nothing is confirmed on what may be old.
  const checking = read.isFetching;
  const loading = read.isPending && read.fetchStatus === 'fetching';

  const set = (patch: Partial<PayoutForm>) => setForm((current) => ({ ...current, ...patch }));
  // A request is on its way: the state of the mutation says it a moment later than the click, so a second submit in between is stopped here.
  const sending = useRef(false);

  // The request is on its way: the dialog stays (Escape, the cross and a click outside all end here), so nobody opens another one for a payout that may be recorded already.
  const dismiss = (next: boolean) => {
    if (!next && (confirm.isPending || sending.current)) return;
    onOpenChange(next);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!version || !preview || block !== null || confirm.isPending || checking || sending.current) return;
    const built = buildPayoutCommand(form, { ownerId: ctx.ownerId, versionId: version.id, currency: preview.currency, balance: preview.balance }, payoutKeyFor);
    if ('errors' in built) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    setFailure(null);
    sending.current = true;
    try {
      const payout = await confirm.mutateAsync(built.command);
      // Confirmed: the same facts asked again are another payout, which gets its own key.
      settlePayoutKey({ ownerId: ctx.ownerId, statementVersionId: version.id, balance: preview.balance, paidOn: form.paidOn });
      setDone(payout);
      toast.success(t('ownerAccounting.payout.done', { owner: ctx.ownerName }));
    } catch (error) {
      const facts = problemFacts(error);
      // A fact the rule needs that the ledger could not give: the server names it, and it is told beside the facts.
      setFailure(
        facts.code === 'tax_applicability_unresolved' && facts.field ? t('ownerAccounting.payout.unresolved', { field: fieldNameOf(facts.field, t, i18n.exists) }) : messageOf(error, t),
      );
      // What the person saw is not what the server has (the balance moved, the rule changed): the preview is read again, and it says what is true now.
      if (facts.status === 409 || facts.status === 422) void read.refetch();
    } finally {
      sending.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={dismiss}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('ownerAccounting.payout.title')}</DialogTitle>
          <DialogDescription>{t('ownerAccounting.payout.description', { owner: ctx.ownerName })}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4" data-testid="payout-done">
            <Alert variant="success" title={t('ownerAccounting.payout.recorded')}>
              {t('ownerAccounting.payout.recordedBody', {
                gross: money(done.grossAmount, done.currency),
                withheld: money(done.withholdingAmount, done.currency),
                net: money(done.netAmount, done.currency),
              })}
            </Alert>
            {done.evidence.map((evidence) => (
              <TaxEvidenceView key={evidence.id} evidence={evidence} propertyNames={propertyNames} />
            ))}
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t('shared.close')}
              </Button>
            </DialogFooter>
          </div>
        ) : !version ? (
          <Alert variant="warning">{t('ownerAccounting.payout.noVersion')}</Alert>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4" data-testid="payout-form">
            {loading ? (
              <p role="status" className="text-sm text-foreground/70" data-testid="payout-loading">
                {t('ownerAccounting.payout.loading')}
              </p>
            ) : read.isError ? (
              <Alert
                variant="danger"
                title={t('ownerAccounting.payout.previewError')}
                action={
                  <Button type="button" size="sm" variant="outline" onClick={() => void read.refetch()}>
                    {t('shared.errorState.retry')}
                  </Button>
                }
                data-testid="payout-preview-error"
              >
                {messageOf(read.error, t)}
              </Alert>
            ) : preview ? (
              <>
                {block ? <BlockNotice block={block} ctx={ctx} /> : null}
                <p className="break-words text-sm" data-testid="payout-balance">
                  {t('ownerAccounting.payout.balance', { amount: money(preview.balance, preview.currency) })}
                </p>
                <section className="space-y-2" aria-labelledby="payout-facts-title" data-testid="payout-facts">
                  <h3 id="payout-facts-title" className="text-base font-semibold">
                    {t('ownerAccounting.payout.facts')}
                  </h3>
                  <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.payout.factsHint')}</p>
                  <PayoutFactsView facts={preview.facts} propertyNames={propertyNames} />
                </section>
                {preview.decision !== null ? <DecisionSummary preview={preview} /> : null}
              </>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('ownerAccounting.payout.paidOn')} error={errors.paidOn}>
                <Input type="date" value={form.paidOn} onChange={(event) => set({ paidOn: event.target.value })} data-testid="payout-paid-on" />
              </Field>
              <Field label={t('ownerAccounting.payout.reference')} optional error={errors.reference}>
                <Input value={form.reference} maxLength={100} autoComplete="off" onChange={(event) => set({ reference: event.target.value })} data-testid="payout-reference" />
              </Field>
            </div>

            <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.payout.withholdingNote')}</p>

            {checking && !loading ? (
              <p role="status" className="text-sm text-foreground/70" data-testid="payout-checking">
                {t('ownerAccounting.payout.checking')}
              </p>
            ) : null}

            {failure ? (
              <Alert variant="danger" data-testid="payout-error">
                {failure}
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={confirm.isPending}>
                {t('shared.cancel')}
              </Button>
              <Button type="submit" loading={confirm.isPending} disabled={!preview || block !== null || checking} data-testid="payout-confirm">
                {t('ownerAccounting.payout.confirm')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
