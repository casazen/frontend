import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useNow } from '@/hooks/use-now';
import { useReplySupplierDispute, useSupplierDispute } from '@/queries/supplier/use-inquiry';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { ServiceRequestStatus, SupplierServiceRequest } from '@/types/service-request';
import { DISPUTE_REPLY_MAX_LENGTH, type SupplierServiceDispute } from '@/types/supplier-inquiry';
import { formatMoney } from '../services/lib/service-money';

const T = 'supplier.dispute';

/** A complaint can exist only for a job that was taken (or done) and is paid inside CasaZen, where the money is held until it is settled. */
const DISPUTABLE: readonly ServiceRequestStatus[] = ['PresoInCarico', 'InCorso', 'Completato', 'Pagato'];
const KNOWN_REASONS = new Set(['not_done', 'incomplete', 'poor_quality', 'not_as_described', 'other']);
const KNOWN_STATES = new Set(['AwaitingSupplier', 'AwaitingDecision', 'ResolvedForSupplier', 'ResolvedForCustomer', 'Withdrawn']);
const KNOWN_OPENERS = new Set(['customer', 'host', 'system']);

/**
 * The complaint about a job paid inside CasaZen (SP-15c-c), on the page and in the drawer of the request: «Il cliente ha segnalato un problema»
 * with the reason, the payer's words, the time left to reply and the supplier's one reply in its own words (text only, at most 1000
 * characters). It exists only with online payments on and for a job paid that way, and only when the server has a complaint for it (the
 * answer «none» is not an error and shows nothing).
 */
export function RequestDispute({ request, suspended }: { request: SupplierServiceRequest; suspended: boolean }) {
  const { flags } = useFeatureFlags();
  const possible = isFeatureEnabled(flags, 'supplierOnlinePayments') && request.paymentMode === 'Online' && DISPUTABLE.includes(request.status);
  const dispute = useSupplierDispute(request.id, possible);
  if (!possible || !dispute.data) return null;
  return <DisputeBlock request={request} dispute={dispute.data} suspended={suspended} />;
}

/**
 * What goes with the money in each state, as the server decided it: nothing is promised about a date, and no figure is worked out here
 * (the refund is the one the server says). An outcome for the customer can weigh on the supplier's standing, said without numbers (VT-D17).
 */
function MoneyLine({ dispute }: { dispute: SupplierServiceDispute }) {
  const { t, i18n } = useTranslation();
  const state = KNOWN_STATES.has(dispute.status) ? dispute.status : 'AwaitingDecision';
  if (state === 'ResolvedForCustomer') {
    const refund = dispute.refundCents;
    return (
      <>
        <p className="break-words font-medium" data-testid="supplier-dispute-money">
          {refund !== null && refund !== undefined ? t(`${T}.money.ResolvedForCustomerRefund`, { amount: formatMoney(refund, i18n.language) }) : t(`${T}.money.ResolvedForCustomer`)}
        </p>
        <p className="break-words text-sm text-foreground/70">{t(`${T}.weight`)}</p>
      </>
    );
  }
  return (
    <p className="break-words font-medium" data-testid="supplier-dispute-money">
      {t(`${T}.money.${state}`)}
    </p>
  );
}

function DisputeBlock({ request, dispute, suspended }: { request: SupplierServiceRequest; dispute: SupplierServiceDispute; suspended: boolean }) {
  const { t, i18n } = useTranslation();
  const reply = useReplySupplierDispute(request.id);
  const now = useNow();
  const [text, setText] = useState('');
  const trimmed = text.trim();

  const state = KNOWN_STATES.has(dispute.status) ? dispute.status : 'AwaitingDecision';
  const reason = KNOWN_REASONS.has(dispute.reason) ? dispute.reason : 'other';
  const opener = KNOWN_OPENERS.has(dispute.openedBy) ? dispute.openedBy : 'customer';
  const client = request.clientName?.trim() || t('supplier.requests.facts.clientUnknown');
  const late = Date.parse(dispute.replyDueAt) <= now;
  const when = (instant: string) => formatRomeDateTime(instant, i18n.language, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // The block sits inside the drawer or the page: the form around them must not hear this submit.
    event.stopPropagation();
    if (!trimmed || reply.isPending) return;
    reply.mutate(trimmed, { onSuccess: () => setText('') });
  };

  return (
    <PlainSection title={t(`${T}.title.${opener}`)} data-testid="supplier-dispute" data-state={state}>
      <p className="font-medium" data-testid="supplier-dispute-state">
        {t(`${T}.status.${state}`)}
      </p>

      {dispute.noShow ? (
        <p className="break-words text-sm sm:text-base">{t(`${T}.noShow`)}</p>
      ) : (
        <p className="break-words text-sm sm:text-base">
          <span className="font-semibold">{t(`${T}.reasonLabel`)}</span> {t(`${T}.reason.${reason}`)}
        </p>
      )}
      {dispute.customerText ? (
        <blockquote className="space-y-1 border-l-2 pl-3" data-testid="supplier-dispute-text">
          <p className="text-sm font-semibold text-foreground/70">{t(`${T}.said`, { name: client })}</p>
          <p className="whitespace-pre-line break-words">{dispute.customerText}</p>
        </blockquote>
      ) : null}

      <MoneyLine dispute={dispute} />

      {dispute.reply ? (
        <div className="space-y-1" data-testid="supplier-dispute-reply">
          <p className="text-sm font-semibold text-foreground/70">
            {t(`${T}.yourReply`)}
            {dispute.repliedAt ? ` · ${t(`${T}.repliedAt`, { when: when(dispute.repliedAt) })}` : ''}
          </p>
          <p className="whitespace-pre-line break-words">{dispute.reply}</p>
        </div>
      ) : null}

      {dispute.canReply ? (
        <form onSubmit={submit} className="space-y-3" noValidate data-testid="supplier-dispute-form">
          <p className="break-words text-sm text-foreground/80">{late ? t(`${T}.deadlineLate`) : t(`${T}.deadline`, { when: when(dispute.replyDueAt) })}</p>
          <Field label={t(`${T}.replyLabel`)} counter={`${text.length}/${DISPUTE_REPLY_MAX_LENGTH}`}>
            <Textarea
              value={text}
              maxLength={DISPUTE_REPLY_MAX_LENGTH}
              rows={4}
              placeholder={t(`${T}.replyPlaceholder`)}
              disabled={suspended}
              onChange={(event) => setText(event.target.value)}
              data-testid="supplier-dispute-reply-text"
            />
          </Field>
          <p className="text-sm text-foreground/70">{t(`${T}.replyHint`)}</p>
          <Button type="submit" loading={reply.isPending} disabled={!trimmed || suspended} className="min-h-11 w-full sm:w-auto" data-testid="supplier-dispute-send">
            {t(`${T}.send`)}
          </Button>
          {suspended ? <p className="text-sm text-foreground/70">{t('supplier.requests.suspendedHint')}</p> : null}
        </form>
      ) : null}
    </PlainSection>
  );
}
