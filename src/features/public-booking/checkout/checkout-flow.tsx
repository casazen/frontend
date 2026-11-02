import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Lock } from 'lucide-react';
import { useBooking } from '@/features/public-booking/booking/booking-context';
import { CheckoutSteps } from '@/features/public-booking/checkout/checkout-steps';
import { SummaryBar, StaySummary } from '@/features/public-booking/checkout/stay-summary';
import { StepDetails } from '@/features/public-booking/checkout/step-details';
import { StepPayment } from '@/features/public-booking/checkout/step-payment';
import { StepStay } from '@/features/public-booking/checkout/step-stay';
import { parseStep, type CheckoutDraft, type CheckoutStep, type DetailsValues } from '@/features/public-booking/checkout/checkout-model';
import { orgDocumentPath } from '@/lib/org-document-paths';
import { buildPropertyPageUrl } from '@/lib/booking-url';
import { resizeChildrenAges } from '@/lib/tourist-tax';
import type { DirectBookingResponse, PublicOrgDto } from '@/types';
import '@/features/public-booking/checkout/checkout.css';

interface CheckoutFlowProps {
  org: PublicOrgDto;
  orgSlug: string;
  draft: CheckoutDraft;
  onDraft: (update: (draft: CheckoutDraft) => CheckoutDraft) => void;
}

const shallowEqual = (a: DetailsValues, b: DetailsValues) => (Object.keys(a) as (keyof DetailsValues)[]).every((key) => a[key] === b[key]);

/**
 * The checkout in three steps (DB-05), around one summary that is always in sight: «Il soggiorno», «I tuoi dati», «Pagamento». The step
 * and the stay are in the address (`?step=2&checkin=…`), the personal data are never: they live in the page, in the draft, while the guest
 * goes back and forth. A step has one decision and one button; the focus goes to its title when it changes. Once the booking is made the
 * stay and the data are fixed (the hold of the dates is running) and the steps before are not offered.
 */
export function CheckoutFlow({ org, orgSlug, draft, onDraft }: CheckoutFlowProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { property, stay, hostLabel } = useBooking();
  // Once the booking exists the page is its payment: the stay and the data are fixed, and any step of the address shows the payment.
  const [booking, setBooking] = useState<DirectBookingResponse | null>(null);
  const booked = booking !== null;
  const title = useRef<HTMLHeadingElement>(null);
  const step = booking ? 3 : parseStep(searchParams.get('step'));
  // The last step of a request is not a payment: it has its own title and lead.
  const textKey = step === 3 && draft.mode === 'request' ? 'step3Request' : `step${step}`;

  const goTo = useCallback(
    (next: CheckoutStep) => {
      setSearchParams(
        (current) => {
          const query = new URLSearchParams(current);
          if (next === 1) query.delete('step');
          else query.set('step', String(next));
          return query;
        },
        { replace: false },
      );
      window.scrollTo({ top: 0 });
    },
    [setSearchParams],
  );

  // The title of the step takes the focus when the step changes (not on the first visit): a keyboard or a screen reader starts at the top.
  const previous = useRef(step);
  useEffect(() => {
    if (previous.current !== step) title.current?.focus();
    previous.current = step;
  }, [step]);

  const patch = useCallback((change: Partial<CheckoutDraft>) => onDraft((current) => ({ ...current, ...change })), [onDraft]);
  const setDetails = useCallback(
    (details: DetailsValues) => onDraft((current) => (shallowEqual(current.details, details) ? current : { ...current, details })),
    [onDraft],
  );
  const ages = resizeChildrenAges(draft.childrenAges, stay.children);

  const backToProperty = buildPropertyPageUrl(orgSlug, property, {
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests: stay.adults + stay.children,
    children: stay.children,
  });
  const editStay = booked ? undefined : () => goTo(1);

  return (
    <div className="co mx-auto max-w-6xl" data-checkout="" data-step={step} data-testid="direct-checkout-page">
      <div className="co__top">
        <Link to={backToProperty} className="co__back" data-testid="checkout-back-to-home">
          <ArrowLeft aria-hidden />
          {t('publicCheckout.backToHome')}
        </Link>
        <p className="co__secure">
          <Lock aria-hidden />
          {t('publicCheckout.secure')}
        </p>
      </div>

      <CheckoutSteps step={step} canGoBack={!booked} onGo={goTo} />

      <div className="co__grid">
        <div className="co__main">
          <header className="co-head">
            <h1 ref={title} tabIndex={-1} className="public-display" data-testid="checkout-title">
              {t(`publicCheckout.titles.${textKey}`)}
            </h1>
            <p className="co-head__lead">{t(`publicCheckout.leads.${textKey}`, { host: hostLabel })}</p>
          </header>

          {step === 1 ? <StepStay draft={draft} onDraft={patch} ages={ages} onNext={() => goTo(2)} /> : null}
          {step === 2 ? (
            <StepDetails
              values={draft.details}
              onChange={setDetails}
              offersVersion={org.marketingConsentVersion}
              siteName={org.displayName}
              onBack={() => goTo(1)}
              onNext={() => goTo(3)}
            />
          ) : null}
          {step === 3 ? (
            <StepPayment
              org={org}
              orgSlug={orgSlug}
              draft={draft}
              onDraft={patch}
              ages={ages}
              onBack={() => goTo(2)}
              onEditDetails={() => goTo(2)}
              onEditStay={() => goTo(1)}
              booking={booking}
              onBooked={setBooking}
            />
          ) : null}
        </div>

        <aside className="co__aside" aria-label={t('publicCheckout.summary.title')}>
          <StaySummary mode={draft.mode} onEdit={editStay} />
        </aside>
      </div>

      <SummaryBar mode={draft.mode} onEdit={editStay} />

      <footer className="co-foot" data-testid="checkout-footer">
        <span>
          © {new Date().getFullYear()} {org.displayName}
          {org.operator?.legalName ? ` · ${org.operator.legalName}` : ''}
          {org.operator?.vatNumber ? ` · ${t('publicSite.footer.vatNumber', { vat: org.operator.vatNumber })}` : ''}
        </span>
        <ul>
          <li>
            <a href={orgDocumentPath(orgSlug, 'privacy')} target="_blank" rel="noopener noreferrer">
              {t('publicSite.operatorPrivacy')}
            </a>
          </li>
          <li>
            <a href={orgDocumentPath(orgSlug, 'terms')} target="_blank" rel="noopener noreferrer">
              {t('publicSite.operatorTerms')}
            </a>
          </li>
        </ul>
      </footer>
    </div>
  );
}
