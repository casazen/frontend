import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { fetchHostBookingQuote, useCreateBooking } from '@/queries/use-bookings';
import type { Booking } from '@/types';
import { NewBookingDone } from './components/new-booking-done';
import { GuestStep, StayStep, SummaryStep } from './components/new-booking-steps';
import {
  NEW_BOOKING_DRAFT_EXCLUDE,
  NEW_BOOKING_DRAFT_ID,
  NEW_BOOKING_STEP,
  emptyNewBooking,
  guestStepSchema,
  stayStepSchema,
  toCreateBookingDto,
  toQuotePayload,
  type NewBookingValues,
} from './lib/new-booking-model';

const BOOKINGS_PATH = '/app/short-rent/bookings';

/**
 * The three steps (stay, guest, summary and price) on the wizard kit. The booking is created Confirmed with the source
 * "Manual" (PC-01): the API prices it and answers 409 when the dates overlap another booking or a calendar block, and the
 * message stays above the buttons until the next try.
 */
function NewBookingWizard({ propertyId }: { propertyId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createBooking = useCreateBooking();
  const [defaults] = useState(() => emptyNewBooking(propertyId));
  // A step that is left with something the API needs and no field can show: the wizard says it above the buttons.
  const [problem, setProblem] = useState<string | null>(null);
  const [agesMissing, setAgesMissing] = useState(false);

  /**
   * Before the stay is accepted: the quote of the API says now what it would refuse at the end (guests over the capacity of
   * the property, a stay that is too long) and whether the tourist tax of the comune needs the age of each minor.
   */
  const checkStay = async (values: NewBookingValues) => {
    setProblem(null);
    setAgesMissing(false);
    const payload = toQuotePayload(values);
    if (!payload) return;
    // A refusal that has a message of its own (capacity, length of the stay) is shown as the API says it; any other failure, as this.
    const quote = await fetchHostBookingQuote(queryClient, payload).catch((error: unknown) => {
      setProblem(t('booking.form.price.loadError'));
      throw error;
    });
    if (quote.touristTax.ageRulesApply && values.minors > 0 && !payload.childrenAges) {
      setAgesMissing(true);
      setProblem(t('booking.form.childrenAgesMissing'));
      throw new Error('The age of each minor is needed for the tourist tax');
    }
  };

  const create = async (values: NewBookingValues): Promise<Booking> => {
    setProblem(null);
    return createBooking.mutateAsync(toCreateBookingDto(values));
  };

  const steps: WizardStep<NewBookingValues>[] = [
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
      id: NEW_BOOKING_STEP.summary,
      label: t('booking.create.steps.summary.label'),
      title: t('booking.create.steps.summary.title'),
      purpose: t('booking.create.steps.summary.purpose'),
      render: () => <SummaryStep />,
    },
  ];

  return (
    <WizardShell<NewBookingValues, Booking>
      id={NEW_BOOKING_DRAFT_ID}
      steps={steps}
      defaultValues={defaults}
      finishLabel={t('booking.create.finish')}
      finishFailedMessage={problem ?? t('toast.bookingCreateFailed')}
      onFinish={create}
      // A property in the address is the one the host came from: a draft for another property gives way to it.
      draft={{
        exclude: NEW_BOOKING_DRAFT_EXCLUDE,
        accept: (saved) => !propertyId || saved.values.propertyId === propertyId,
      }}
      onExit={() => navigate(propertyId ? `/app/short-rent/properties/${encodeURIComponent(propertyId)}` : BOOKINGS_PATH)}
      // The confirmation opened again (a reload) has nothing to say: the booking is in the list.
      renderDone={({ result, values }) =>
        result ? <NewBookingDone booking={result} values={values} /> : <Navigate to={BOOKINGS_PATH} replace />
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

/**
 * Nuova prenotazione (SR-06): a booking taken by phone or in person, in three short steps (stay, guest, summary and price) on
 * the wizard kit. The page header has no primary action of its own: the wizard has the one main button.
 */
export function BookingCreatePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  // Opened from a property ("New booking" on the property page or on its filtered list): the property is chosen.
  const propertyId = searchParams.get('propertyId') ?? undefined;

  return (
    <AppShell>
      <div className="min-w-0 space-y-6" data-testid="booking-create-page">
        <PageHeader title={t('booking.create.title')} description={t('booking.create.description')} crumbs="auto" />
        {/* `w-full`: the shell sits in a column, and a centered block there takes the width of its content: the buttons of a phone would stick out. */}
        <div className="mx-auto w-full max-w-2xl">
          <NewBookingWizard propertyId={propertyId} />
        </div>
      </div>
    </AppShell>
  );
}
