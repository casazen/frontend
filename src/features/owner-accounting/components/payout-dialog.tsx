import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { todayInRome } from '@/lib/stay-dates';
import { useAccountingPolicies, useConfirmPayout, useFiscalProfiles, useOwnerPayouts } from '@/queries/use-owner-accounting';
import type { OwnerPayout } from '@/types';
import {
  buildPayoutCommand,
  messageOf,
  newIdempotencyKey,
  ownerFinancialPath,
  previewReconciliation,
  problemFacts,
  resolveRule,
  type ActionContext,
  type PayoutForm,
  type PayoutFormErrors,
} from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';
import { TaxEvidenceView } from './tax-evidence';

interface PayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: ActionContext;
}

const asFormAmount = (amount: number) => amount.toFixed(2).replace('.', ',');

/**
 * Registers a payout to the owner (E06/F05/US02/T04, «prepare payout»): what was paid, when, and the facts the approved rule of the owner needs to
 * decide the withholding. The page asks only what the rule asks, never defaults an answer, and does not compute the withholding: it is decided by
 * the server when the payout is confirmed, on the rule in force on the day of the payment, and shown here with its evidence. A payout is
 * confirmed once: the key of the request is made when the dialog opens, so a repeated click or a retry is the same payout.
 */
export function PayoutDialog({ open, onOpenChange, ctx }: PayoutDialogProps) {
  const { t } = useTranslation();
  const { money, dateTime } = useOwnerFormat();
  const { version } = ctx;
  const [key] = useState(newIdempotencyKey);
  const [form, setForm] = useState<PayoutForm>(() => ({ gross: '', paidOn: todayInRome(), reference: '', agencyCollected: '', qualifyingShortLet: '', components: {} }));
  const [errors, setErrors] = useState<PayoutFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<OwnerPayout | null>(null);

  const confirm = useConfirmPayout();
  const profiles = useFiscalProfiles(ctx.ownerId);
  const policies = useAccountingPolicies();
  const payouts = useOwnerPayouts(ctx.ownerId);
  const rule = profiles.data && policies.data ? resolveRule(profiles.data, policies.data, form.paidOn) : null;
  const loadingRule = profiles.isPending || policies.isPending;
  const left = version && payouts.data ? previewReconciliation(version, payouts.data.filter((payout) => ctx.versionIds.includes(payout.statementVersionId)), ctx.versionIds).difference : null;

  const set = (patch: Partial<PayoutForm>) => setForm((current) => ({ ...current, ...patch }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!version || !rule?.ok || confirm.isPending) return;
    const built = buildPayoutCommand(form, { ownerId: ctx.ownerId, versionId: version.id, currency: version.currency }, rule.parameters, key);
    if ('errors' in built) {
      setErrors(built.errors);
      return;
    }
    setErrors({});
    setFailure(null);
    try {
      const payout = await confirm.mutateAsync(built.command);
      setDone(payout);
      toast.success(t('ownerAccounting.payout.done', { owner: ctx.ownerName }));
    } catch (error) {
      const facts = problemFacts(error);
      const message = messageOf(error, t);
      // A fact the rule needs that the form did not carry: the server names it, and it is shown beside the question that asks it.
      setFailure(facts.code === 'tax_applicability_unresolved' && facts.field ? t('ownerAccounting.payout.unresolved', { field: facts.field }) : message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <TaxEvidenceView key={evidence.id} evidence={evidence} currency={done.currency} />
            ))}
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t('shared.close')}
              </Button>
            </DialogFooter>
          </div>
        ) : !version ? (
          <Alert variant="warning">{t('ownerAccounting.payout.noVersion')}</Alert>
        ) : loadingRule ? (
          <p role="status" className="text-sm text-foreground/70">
            {t('ownerAccounting.payout.loading')}
          </p>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4" data-testid="payout-form">
            {rule && !rule.ok ? (
              <Alert
                variant="warning"
                title={t('ownerAccounting.payout.ruleBlocked')}
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to={ownerFinancialPath(ctx.ownerId)}>{t('ownerAccounting.payout.openProfile')}</Link>
                  </Button>
                }
                data-testid="payout-rule-blocked"
              >
                {t(`ownerAccounting.payout.blocked.${rule.reason}`)}
              </Alert>
            ) : rule?.ok ? (
              <p className="break-words text-sm text-foreground/70" data-testid="payout-rule">
                {t('ownerAccounting.payout.rule', {
                  rule: rule.policy.ruleCode,
                  version: rule.policy.version,
                  jurisdiction: rule.policy.jurisdiction,
                  approver: rule.policy.approvedByName ?? '',
                  date: dateTime(rule.policy.approvedAt),
                })}
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('ownerAccounting.payout.gross', { currency: version.currency })} hint={left !== null && left > 0 ? t('ownerAccounting.payout.left', { amount: money(left, version.currency) }) : undefined} error={errors.gross}>
                <Input inputMode="decimal" autoComplete="off" value={form.gross} onChange={(event) => set({ gross: event.target.value })} data-testid="payout-gross" />
              </Field>
              <Field label={t('ownerAccounting.payout.paidOn')} error={errors.paidOn}>
                <Input type="date" value={form.paidOn} onChange={(event) => set({ paidOn: event.target.value })} data-testid="payout-paid-on" />
              </Field>
            </div>
            {left !== null && left > 0 ? (
              <div>
                <Button type="button" variant="link" className="h-auto p-0" onClick={() => set({ gross: asFormAmount(left) })} data-testid="payout-use-left">
                  {t('ownerAccounting.payout.useLeft')}
                </Button>
              </div>
            ) : null}

            <Field label={t('ownerAccounting.payout.reference')} optional error={errors.reference}>
              <Input value={form.reference} maxLength={100} autoComplete="off" onChange={(event) => set({ reference: event.target.value })} data-testid="payout-reference" />
            </Field>

            {rule?.ok && rule.parameters.withholdingApplies ? (
              <fieldset className="grid gap-4 rounded-md border border-border p-3" data-testid="payout-facts">
                <legend className="px-1 text-sm font-medium">{t('ownerAccounting.payout.facts')}</legend>
                <p className="text-sm text-foreground/70">{t('ownerAccounting.payout.factsHint')}</p>
                {rule.parameters.requiresAgencyCollection ? (
                  <Field label={t('ownerAccounting.payout.agencyCollected')} error={errors.agencyCollected}>
                    <Select value={form.agencyCollected} onChange={(event) => set({ agencyCollected: event.target.value as PayoutForm['agencyCollected'] })} data-testid="payout-agency-collected">
                      <option value="">{t('ownerAccounting.payout.choose')}</option>
                      <option value="yes">{t('ownerAccounting.payout.yes')}</option>
                      <option value="no">{t('ownerAccounting.payout.no')}</option>
                    </Select>
                  </Field>
                ) : null}
                {rule.parameters.requiresQualifyingShortLet ? (
                  <Field label={t('ownerAccounting.payout.qualifyingShortLet')} error={errors.qualifyingShortLet}>
                    <Select value={form.qualifyingShortLet} onChange={(event) => set({ qualifyingShortLet: event.target.value as PayoutForm['qualifyingShortLet'] })} data-testid="payout-qualifying">
                      <option value="">{t('ownerAccounting.payout.choose')}</option>
                      <option value="yes">{t('ownerAccounting.payout.yes')}</option>
                      <option value="no">{t('ownerAccounting.payout.no')}</option>
                    </Select>
                  </Field>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  {rule.parameters.grossBaseComponents.map((code) => (
                    <Field key={code} label={t('ownerAccounting.payout.component', { component: code })} error={errors.components && !form.components[code] ? errors.components : undefined}>
                      <Input
                        inputMode="decimal"
                        autoComplete="off"
                        value={form.components[code] ?? ''}
                        onChange={(event) => set({ components: { ...form.components, [code]: event.target.value } })}
                        data-testid={`payout-component-${code}`}
                      />
                    </Field>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.payout.withholdingNote')}</p>

            {failure ? (
              <Alert variant="danger" data-testid="payout-error">
                {failure}
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={confirm.isPending}>
                {t('shared.cancel')}
              </Button>
              <Button type="submit" loading={confirm.isPending} disabled={!rule?.ok} data-testid="payout-confirm">
                {t('ownerAccounting.payout.confirm')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
