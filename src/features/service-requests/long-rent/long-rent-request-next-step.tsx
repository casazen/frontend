import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FocusBlock, type CalmAction, type CalmTone } from '@/components/shared/calm';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { formatRomeDateTime } from '@/lib/stay-dates';
import {
  useAcceptLongRentProposal,
  useConfirmLongRentFinalAmount,
  useRejectLongRentProposal,
  useRemindLongRentServiceRequest,
} from '@/queries/use-service-requests';
import type { ServiceRequest } from '@/types/service-request';
import { cancellationReasonText, hostPhaseOf, instantToCome, supplierRef, whenText, type HostPhase } from './long-rent-request-model';
import { LONG_RENT_REQUESTS_PATH } from './paths';

const DATE_TIME: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };

interface RequestNextStepProps {
  request: ServiceRequest;
  /** `property.write` (long-rent): who may only read a request sees what it is waiting for, and no button. */
  canManage: boolean;
  /** «Paga»: asks for the payment session and opens the window of the card. */
  onPay: () => void;
  paying: boolean;
  /** «Segna come pagato»: asks to confirm first. */
  onMarkPaid: () => void;
  /** «Richiedi di nuovo» / «Invia a un altro fornitore»: opens the window of the request, ready with what this one asked. */
  onRequestAgain: () => void;
}

/** Whose turn it is in each phase: the landlord's, the supplier's, or nobody's (it is over). */
const PHASE_TURN: Record<HostPhase, 'you' | 'supplier' | null> = {
  proposal: 'you',
  waiting: 'supplier',
  scheduled: 'supplier',
  inProgress: 'supplier',
  confirmAmount: 'you',
  payOnline: 'you',
  payManual: 'you',
  paid: null,
  rejected: 'you',
  cancelled: null,
  unknown: null,
};

interface BlockProps {
  tone: CalmTone;
  title: string;
  body?: ReactNode;
  primary: CalmAction;
  secondary?: CalmAction;
  then?: string;
}

/**
 * «Prossimo passo» of the page of a request (LR-08b): the one highlighted block, told by what the server says the request is
 * (its state, a time the supplier proposed, an amount to confirm, how it is paid). Each state says what is going on and whose turn
 * it is, and has the one thing to do, if there is one for the landlord. The states where the supplier is at work have only the words.
 *
 * What the landlord does here writes to the supplier only when it presses the button: a reminder, an answer to a time. Nothing goes
 * out by itself. The payment is told as the server sends it: online with the card, or marked by hand, never a state of its own.
 */
export function RequestNextStep({ request, canManage, onPay, paying, onMarkPaid, onRequestAgain }: RequestNextStepProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const remind = useRemindLongRentServiceRequest();
  const accept = useAcceptLongRentProposal();
  const reject = useRejectLongRentProposal();
  const confirm = useConfirmLongRentFinalAmount();

  const phase = hostPhaseOf(request);
  const names = supplierRef(request, t);
  const when = whenText(request, language, t, true);
  /** "venerdì 30 ottobre, 10:00–12:30 · 2 ore": the day and, when the request has one, the time. */
  const line = (w: { day: string | null; time: string | null }) => [w.day, w.time].filter(Boolean).join(', ');
  const turn = PHASE_TURN[phase];
  const money = (cents: number | null | undefined) => (cents === null || cents === undefined ? null : formatMoney(cents, language));
  const amount = money(request.price?.amountCents);

  // A block always has a way to go on: where the landlord has nothing to do (or may not do it), the list of the requests.
  const allRequests: CalmAction = { label: t('longRentRequests.next.allRequests'), href: LONG_RENT_REQUESTS_PATH };
  const ifAllowed = (action: CalmAction): CalmAction => (canManage ? action : allRequests);

  const block = ({ tone, title, body, primary, secondary, then }: BlockProps) => (
    <FocusBlock
      tone={tone}
      kicker={t('longRentRequests.next.kicker')}
      title={title}
      body={body}
      who={turn ? t(`longRentRequests.next.who.${turn}`) : undefined}
      primary={primary}
      secondary={canManage ? secondary : undefined}
      then={then}
      data-testid="long-rent-request-next-step"
      data-phase={phase}
    />
  );

  /** A new request nobody answered yet. A request with a proposal that cannot be read is told the same way. */
  const waiting = () => {
    const respondBy = instantToCome(request.respondBy);
    const by = respondBy ? formatRomeDateTime(respondBy, language, DATE_TIME) : null;
    const reminded = request.lastRemindedAt ? formatRomeDateTime(request.lastRemindedAt, language, DATE_TIME) : null;
    return block({
      tone: 'neutral',
      title: t('longRentRequests.next.waiting.title', names),
      body: (
        <>
          <span className="block">{t('longRentRequests.next.waiting.body')}</span>
          {by ? <span className="mt-1 block">{t('longRentRequests.next.waiting.respondBy', { when: by })}</span> : null}
          {reminded ? <span className="mt-1 block text-foreground/70">{t('longRentRequests.next.waiting.reminded', { when: reminded })}</span> : null}
        </>
      ),
      primary: ifAllowed({ label: t('longRentRequests.next.waiting.remind'), onClick: () => remind.mutate(request.id), loading: remind.isPending }),
      then: t('longRentRequests.next.waiting.then'),
    });
  };

  switch (phase) {
    case 'proposal': {
      const proposal = request.proposal;
      if (!proposal) return waiting();
      const proposed = whenText({ scheduledStart: proposal.startUtc, scheduledEnd: proposal.endUtc }, language, t, true);
      return block({
        tone: 'warning',
        title: t('longRentRequests.next.proposal.title', names),
        body: (
          <>
            <span className="block">{t('longRentRequests.next.proposal.body', { when: line(proposed) })}</span>
            {when.day ? <span className="mt-1 block text-foreground/70">{t('longRentRequests.next.proposal.asked', { when: line(when) })}</span> : null}
            {proposal.message?.trim() ? (
              <span className="mt-1 block">{t('longRentRequests.next.proposal.message', { message: proposal.message.trim() })}</span>
            ) : null}
          </>
        ),
        primary: ifAllowed({
          label: t('longRentRequests.next.proposal.accept'),
          onClick: () => accept.mutate(request.id),
          loading: accept.isPending,
          disabled: reject.isPending,
        }),
        secondary: {
          label: t('longRentRequests.next.proposal.reject'),
          onClick: () => reject.mutate(request.id),
          loading: reject.isPending,
          disabled: accept.isPending,
        },
        then: t('longRentRequests.next.proposal.then'),
      });
    }

    case 'waiting':
      return waiting();

    case 'scheduled':
      return block({
        tone: 'info',
        title: when.day ? t('longRentRequests.next.scheduled.title', { day: when.day }) : t('longRentRequests.next.scheduled.titleNoDay'),
        body: when.day ? t('longRentRequests.next.scheduled.body', { ...names, when: line(when) }) : t('longRentRequests.next.scheduled.bodyNoDay', names),
        primary: allRequests,
        then: t('longRentRequests.next.scheduled.then'),
      });

    case 'inProgress': {
      const since = request.startedAt ? formatRomeDateTime(request.startedAt, language, DATE_TIME) : null;
      return block({
        tone: 'info',
        title: t('longRentRequests.next.inProgress.title'),
        body: since ? t('longRentRequests.next.inProgress.bodySince', { ...names, when: since }) : t('longRentRequests.next.inProgress.body', names),
        primary: allRequests,
        then: t('longRentRequests.next.inProgress.then'),
      });
    }

    case 'confirmAmount': {
      const quoted = money(request.price?.quotedAmountCents);
      const final = money(request.price?.finalAmountCents) ?? amount;
      return block({
        tone: 'warning',
        title: t('longRentRequests.next.confirmAmount.title'),
        body: quoted
          ? t('longRentRequests.next.confirmAmount.body', { ...names, final: final ?? '', quoted })
          : t('longRentRequests.next.confirmAmount.bodyNoQuote', { ...names, final: final ?? '' }),
        primary: ifAllowed({
          label: final ? t('longRentRequests.next.confirmAmount.actionAmount', { amount: final }) : t('longRentRequests.next.confirmAmount.action'),
          onClick: () => confirm.mutate(request.id),
          loading: confirm.isPending,
        }),
        then: t('longRentRequests.next.confirmAmount.then'),
      });
    }

    case 'payOnline':
      return block({
        tone: 'warning',
        title: t('longRentRequests.next.pay.title'),
        body: amount ? t('longRentRequests.next.pay.bodyOnline', { amount }) : t('longRentRequests.next.pay.bodyOnlineNoAmount'),
        primary: ifAllowed({
          label: amount ? t('longRentRequests.next.pay.actionOnline', { amount }) : t('longRentRequests.next.pay.actionOnlineNoAmount'),
          onClick: onPay,
          loading: paying,
        }),
      });

    case 'payManual':
      return block({
        tone: 'warning',
        title: t('longRentRequests.next.pay.title'),
        body: amount ? t('longRentRequests.next.pay.bodyManual', { amount }) : t('longRentRequests.next.pay.bodyManualNoAmount'),
        primary: ifAllowed({ label: t('longRentRequests.next.pay.actionManual'), onClick: onMarkPaid }),
      });

    case 'paid':
      return block({
        tone: 'success',
        title: t('longRentRequests.next.paid.title'),
        body: t('longRentRequests.next.paid.body'),
        primary: ifAllowed({ label: t('longRentRequests.next.again'), onClick: onRequestAgain }),
      });

    case 'rejected': {
      const reason = request.rejectionReason?.trim();
      return block({
        tone: 'warning',
        title: t('longRentRequests.next.rejected.title', names),
        body: (
          <>
            <span className="block">{reason ? t('longRentRequests.next.rejected.reason', { reason }) : t('longRentRequests.next.rejected.noReason')}</span>
            <span className="mt-1 block text-foreground/70">{t('longRentRequests.next.rejected.body')}</span>
          </>
        ),
        primary: ifAllowed({ label: t('longRentRequests.next.rejected.action'), onClick: onRequestAgain }),
      });
    }

    case 'cancelled': {
      const reason = cancellationReasonText(request.cancellationReason, t);
      const by = request.cancelledBy === 'Host' || request.cancelledBy === 'Supplier' || request.cancelledBy === 'System' ? request.cancelledBy : null;
      return block({
        tone: 'neutral',
        title: t('longRentRequests.next.cancelled.title'),
        body: (
          <>
            {by ? <span className="block">{t(`longRentRequests.next.cancelled.by.${by}`)}</span> : null}
            {reason ? <span className="mt-1 block">{t('longRentRequests.next.cancelled.reason', { reason })}</span> : null}
          </>
        ),
        primary: ifAllowed({ label: t('longRentRequests.next.again'), onClick: onRequestAgain }),
      });
    }

    default:
      return block({
        tone: 'neutral',
        title: t('longRentRequests.next.unknown.title'),
        body: t('longRentRequests.next.unknown.body', { status: request.status }),
        primary: allRequests,
      });
  }
}
