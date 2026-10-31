import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ban, CalendarClock, CalendarPlus, Check, CircleAlert, CircleCheck, CircleX, Clock, FileText, Hourglass, PartyPopper, RotateCcw, Wrench } from 'lucide-react';
import { publicBookingApi, type PublicBookingAccess, type PublicBookingView } from '@/api/public-supplier-booking.api';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { buildBookingPath } from '@/lib/supplier-site/booking-params';
import { buildIcs } from '@/lib/supplier-site/calendar-ics';
import { formatDeadline, formatSlotLabel } from '@/lib/supplier-site/format';
import type { RequestFailure } from '@/lib/supplier-site/request-errors';
import { icsEventOf, phaseOf, REQUEST_STAGES, stageIndexOf, toneOf, type RequestPhase } from '@/lib/supplier-site/request-view';
import { CodeLine } from '../booking/code-line';
import { CancelPanel, ReschedulePanel } from './request-panels';
import { useMinuteClock } from './use-minute-clock';

interface RequestViewProps {
  view: PublicBookingView;
  failure: RequestFailure | null;
  pending: boolean;
  /** One action on the booking: the page gives the call, the hook gives the credentials and keeps the answer. */
  act: (call: (access: PublicBookingAccess) => Promise<PublicBookingView>) => Promise<boolean>;
}

const PHASE_ICON: Record<RequestPhase, ReactNode> = {
  waiting: <Hourglass />,
  proposal: <CalendarClock />,
  quote: <FileText />,
  taken: <CircleCheck />,
  inProgress: <Wrench />,
  done: <CircleCheck />,
  paid: <PartyPopper />,
  refused: <CircleX />,
  cancelled: <Ban />,
  custom: <Hourglass />,
};

/** The sentence at the top, from the phase and the facts the server gave (the supplier's own deadlines, its own words, its own price). */
function useHeroText(view: PublicBookingView, phase: RequestPhase) {
  const { t, i18n } = useTranslation();
  const name = view.supplier.name;
  const when = (instant: string | null | undefined) => (instant ? formatSlotLabel(instant, t, i18n.language) : '');
  const money = (cents: number) => formatMoney(cents, i18n.language);

  switch (phase) {
    case 'waiting': {
      // A proposal or a quote the customer can no longer answer: the request waits for the job that cancels it.
      if (view.proposal || view.quote) return { title: t('supplierSite.request.phases.lapsed.title'), lead: t('supplierSite.request.phases.lapsed.lead') };
      return {
        title: t('supplierSite.request.phases.waiting.title'),
        lead: view.respondBy ? t('supplierSite.request.phases.waiting.lead', { name, when: when(view.respondBy) }) : t('supplierSite.request.phases.waiting.leadNoDeadline', { name }),
      };
    }
    case 'proposal': {
      const proposal = view.proposal;
      const proposed = when(proposal?.startUtc);
      return {
        title: t('supplierSite.request.phases.proposal.title', { name }),
        lead: proposal?.answerBy
          ? t('supplierSite.request.phases.proposal.lead', { when: proposed, answerBy: when(proposal.answerBy) })
          : t('supplierSite.request.phases.proposal.leadNoDeadline', { when: proposed }),
      };
    }
    case 'quote': {
      const quote = view.quote;
      const total = money(quote?.totalCents ?? 0);
      return {
        title: t('supplierSite.request.phases.quote.title'),
        lead: quote?.answerBy
          ? t('supplierSite.request.phases.quote.lead', { name, total, answerBy: when(quote.answerBy) })
          : t('supplierSite.request.phases.quote.leadNoDeadline', { name, total }),
      };
    }
    case 'taken':
      return { title: t('supplierSite.request.phases.taken.title'), lead: t('supplierSite.request.phases.taken.lead', { name, when: when(view.startUtc) }) };
    case 'inProgress':
      return { title: t('supplierSite.request.phases.inProgress.title'), lead: t('supplierSite.request.phases.inProgress.lead', { name }) };
    case 'done':
      return { title: t('supplierSite.request.phases.done.title'), lead: t('supplierSite.request.phases.done.lead', { name }) };
    case 'paid':
      return { title: t('supplierSite.request.phases.paid.title'), lead: t('supplierSite.request.phases.paid.lead') };
    case 'refused':
      return {
        title: t('supplierSite.request.phases.refused.title', { name }),
        lead: view.rejectionReason ? t('supplierSite.request.phases.refused.leadReason', { reason: view.rejectionReason }) : t('supplierSite.request.phases.refused.lead'),
      };
    case 'cancelled': {
      const by = view.cancellation?.by ?? 'system';
      if (by === 'customer') return { title: t('supplierSite.request.phases.cancelledByCustomer.title'), lead: t('supplierSite.request.phases.cancelledByCustomer.lead') };
      if (by === 'supplier') {
        const reason = view.cancellation?.reason;
        return {
          title: t('supplierSite.request.phases.cancelledBySupplier.title', { name }),
          lead: reason ? t('supplierSite.request.phases.cancelledBySupplier.leadReason', { reason }) : t('supplierSite.request.phases.cancelledBySupplier.lead'),
        };
      }
      return { title: t('supplierSite.request.phases.cancelledBySystem.title'), lead: t('supplierSite.request.phases.cancelledBySystem.lead') };
    }
    case 'custom':
      return { title: t('supplierSite.request.phases.custom.title'), lead: t('supplierSite.request.phases.custom.lead') };
  }
}

/**
 * The time left to answer, counting down by itself (every figure is the server's deadline: `respondBy` of the supplier, `answerBy` of
 * the customer). It says whose time it is, and when it is over it says so instead of going negative.
 */
function Countdown({ until, who, supplierName }: { until: string | null | undefined; who: 'supplier' | 'customer'; supplierName: string }) {
  const { t } = useTranslation();
  const minute = useMinuteClock();
  if (!until) return null;
  const end = new Date(until).getTime();
  if (Number.isNaN(end)) return null;
  const minutes = Math.ceil((end - minute * 60_000) / 60_000);
  return (
    <p className="vf-countdown" data-testid="supplier-request-countdown">
      <Clock aria-hidden="true" />
      <span>
        {minutes <= 0
          ? t('supplierSite.request.countdown.over')
          : who === 'supplier'
            ? t('supplierSite.request.countdown.supplier', { name: supplierName, time: formatDeadline(minutes, t) })
            : t('supplierSite.request.countdown.customer', { time: formatDeadline(minutes, t) })}
      </span>
    </p>
  );
}

/** The ticket beside the sentence: the code, the service, when, where, and the price as the server states it (never computed here). */
function Ticket({ view, phase }: { view: PublicBookingView; phase: RequestPhase }) {
  const { t, i18n } = useTranslation();
  const { price, place } = view;
  const custom = phase === 'custom';
  const where = [place.address, place.floor, place.city].filter(Boolean).join(', ');
  let priceText: string;
  if (price.amountCents === null || price.amountCents === undefined || custom) priceText = t('supplierSite.request.ticket.priceNone');
  else priceText = `${t(`supplierSite.request.ticket.price.${price.basis ?? 'estimate'}`)} ${formatMoney(price.amountCents, i18n.language)}`;
  return (
    <aside className="vf-ticket" aria-label={t('supplierSite.booking.confirm.ticket')}>
      <CodeLine code={view.publicCode} />
      <p className="vf-ticket__t">{view.service.name}</p>
      <ul className="vf-ticket__l">
        {custom ? null : (
          <li>
            <span>{t('supplierSite.request.ticket.when')}</span>
            <strong>{formatSlotLabel(view.startUtc, t, i18n.language)}</strong>
          </li>
        )}
        <li>
          <span>{t('supplierSite.request.ticket.where')}</span>
          <strong>{where}</strong>
        </li>
        <li>
          <span>{t('supplierSite.request.ticket.price.label')}</span>
          <strong>{priceText}</strong>
        </li>
      </ul>
    </aside>
  );
}

/** The path of the request, from "Richiesta" to the end; a refused or cancelled one is outside it and says so. */
function Pipeline({ view, onRefresh, pending }: { view: PublicBookingView; onRefresh: () => void; pending: boolean }) {
  const { t } = useTranslation();
  const index = stageIndexOf(view.status);
  return (
    <section className="vz-section vz-section--tight vf-track" aria-labelledby="vf-track-title">
      <div className="vz-container">
        <div className="vf-track__head">
          <h2 id="vf-track-title" className="vf-h2">
            {t('supplierSite.request.pipeline.title')}
          </h2>
          <button type="button" className="vz-linkbtn" onClick={onRefresh} disabled={pending}>
            <RotateCcw aria-hidden="true" />
            {t('supplierSite.request.pipeline.refresh')}
          </button>
        </div>
        {index < 0 ? (
          <p className="vf-p">{t('supplierSite.request.pipeline.outside')}</p>
        ) : (
          <ol className="vf-steps">
            {REQUEST_STAGES.map((stage, position) => (
              <li key={stage} className={position < index ? 'is-done' : position === index ? 'is-cur' : undefined} aria-current={position === index ? 'step' : undefined}>
                <span className="vf-steps__n" aria-hidden="true">
                  {position < index ? <Check /> : position + 1}
                </span>
                <span className="vf-steps__t">
                  <strong>{t(`supplierSite.request.pipeline.steps.${stage}.label`)}</strong>
                  <small>{t(`supplierSite.request.pipeline.steps.${stage}.text`)}</small>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/** What the customer said to the supplier's offer, in the words of the offer: the proposed time with its message, or the quote with its lines. */
function Offer({ view, phase }: { view: PublicBookingView; phase: RequestPhase }) {
  const { t, i18n } = useTranslation();
  if (phase === 'proposal' && view.proposal?.message) {
    return (
      <blockquote className="vf-offer">
        <p>{view.proposal.message}</p>
      </blockquote>
    );
  }
  if (phase === 'quote' && view.quote) {
    const { quote } = view;
    return (
      <div className="vf-offer" data-testid="supplier-request-quote">
        <ul>
          {quote.lines.map((line, index) => (
            <li key={`${index}-${line.label}`}>
              <span>{line.label}</span>
              <span>{formatMoney(line.amountCents, i18n.language)}</span>
            </li>
          ))}
        </ul>
        <p className="vf-offer__total">
          <span>{t('supplierSite.request.quote.total')}</span>
          <strong>{formatMoney(quote.totalCents, i18n.language)}</strong>
        </p>
        {quote.startUtc ? <p className="vf-offer__note">{t('supplierSite.request.quote.otherTime', { when: formatSlotLabel(quote.startUtc, t, i18n.language) })}</p> : null}
        {quote.note ? <p className="vf-offer__note">{quote.note}</p> : null}
      </div>
    );
  }
  return null;
}

/**
 * "La mia richiesta" (SP-12b): at the top one sentence of where the request is and **one** thing to do, with the ticket beside it; then
 * the path; then, if it is still allowed, "Modifica o annulla". What may be done is the server's `actions`, never worked out here.
 */
export function RequestView({ view, failure, pending, act }: RequestViewProps) {
  const { t } = useTranslation();
  const [panel, setPanel] = useState<'cancel' | 'reschedule' | null>(null);
  const phase = phaseOf(view);
  const tone = toneOf(phase);
  const hero = useHeroText(view, phase);
  const { actions } = view;
  const supplierSlug = view.supplier.slug;
  const serviceSlug = view.service.slug ?? null;
  const rebook = serviceSlug ? buildBookingPath(supplierSlug, { service: serviceSlug }) : buildBookingPath(supplierSlug);

  const doAct = async (call: (access: PublicBookingAccess) => Promise<PublicBookingView>) => {
    const done = await act(call);
    if (done) {
      setPanel(null);
      // What was in focus may be gone (the buttons of an answered offer): the sentence at the top takes it.
      document.getElementById('vf-title')?.focus();
    }
  };

  const downloadCalendar = () => {
    const event = icsEventOf(view, {
      summary: t('supplierSite.request.calendar.summary', { service: view.service.name, name: view.supplier.name }),
      description: t('supplierSite.request.calendar.description', { code: view.publicCode }),
    });
    const text = buildIcs(event, new Date());
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `richiesta-${view.publicCode}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  let primary: ReactNode = null;
  if (phase === 'proposal' && actions.canRespondToProposal) {
    primary = (
      <>
        <button type="button" className="vz-btn vz-btn--primary vz-btn--lg" disabled={pending} onClick={() => void doAct((access) => publicBookingApi.acceptProposal(access))}>
          {t('supplierSite.request.proposal.accept')}
        </button>
        <button type="button" className="vz-linkbtn" disabled={pending} onClick={() => void doAct((access) => publicBookingApi.rejectProposal(access))}>
          {t('supplierSite.request.proposal.reject')}
        </button>
      </>
    );
  } else if (phase === 'quote' && view.quote && actions.canRespondToQuote) {
    const sentAt = view.quote.sentAt;
    primary = (
      <>
        <button type="button" className="vz-btn vz-btn--primary vz-btn--lg" disabled={pending} onClick={() => void doAct((access) => publicBookingApi.acceptQuote(access, sentAt))}>
          {t('supplierSite.request.quote.accept')}
        </button>
        <button type="button" className="vz-linkbtn" disabled={pending} onClick={() => void doAct((access) => publicBookingApi.rejectQuote(access, sentAt))}>
          {t('supplierSite.request.quote.reject')}
        </button>
      </>
    );
  } else if (phase === 'taken') {
    primary = (
      <button type="button" className="vz-btn vz-btn--primary vz-btn--lg" onClick={downloadCalendar}>
        <CalendarPlus aria-hidden="true" />
        <span>{t('supplierSite.request.calendar.add')}</span>
      </button>
    );
  } else if (phase === 'refused' || phase === 'cancelled') {
    primary = (
      <Link className="vz-btn vz-btn--primary vz-btn--lg" to={rebook}>
        {t('supplierSite.request.again')}
      </Link>
    );
  }
  const canManage = actions.canCancel || (actions.canReschedule && serviceSlug !== null);

  let failureText: string | null = null;
  if (failure) {
    if (failure.kind === 'rateLimited') {
      failureText = failure.retryAfterSeconds
        ? t('supplierSite.request.errors.rateLimitedWait', { minutes: Math.max(1, Math.ceil(failure.retryAfterSeconds / 60)) })
        : t('supplierSite.request.errors.rateLimited');
    } else if (failure.kind === 'refused') failureText = t(`supplierSite.request.errors.${failure.reason}`);
    else if (failure.kind === 'changed' || failure.kind === 'slotTaken') failureText = t(`supplierSite.request.errors.${failure.kind}`);
    else failureText = t('supplierSite.request.errors.other');
  }

  // The problem is said where the person is looking: at the top, or in the panel it has open.
  const failureNote = failureText ? (
    <p className="vb-note vb-note--warn" role="alert">
      <CircleAlert aria-hidden="true" />
      <span>{failureText}</span>
    </p>
  ) : null;

  return (
    <div data-testid="supplier-request-view" data-phase={phase}>
      <section className={`vf-hero vf-hero--${tone}`} aria-labelledby="vf-title">
        <div className="vz-container vf-hero__in">
          <div className="vf-hero__main">
            <span className="vf-tick" aria-hidden="true">
              {PHASE_ICON[phase]}
            </span>
            <h1 id="vf-title" tabIndex={-1}>
              {hero.title}
            </h1>
            <p className="vf-hero__lead">{hero.lead}</p>
            {phase === 'waiting' && !view.proposal && !view.quote ? <Countdown until={view.respondBy} who="supplier" supplierName={view.supplier.name} /> : null}
            {phase === 'proposal' ? <Countdown until={view.proposal?.answerBy} who="customer" supplierName={view.supplier.name} /> : null}
            {phase === 'quote' ? <Countdown until={view.quote?.answerBy} who="customer" supplierName={view.supplier.name} /> : null}
            <Offer view={view} phase={phase} />
            {panel === null ? failureNote : null}
            {primary ? <div className="vf-hero__a">{primary}</div> : null}
          </div>
          <Ticket view={view} phase={phase} />
        </div>
      </section>

      <Pipeline view={view} pending={pending} onRefresh={() => void doAct((access) => publicBookingApi.lookup(access))} />

      {canManage ? (
        <section className="vz-section vz-section--tight vf-manage" id="vf-modifica" aria-labelledby="vf-manage-title">
          <div className="vz-container">
            <h2 id="vf-manage-title" className="vf-h2">
              {t('supplierSite.request.manage.title')}
            </h2>
            <p className="vf-p">{t('supplierSite.request.manage.lead')}</p>
            {panel !== null ? failureNote : null}
            {panel === null ? (
              <div className="vf-manage__a">
                {actions.canReschedule && serviceSlug ? (
                  <button type="button" className="vz-btn vz-btn--secondary" onClick={() => setPanel('reschedule')}>
                    {t('supplierSite.request.manage.reschedule')}
                  </button>
                ) : null}
                {actions.canCancel ? (
                  <button type="button" className="vz-btn vz-btn--secondary" onClick={() => setPanel('cancel')}>
                    {t('supplierSite.request.manage.cancel')}
                  </button>
                ) : null}
              </div>
            ) : null}
            {panel === 'cancel' ? (
              <CancelPanel supplierName={view.supplier.name} pending={pending} onBack={() => setPanel(null)} onConfirm={(reason) => void doAct((access) => publicBookingApi.cancel(access, reason || undefined))} />
            ) : null}
            {panel === 'reschedule' && serviceSlug ? (
              <ReschedulePanel
                slug={supplierSlug}
                serviceSlug={serviceSlug}
                currentStartUtc={view.startUtc}
                pending={pending}
                onBack={() => setPanel(null)}
                onConfirm={(startUtc) => void doAct((access) => publicBookingApi.reschedule(access, startUtc))}
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
