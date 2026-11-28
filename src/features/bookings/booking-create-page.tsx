import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { fetchHostBookingQuote, fetchStayAvailability, useCreateManualBooking, usePaymentLinkAccountReady } from '@/queries/use-bookings';
import { NewBookingDone } from './components/new-booking-done';
import { PaymentStep } from './components/new-booking-payment-step';
import { GuestStep, PriceStep, StayStep, SummaryStep } from './components/new-booking-steps';
import {
  NEW_BOOKING_DRAFT_EXCLUDE,
  NEW_BOOKING_DRAFT_ID,
  NEW_BOOKING_DRAFT_VERSION,
  NEW_BOOKING_STEP,
  activeLink,
  agreedTotal,
  channelManagerBlockedMessage,
  channelManagerConflict,
  channelManagerOf,
  checkedStayOf,
  emptyNewBooking,
  guestStepSchema,
  paymentLinkBlockOf,
  paymentStepSchemaFor,
  portalName,
  priceStepSchema,
  stayStepSchema,
  toAvailabilityParams,
  toManualBookingDto,
  toQuotePayload,
  type CheckedStay,
  type NewBookingResult,
  type NewBookingValues,
} from './lib/new-booking-model';

const BOOKINGS_PATH = '/app/short-rent/bookings';

function NewBookingWizard({ propertyId }: { propertyId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createBooking = useCreateManualBooking();
  const { hasPermission } = useWorkspace();
  const connectorOn = useFeatureFlags().flags.octorateConnector;
  const [defaults] = useState(() => emptyNewBooking(propertyId));
  const [problem, setProblem] = useState<string | null>(null);
  const [agesMissing, setAgesMissing] = useState(false);
  const [checkedStay, setCheckedStay] = useState<CheckedStay | null>(null);

  // The payment link needs `payment.write` (the API answers 403 otherwise) and a Stripe account ready. The account is read only for who may read payments: a
  // read they may not make would send them to the page of no access. While it is not known the link is offered, and the API, which checks before it writes anything,
  // has the last word.
  const canWritePayments = hasPermission('short-rent', 'payment.write');
  const accountReady = usePaymentLinkAccountReady(canWritePayments && hasPermission('short-rent', 'payment.read'));

  const checkStay = async (values: NewBookingValues) => {
    setProblem(null);
    setAgesMissing(false);
    const payload = toQuotePayload(values);
    if (!payload) return;
    const quote = await fetchHostBookingQuote(queryClient, payload).catch((error: unknown) => {
      setProblem(t('booking.form.price.loadError'));
      throw error;
    });
    if (quote.touristTax.ageRulesApply && values.minors > 0 && !payload.childrenAges) {
      setAgesMissing(true);
      setProblem(t('booking.form.childrenAgesMissing'));
      throw new Error('The age of each minor is needed for the tourist tax');
    }

    const params = toAvailabilityParams(values);
    const availability = params ? await fetchStayAvailability(queryClient, params).catch(() => null) : null;
    if (availability) setCheckedStay(checkedStayOf(values, availability));
    if (availability?.state === 'occupied' || availability?.state === 'invalid') {
      const channelManager = availability.state === 'occupied' ? channelManagerConflict(availability) : undefined;
      setProblem(channelManager ? channelManagerBlockedMessage(channelManager, t) : t('booking.create.availability.blocked'));
      throw new Error('The dates are not free');
    }
    if (availability?.state === 'linkableBlock' && activeLink(values)?.blockId !== availability.linkableBlockId) {
      setProblem(t('booking.create.availability.linkRequired', { portal: portalName(availability.conflicts[0]?.channel, t) }));
      throw new Error('The dates are a reservation of a portal: link it first');
    }
  };

  const create = async (values: NewBookingValues): Promise<NewBookingResult> => {
    setProblem(null);
    const booking = await createBooking.mutateAsync(toManualBookingDto(values));
    return { booking, channelManager: channelManagerOf(checkedStay, values) };
  };

  const stepsFor = (values: NewBookingValues): WizardStep<NewBookingValues>[] => {
    const linkBlock = paymentLinkBlockOf({ canWritePayments, accountReady, agreed: agreedTotal(values) });
    return [
      {
        id: NEW_BOOKING_STEP.stay,
        label: t('booking.create.steps.stay.label'),
        title: t('booking.create.steps.stay.title'),
        purpose: t('booking.create.steps.stay.purpose'),
        schema: stayStepSchema,
        beforeNext: checkStay,
        render: () => <StayStep agesMissing={agesMissing} onAgesChange={() => setAgesMissing(false)} />,
      },
      {
        id: NEW_BOOKING_STEP.guest,
        label: t('booking.create.steps.guest.label'),
        title: t('booking.create.steps.guest.title'),
        purpose: t('booking.create.steps.guest.purpose'),
        schema: guestStepSchema,
        render: () => <GuestStep />,
      },
      {
        id: NEW_BOOKING_STEP.price,
        label: t('booking.create.steps.price.label'),
        title: t('booking.create.steps.price.title'),
        purpose: t('booking.create.steps.price.purpose'),
        schema: priceStepSchema,
        render: () => <PriceStep />,
      },
      ...(activeLink(values)
        ? []
        : [
            {
              id: NEW_BOOKING_STEP.payment,
              label: t('booking.create.steps.payment.label'),
              title: t('booking.create.steps.payment.title'),
              purpose: t('booking.create.steps.payment.purpose'),
              schema: paymentStepSchemaFor(linkBlock),
              render: () => <PaymentStep linkBlock={linkBlock} />,
            },
          ]),
      {
        id: NEW_BOOKING_STEP.summary,
        label: t('booking.create.steps.summary.label'),
        title: t('booking.create.steps.summary.title'),
        purpose: t('booking.create.steps.summary.purpose'),
        render: () => <SummaryStep channelManager={channelManagerOf(checkedStay, values)} connectorOn={connectorOn} />,
      },
    ];
  };

  return (
    <WizardShell<NewBookingValues, NewBookingResult>
      id={NEW_BOOKING_DRAFT_ID}
      steps={stepsFor(defaults)}
      stepsFor={stepsFor}
      defaultValues={defaults}
      finishLabel={t('booking.create.finish')}
      finishFailedMessage={problem ?? t('toast.bookingCreateFailed')}
      onFinish={create}
      draft={{
        exclude: NEW_BOOKING_DRAFT_EXCLUDE,
        version: NEW_BOOKING_DRAFT_VERSION,
        accept: (saved) => !propertyId || saved.values.propertyId === propertyId,
      }}
      onExit={() => navigate(propertyId ? `/app/short-rent/properties/${encodeURIComponent(propertyId)}` : BOOKINGS_PATH)}
      renderDone={({ result, values }) =>
        result ? <NewBookingDone result={result} values={values} /> : <Navigate to={BOOKINGS_PATH} replace />
      }
      testIds={{
        root: 'booking-wizard',
        back: 'booking-wizard-back',
        next: 'booking-wizard-next',
        finish: 'booking-create-button',
        finishError: 'booking-submit-error',
      }}
    />
  );
}

export function BookingCreatePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get('propertyId') ?? undefined;

  return (
    <AppShell>
      <div className="min-w-0 space-y-6" data-testid="booking-create-page">
        <PageHeader title={t('booking.create.title')} description={t('booking.create.description')} crumbs="auto" />
        <div className={FOCUS_COLUMN}>
          <NewBookingWizard propertyId={propertyId} />
        </div>
      </div>
    </AppShell>
  );
}
