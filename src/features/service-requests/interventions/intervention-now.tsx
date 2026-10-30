import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FocusBlock, type CalmAction, type CalmTone } from '@/components/shared/calm';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { ServiceRequest } from '@/types/service-request';
import { cancellationReasonText, instantToCome, supplierRef, whenText } from '../long-rent/long-rent-request-model';
import { againPathOf, hostActionKind, mayDo, phoneHref, remindWaitText, type HostPermissions } from './intervention-model';
import { INTERVENTIONS_PATH } from './paths';
import type { InterventionSteps } from './use-intervention-actions';

const DATE_TIME: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };

interface InterventionNowProps {
  request: ServiceRequest;
  steps: InterventionSteps;
  /** A step is running: the button of the block waits. */
  busy: boolean;
  permissions: HostPermissions;
  /** A card payment was sent to Stripe and the backend has not said it is paid yet: «Paga» waits for it. */
  paymentSent?: boolean;
}

interface BlockProps {
  tone: CalmTone;
  title: string;
  body?: ReactNode;
  primary: CalmAction;
  secondary?: CalmAction;
  then?: string;
  turn: 'you' | 'supplier' | null;
}

/**
 * «Prossimo passo» of an intervention (SR-08), in the drawer and on the page: the one highlighted block. What it offers is what the server
 * says the host can do (`hostAction`, `availableActions`): the block names the case, says whose turn it is and gives the one button, and has
 * no state logic of its own. Where the host has nothing to do, or may not do it (a collaborator without `property.write`), the button leads to
 * the list. Nothing is written to the supplier but by the host's press: a reminder, an answer to a time, a payment.
 *
 * The words are those of the long-rent page (`longRentRequests.next.*`): the same sentences say the same things in both areas.
 */
export function InterventionNow({ request, steps, busy, permissions, paymentSent = false }: InterventionNowProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const kind = hostActionKind(request);
  const names = supplierRef(request, t);
  const when = whenText(request, language, t, true);
  /** "venerdì 30 ottobre, 10:00–12:30 · 2 ore": the day and, when the request has one, the time. */
  const line = (w: { day: string | null; time: string | null }) => [w.day, w.time].filter(Boolean).join(', ');
  const money = (cents: number | null | undefined) => (cents === null || cents === undefined ? null : formatMoney(cents, language));
  const amount = money(request.price?.amountCents);
  const phone = request.supplierContact?.phone?.trim();

  // A block always has a way to go on: where the host has nothing to do (or may not do it), the list of the interventions.
  const allRequests: CalmAction = { label: t('longRentRequests.next.allRequests'), href: INTERVENTIONS_PATH };
  const ifAllowed = (action: string, calm: CalmAction): CalmAction => (mayDo(action, permissions) ? calm : allRequests);
  const contact: CalmAction | undefined = phone ? { label: t('interventions.action.contact'), href: phoneHref(phone) } : undefined;

  const block = ({ tone, title, body, primary, secondary, then, turn }: BlockProps) => (
    <FocusBlock
      tone={tone}
      kicker={t('longRentRequests.next.kicker')}
      title={title}
      body={body}
      who={turn ? t(`longRentRequests.next.who.${turn}`) : undefined}
      primary={primary}
      secondary={secondary}
      then={then}
      data-testid="intervention-next-step"
      data-action={kind}
    />
  );

  /** A new request nobody answered yet: the reminder when the server offers it, and when it will offer it again when it does not. */
  const waiting = () => {
    const respondBy = instantToCome(request.respondBy);
    const by = respondBy ? formatRomeDateTime(respondBy, language, DATE_TIME) : null;
    const reminded = request.lastRemindedAt ? formatRomeDateTime(request.lastRemindedAt, language, DATE_TIME) : null;
    const wait = remindWaitText(request, t);
    const primary: CalmAction =
      kind === 'remind'
        ? ifAllowed('remind', { label: t('longRentRequests.next.waiting.remind'), onClick: () => steps.remind(request), loading: busy })
        : wait && mayDo('remind', permissions)
          ? { label: wait, onClick: () => undefined, disabled: true }
          : allRequests;
    return block({
      tone: 'neutral',
      title: t('longRentRequests.next.waiting.title', names),
      body: (
        <>
          <span className="block">{t('longRentRequests.next.waiting.body')}</span>
          {by ? <span className="mt-1 block">{t('longRentRequests.next.waiting.respondBy', { when: by })}</span> : null}
          {/* SP-BKP: the request went to backup suppliers too; the group below says who they are. */}
          {request.group?.phase === 'PrimaryWindow' || request.group?.phase === 'BackupWindow' ? (
            <span className="mt-1 block text-foreground/70" data-testid="intervention-next-step-backups">
              {t(request.group.phase === 'PrimaryWindow' ? 'interventions.group.waitingNote' : 'interventions.group.waitingNoteOpen')}
            </span>
          ) : null}
          {reminded ? <span className="mt-1 block text-foreground/70">{t('longRentRequests.next.waiting.reminded', { when: reminded })}</span> : null}
        </>
      ),
      primary,
      secondary: contact,
      then: t('longRentRequests.next.waiting.then'),
      turn: 'supplier',
    });
  };

  switch (kind) {
    case 'acceptProposal': {
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
        primary: ifAllowed('acceptProposal', {
          label: t('longRentRequests.next.proposal.accept'),
          onClick: () => steps.acceptProposal(request),
          loading: busy,
        }),
        secondary: mayDo('rejectProposal', permissions)
          ? { label: t('longRentRequests.next.proposal.reject'), onClick: () => steps.rejectProposal(request), disabled: busy }
          : undefined,
        then: t('longRentRequests.next.proposal.then'),
        turn: 'you',
      });
    }

    case 'confirmFinalAmount': {
      const quoted = money(request.price?.quotedAmountCents);
      const final = money(request.price?.finalAmountCents) ?? amount;
      return block({
        tone: 'warning',
        title: t('longRentRequests.next.confirmAmount.title'),
        body: quoted
          ? t('longRentRequests.next.confirmAmount.body', { ...names, final: final ?? '', quoted })
          : t('longRentRequests.next.confirmAmount.bodyNoQuote', { ...names, final: final ?? '' }),
        primary: ifAllowed('confirmFinalAmount', {
          label: final ? t('longRentRequests.next.confirmAmount.actionAmount', { amount: final }) : t('longRentRequests.next.confirmAmount.action'),
          onClick: () => steps.confirmAmount(request),
          loading: busy,
        }),
        then: t('longRentRequests.next.confirmAmount.then'),
        turn: 'you',
      });
    }

    case 'pay':
      return block({
        tone: 'warning',
        title: t('longRentRequests.next.pay.title'),
        body: amount ? t('longRentRequests.next.pay.bodyOnline', { amount }) : t('longRentRequests.next.pay.bodyOnlineNoAmount'),
        primary: ifAllowed('pay', {
          label: amount ? t('longRentRequests.next.pay.actionOnline', { amount }) : t('longRentRequests.next.pay.actionOnlineNoAmount'),
          onClick: () => steps.pay(request),
          loading: busy || paymentSent,
        }),
        turn: 'you',
      });

    case 'markPaid':
      return block({
        tone: 'warning',
        title: t('longRentRequests.next.pay.title'),
        body: amount ? t('longRentRequests.next.pay.bodyManual', { amount }) : t('longRentRequests.next.pay.bodyManualNoAmount'),
        primary: ifAllowed('markPaid', { label: t('longRentRequests.next.pay.actionManual'), onClick: () => steps.markPaid(request) }),
        turn: 'you',
      });

    case 'remind':
      return waiting();

    case 'requestAgain': {
      const again = (label: string): CalmAction =>
        mayDo('requestAgain', permissions) ? { label, href: againPathOf(request) } : allRequests;
      if (request.status === 'Rifiutato') {
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
          primary: again(t('longRentRequests.next.rejected.action')),
          turn: 'you',
        });
      }
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
        primary: again(t('longRentRequests.next.again')),
        turn: null,
      });
    }

    default:
      break;
  }

  // Nothing is asked of the host: the supplier is at work, or it is over.
  switch (request.status) {
    case 'Richiesto':
      return waiting();

    case 'PresoInCarico':
      return block({
        tone: 'info',
        title: when.day ? t('longRentRequests.next.scheduled.title', { day: when.day }) : t('longRentRequests.next.scheduled.titleNoDay'),
        body: when.day ? t('longRentRequests.next.scheduled.body', { ...names, when: line(when) }) : t('longRentRequests.next.scheduled.bodyNoDay', names),
        primary: contact ?? allRequests,
        secondary: contact ? allRequests : undefined,
        then: t('longRentRequests.next.scheduled.then'),
        turn: 'supplier',
      });

    case 'InCorso': {
      const since = request.startedAt ? formatRomeDateTime(request.startedAt, language, DATE_TIME) : null;
      return block({
        tone: 'info',
        title: t('longRentRequests.next.inProgress.title'),
        body: since ? t('longRentRequests.next.inProgress.bodySince', { ...names, when: since }) : t('longRentRequests.next.inProgress.body', names),
        primary: contact ?? allRequests,
        secondary: contact ? allRequests : undefined,
        then: t('longRentRequests.next.inProgress.then'),
        turn: 'supplier',
      });
    }

    case 'Pagato':
      return block({
        tone: 'success',
        title: t('longRentRequests.next.paid.title'),
        body: t('longRentRequests.next.paid.body'),
        primary: ifAllowed('requestAgain', { label: t('longRentRequests.next.again'), href: againPathOf(request) }),
        turn: null,
      });

    default:
      return block({
        tone: 'neutral',
        title: t('longRentRequests.next.unknown.title'),
        body: t('longRentRequests.next.unknown.body', { status: request.status }),
        primary: allRequests,
        turn: null,
      });
  }
}
