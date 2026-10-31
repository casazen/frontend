import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, CircleAlert, Send } from 'lucide-react';
import type { PublicQuoteRequestBody } from '@/api/public-supplier.api';
import type { PublicBookingHold } from '@/api/public-supplier-booking.api';
import { clientStatusFromRedirect } from '@/features/public-booking/checkout-outcome';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useOnlineStatus } from '@/hooks/use-online-status';
import {
  BOOKING_STEPS,
  draftFromParams,
  isBookable,
  isUrgent,
  newClientRequestId,
  selectionOf,
  toBookingBody,
  validateDetails,
  type BookingStep,
  type DetailsProblems,
  type DraftComune,
} from '@/lib/supplier-site/booking-flow';
import { readBookingFailure, type BookingFailure } from '@/lib/supplier-site/booking-errors';
import { parseBookingParams } from '@/lib/supplier-site/booking-params';
import { toQuoteBody } from '@/lib/supplier-site/service-options';
import { SITE_STYLES } from '@/lib/supplier-site/style-config';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';
import { useComune } from '@/queries/use-comuni';
import { useBookingSlots, useCreateBookingHold } from '@/queries/use-public-supplier-booking';
import { useSupplierEstimate, useSupplierService } from '@/queries/use-public-supplier';
import type { Comune } from '@/types/comune.types';
import { useSupplierSite } from '../site-context';
import { isFramedPreview } from '../use-preview-draft';
import { BookingSteps } from './booking-steps';
import { BookingSummary } from './booking-summary';
import { CheckEmail } from './check-email';
import { PaymentStep } from './payment-step';
import { StepDetails } from './step-details';
import { StepService } from './step-service';
import { StepWhen } from './step-when';
import { StepWhere, type ZoneState } from './step-where';
import { useBookingDraft } from './use-booking-draft';

/** The steps of the form, in order; the payment step is not among them until it exists. */
const FORM_STEPS: readonly BookingStep[] = BOOKING_STEPS.filter((step) => step !== 'payment');

/** The estimate waits for the person to stop pressing before it is asked: one request per decision. */
const ESTIMATE_DEBOUNCE_MS = 400;

function stepOfSearch(search: URLSearchParams): BookingStep | null {
  const value = search.get('step');
  return FORM_STEPS.find((step) => String(FORM_STEPS.indexOf(step) + 1) === value) ?? null;
}

type Notice = BookingFailure | { kind: 'unavailable' } | { kind: 'paymentFailed' } | { kind: 'preview' };

/** A problem the server (or the page) found while sending, said at the step where it can be fixed. */
function NoticeBox({ notice }: { notice: Notice }) {
  const { t } = useTranslation();
  let text: string;
  switch (notice.kind) {
    case 'rateLimited':
      text = notice.retryAfterSeconds
        ? t('supplierSite.booking.notice.rateLimitedWait', { minutes: Math.max(1, Math.ceil(notice.retryAfterSeconds / 60)) })
        : t('supplierSite.booking.notice.rateLimited');
      break;
    case 'consent':
      text = notice.outdated ? t('supplierSite.booking.notice.consentOutdated') : t('supplierSite.booking.notice.consent');
      break;
    default:
      text = t(`supplierSite.booking.notice.${notice.kind}`);
  }
  return (
    <p className="vb-note vb-note--warn" role="alert">
      <CircleAlert aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

/**
 * The booking from the public site of a supplier, `/fornitori/:slug/prenota` (SP-12b): service and options, where, when, the customer's
 * data, then the e-mail check. One thing per step, the estimate always at hand. Every figure on the page is the server's (the lines and the
 * total of the estimate, the free times); the page only says what was chosen. The draft survives a reload (see `useBookingDraft`) and
 * the address of a step never carries a name, an e-mail or a phone.
 */
export function BookingWizard() {
  const { t, i18n } = useTranslation();
  const { model, showcase } = useSupplierSite();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const preview = isFramedPreview(search);
  const online = useOnlineStatus();
  const slug = model.slug;
  const services = model.services ?? [];

  // What the cards and the finder of the site already told: read once, over what the device remembered.
  const [seed] = useState(() => parseBookingParams(search));
  const { draft, update, discard } = useBookingDraft(slug, draftFromParams(seed));
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState('');
  const [triedStep, setTriedStep] = useState<BookingStep | null>(null);
  // Back from the bank after a payment that did not go through: said at the first step, where the booking starts again.
  const returned = clientStatusFromRedirect(search.get('redirect_status'));
  const [notice, setNotice] = useState<{ step: BookingStep; value: Notice } | null>(() =>
    returned === 'failed' ? { step: 'service', value: { kind: 'paymentFailed' } } : null,
  );
  const [serverProblems, setServerProblems] = useState<DetailsProblems>({});
  const [sent, setSent] = useState<{ hold: PublicBookingHold; email: string } | null>(null);
  // The card was blocked in this page (Stripe says so; the server makes the request when the e-mail is checked too).
  const [cardBlocked, setCardBlocked] = useState(false);
  // The block of the card, while it still has to be confirmed in this page.
  const cardBlock = sent?.hold.payment;
  const cardToAsk =
    sent && cardBlock && !cardBlock.authorized && !cardBlocked && cardBlock.clientSecret && cardBlock.publishableKey
      ? { ...cardBlock, clientSecret: cardBlock.clientSecret, publishableKey: cardBlock.publishableKey }
      : null;
  const askingCard = cardToAsk !== null;
  const attempt = useRef<{ id: string; fingerprint: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const shownStep = useRef<BookingStep | null>(null);
  const createHold = useCreateBookingHold(slug);

  // The service, in full (its supplements), and the comune the address of the page named.
  const chosen = services.find((service) => service.slug === draft.service && isBookable(service)) ?? null;
  const serviceSlug = chosen?.slug ?? null;
  const detailQuery = useSupplierService(slug, serviceSlug ?? '', serviceSlug !== null);
  const detail = detailQuery.data;
  const seededComune = useComune(draft.comune === undefined ? (seed.comune ?? null) : null);
  const comune: DraftComune | null =
    draft.comune !== undefined
      ? draft.comune
      : seededComune.data
        ? { istatCode: seededComune.data.istatCode, name: seededComune.data.name, provinceCode: seededComune.data.provinceCode }
        : null;

  const selection = detail ? selectionOf(draft, detail, comune?.istatCode ?? null) : null;
  const urgent = isUrgent(draft, detail);

  // The estimate of what is chosen: the zone is judged by it too.
  const quoteKey = detail && selection ? JSON.stringify({ ...toQuoteBody(detail, selection), ...(urgent ? { urgent: true } : {}) }) : '';
  const waitedKey = useDebouncedValue(quoteKey, ESTIMATE_DEBOUNCE_MS);
  const quoteBody = useMemo(() => (waitedKey ? (JSON.parse(waitedKey) as PublicQuoteRequestBody) : null), [waitedKey]);
  const estimate = useSupplierEstimate(slug, quoteBody ?? { service: '' }, quoteBody !== null);
  const estimateSettled = quoteKey === waitedKey && !estimate.isPlaceholderData;

  let zone: ZoneState = 'none';
  if (comune && detail) {
    const coverage = estimateSettled ? estimate.data?.coverage : undefined;
    if (coverage === 'Covered') zone = 'covered';
    else if (coverage === 'Outside') zone = 'outside';
    else if (coverage === 'Unknown' || (estimateSettled && estimate.isError)) zone = 'unknown';
    else zone = 'checking';
  }

  // The free times; the time chosen counts only while it is still among them.
  const slotsQuery = useBookingSlots(slug, serviceSlug, urgent, serviceSlug !== null);
  const days = useMemo(() => slotsQuery.data?.days ?? [], [slotsQuery.data]);
  const chosenSlotFree = draft.startUtc !== null && days.some((day) => day.slots.some((slot) => slot.startUtc === draft.startUtc));

  const detailsProblems = validateDetails(draft, consent);
  const done: Record<BookingStep, boolean> = {
    service: chosen !== null && detail !== undefined,
    where: comune !== null && zone !== 'outside',
    when: chosenSlotFree,
    details: Object.keys(detailsProblems).length === 0,
    payment: false,
  };
  const firstOpen = FORM_STEPS.find((step) => !done[step]);
  const reachable = firstOpen ? FORM_STEPS.indexOf(firstOpen) : FORM_STEPS.length - 1;
  const asked = stepOfSearch(search);
  const step: BookingStep = asked !== null && FORM_STEPS.indexOf(asked) <= reachable ? asked : FORM_STEPS[reachable];
  const stepIndex = FORM_STEPS.indexOf(step);

  // Said to the person: the problems of the step it tried to leave, and what a refusal of the server meant.
  const tried = triedStep === step;
  const stepNotice = notice && notice.step === step ? notice.value : null;
  const shownDetailsProblems: DetailsProblems = step === 'details' ? { ...serverProblems, ...(tried ? detailsProblems : {}) } : {};

  // The heading of the step takes the focus when the step changes (not when the page opens).
  useEffect(() => {
    if (shownStep.current !== null && shownStep.current !== step) headingRef.current?.focus();
    shownStep.current = step;
  }, [step]);

  // The step of the card, when it shows, takes the focus on its heading too.
  useEffect(() => {
    if (askingCard) headingRef.current?.focus();
  }, [askingCard]);

  // After a failed try on the last step, the first field at fault takes the focus.
  useEffect(() => {
    if (step === 'details' && triedStep === 'details') formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [step, triedStep]);

  const goTo = (target: BookingStep) => navigate(`${supplierSitePaths.booking(slug)}?step=${FORM_STEPS.indexOf(target) + 1}`);
  const saySomething = (value: Notice, at: BookingStep) => setNotice({ step: at, value });

  const onChooseService = (serviceSlugChosen: string) => {
    if (serviceSlugChosen === draft.service) return;
    update({ service: serviceSlugChosen, quantity: null, surface: null, options: {}, urgent: false, startUtc: null });
    setNotice(null);
  };

  const onOption = (code: string, quantity: number) => {
    const next = { ...(selection?.options ?? {}), [code]: quantity };
    if (quantity <= 0) delete next[code];
    update({ options: next });
  };

  const onComune = (picked: Comune | null) => {
    update({ comune: picked ? { istatCode: picked.istatCode, name: picked.name, provinceCode: picked.provinceCode } : null });
    setNotice(null);
  };

  const send = async () => {
    if (!chosen || !detail || !selection || !comune || !draft.startUtc) return;
    if (preview) return saySomething({ kind: 'preview' }, 'details');
    const version = showcase.privacyNoticeVersion?.trim();
    if (!version) return saySomething({ kind: 'unavailable' }, 'details');

    const body = toBookingBody({ draft, service: detail, selection, comune, locale: i18n.language, privacyNoticeVersion: version, clientRequestId: '', trap });
    // The same request again (a retry after a lost answer) keeps its id and so takes no second slot; any change is a new attempt.
    const fingerprint = JSON.stringify({ ...body, clientRequestId: '' });
    const thisAttempt = attempt.current?.fingerprint === fingerprint ? attempt.current : { id: newClientRequestId(), fingerprint };
    attempt.current = thisAttempt;
    try {
      const hold = await createHold.mutateAsync({ ...body, clientRequestId: thisAttempt.id });
      const block = hold.payment;
      if (block && !block.authorized && (!block.clientSecret || !block.publishableKey)) {
        // The card cannot be asked for this block: a new attempt, not the same hold again.
        attempt.current = null;
        saySomething({ kind: 'payment' }, 'details');
        return;
      }
      discard();
      setSent({ hold, email: draft.email.trim() });
    } catch (error) {
      const failure = readBookingFailure(error);
      if (failure.kind === 'slotTaken') {
        update({ startUtc: null });
        void slotsQuery.refetch();
        saySomething(failure, 'when');
        goTo('when');
      } else if (failure.kind === 'invalid') {
        setServerProblems(Object.fromEntries(failure.fields.map((field) => [field, 'invalid' as const])));
        saySomething(failure, failure.step);
        goTo(failure.step);
      } else if (failure.kind === 'outsideZone') {
        saySomething(failure, 'where');
        goTo('where');
      } else {
        if (failure.kind === 'consent') setConsent(false);
        saySomething(failure, 'details');
      }
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (createHold.isPending) return;
    if (!done[step]) {
      setTriedStep(step);
      return;
    }
    setNotice(null);
    if (step === 'details') {
      setTriedStep('details');
      void send();
      return;
    }
    goTo(FORM_STEPS[stepIndex + 1]);
  };

  // Back from the bank with the card blocked: the e-mail is what is left (the request is born when it is checked too).
  if (!sent && (returned === 'succeeded' || returned === 'processing')) {
    return (
      <div className="vz-container vb" data-testid="supplier-booking-sent">
        <CheckEmail slug={slug} supplierName={model.name} />
      </div>
    );
  }

  const summary = (
    <BookingSummary
      data={{
        supplierName: model.name,
        serviceName: chosen?.name ?? null,
        comuneName: comune?.name ?? null,
        startUtc: chosenSlotFree ? draft.startUtc : null,
        urgent,
        estimate: { data: estimate.data?.service === serviceSlug ? estimate.data : undefined, isFetching: !estimateSettled || estimate.isFetching, isError: estimate.isError },
        acceptsOnlinePayments: showcase.acceptsOnlinePayments === true,
        respondWithinMinutes: model.respondWithinMinutes,
      }}
    />
  );
  if (sent && !cardToAsk) {
    return (
      <div className="vz-container vb" data-testid="supplier-booking-sent">
        <CheckEmail slug={slug} supplierName={model.name} email={sent.email} expiresAt={sent.hold.expiresAt} />
      </div>
    );
  }
  const backTo = chosen ? supplierSitePaths.service(slug, chosen.slug) : supplierSitePaths.services(slug);
  const lastStep = step === 'details';
  // The payment step exists only for a site that takes the money inside CasaZen.
  const stepsShown: BookingStep[] = showcase.acceptsOnlinePayments === true ? [...BOOKING_STEPS] : [...FORM_STEPS];
  const submitDisabled =
    createHold.isPending || (step === 'service' && detailQuery.isLoading) || (step === 'where' && zone === 'checking') || (lastStep && !online);

  let content = null;
  if (step === 'service') {
    content = (
      <StepService
        supplierSlug={slug}
        services={services}
        chosen={serviceSlug}
        onChoose={onChooseService}
        detail={{ service: detail, isLoading: detailQuery.isLoading, isError: detailQuery.isError, onRetry: () => void detailQuery.refetch() }}
        selection={selection}
        onQuantity={(quantity) => update({ quantity })}
        onSurface={(surface) => update({ surface })}
        onOption={onOption}
        problem={tried && chosen === null ? 'required' : null}
      />
    );
  } else if (step === 'where') {
    content = (
      <StepWhere
        supplierSlug={slug}
        serviceSlug={serviceSlug ?? ''}
        comune={comune}
        onComune={onComune}
        zone={zone}
        problem={tried && comune === null ? 'required' : null}
      />
    );
  } else if (step === 'when') {
    content = (
      <StepWhen
        supplierSlug={slug}
        serviceSlug={serviceSlug ?? ''}
        comuneIstat={comune?.istatCode ?? null}
        slots={{ isLoading: slotsQuery.isLoading, isError: slotsQuery.isError, days, onRetry: () => void slotsQuery.refetch() }}
        chosen={chosenSlotFree ? draft.startUtc : null}
        onChoose={(startUtc) => {
          update({ startUtc });
          setNotice(null);
        }}
        preferredDay={seed.day ?? null}
        urgent={{
          offered: detail?.urgent.enabled === true,
          on: urgent,
          surchargeCents: detail?.urgent.surchargeCents ?? 0,
          onToggle: (on) => update({ urgent: on, startUtc: null }),
        }}
        problem={stepNotice?.kind === 'slotTaken' ? 'taken' : tried && !done.when ? 'required' : null}
      />
    );
  } else {
    content = (
      <StepDetails
        draft={draft}
        onChange={(patch) => {
          update(patch);
          if (Object.keys(serverProblems).length > 0) setServerProblems({});
        }}
        consent={consent}
        onConsent={setConsent}
        trap={trap}
        onTrap={setTrap}
        problems={shownDetailsProblems}
      />
    );
  }

  return (
    <div className="vz-container vb" data-testid="supplier-booking-page">
      <header className="vb-head">
        <Link className="vb-back" to={backTo}>
          <ArrowLeft aria-hidden="true" />
          <span>{chosen ? t('supplierSite.booking.back.toService', { name: chosen.name }) : t('supplierSite.booking.back.toServices')}</span>
        </Link>
        <h1 id="vz-title">{chosen ? t('supplierSite.booking.titleFor', { service: chosen.name }) : t('supplierSite.booking.title')}</h1>
      </header>

      <BookingSteps steps={stepsShown} current={cardToAsk ? 'payment' : step} onGo={goTo} interactive={!cardToAsk} />

      <details className="vb-sum-m">
        <summary>{t('supplierSite.booking.summary.toggle')}</summary>
        {summary}
      </details>

      <div className="vb-cols">
        {cardToAsk && sent ? (
          <section className="vb-panel" aria-labelledby="vb-step-title" data-testid="supplier-booking-card-panel">
            <div className="vb-panel__head">
              <h2 id="vb-step-title" tabIndex={-1} ref={headingRef}>
                {t('supplierSite.booking.stepInfo.payment.title')}
              </h2>
              <p>{t('supplierSite.booking.stepInfo.payment.purpose')}</p>
            </div>
            <PaymentStep
              slug={slug}
              supplierName={model.name}
              block={cardToAsk}
              expiresAt={sent.hold.expiresAt}
              buttonColor={model.buttonColor ?? SITE_STYLES[model.style].cta}
              onAuthorized={() => setCardBlocked(true)}
            />
          </section>
        ) : (
          <form ref={formRef} className="vb-panel" onSubmit={onSubmit} noValidate aria-labelledby="vb-step-title" data-testid="supplier-booking-form">
            <div className="vb-panel__head">
              <h2 id="vb-step-title" tabIndex={-1} ref={headingRef}>
                {t(`supplierSite.booking.stepInfo.${step}.title`)}
              </h2>
              <p>{t(`supplierSite.booking.stepInfo.${step}.purpose`)}</p>
            </div>

            {stepNotice ? <NoticeBox notice={stepNotice} /> : null}
            {preview && lastStep ? <NoticeBox notice={{ kind: 'preview' }} /> : null}
            {lastStep && !online ? (
              <p className="vb-note vb-note--warn" role="status">
                {t('supplierSite.booking.actions.offline')}
              </p>
            ) : null}

            <div className="vb-fields">{content}</div>

            <div className="vb-actions">
              {stepIndex > 0 ? (
                <button type="button" className="vz-btn vz-btn--secondary" onClick={() => goTo(FORM_STEPS[stepIndex - 1])}>
                  <ArrowLeft aria-hidden="true" />
                  <span>{t('supplierSite.booking.actions.back')}</span>
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className="vz-btn vz-btn--primary vz-btn--lg" disabled={submitDisabled} data-testid="supplier-booking-next">
                {lastStep ? <Send aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                <span>{createHold.isPending ? t('supplierSite.booking.actions.sending') : lastStep ? t('supplierSite.booking.actions.send') : t('supplierSite.booking.actions.next')}</span>
              </button>
            </div>
            {lastStep ? <p className="vb-after">{t('supplierSite.booking.actions.after')}</p> : null}
          </form>
        )}

        <aside className="vb-aside" aria-label={t('supplierSite.booking.summary.title')}>
          {summary}
        </aside>
      </div>
    </div>
  );
}
