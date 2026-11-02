import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { stayDateOf } from '@/features/bookings/lib/booking-price';
import { PROPERTY_CREATE_PATH } from '@/features/properties/properties-paths';
import { todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { usePropertyBookings } from '@/queries/use-bookings';
import { HOST_SUPPLIER_SLOTS_KEY } from '@/queries/use-host-supplier-catalog';
import { useProperties } from '@/queries/use-properties';
import { useServiceCategories } from '@/queries/use-service-categories';
import { useCreateIntervention } from '@/queries/use-service-requests';
import { INTERVENTIONS_PATH } from '../paths';
import { RequestDone, type RequestSent } from './request-done';
import {
  CHANNEL_PARAM,
  channelOf,
  dayForStay,
  openingStepFor,
  REQUEST_DRAFT_EXCLUDE,
  REQUEST_WIZARD_ID,
  requestDefaults,
  requestProblemOf,
  requestStepSchemas,
  toCreateRequest,
  type RequestStepId,
  type RequestValues,
} from './request-model';
import { ChannelStep, PartnersStep, PropertyStep, ProposalsStep, ServiceStep, type ChangeChannel } from './request-pick-steps';
import { DetailsStep, ReviewStep } from './request-steps';

function RequestWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const categories = useServiceCategories();
  const properties = useProperties({ mode: 'short' }, { fresh: true });
  const create = useCreateIntervention();
  // The sentence of the last refusal that sent the host back to a step: the wizard shows it where the host lands.
  const [refusal, setRefusal] = useState<string | null>(null);
  const schemas = useMemo(() => requestStepSchemas(), []);
  const channel = channelOf(search);

  // The channel lives in the address, so a reload and the back button keep it. One change of the address for the channel and the step it
  // goes on from (the wizard's own `goTo` would read the address as it was before and cancel it).
  const changeChannel = useCallback<ChangeChannel>(
    (next, stepId) =>
      setSearch(
        (previous) => {
          const params = new URLSearchParams(previous);
          params.set(CHANNEL_PARAM, next);
          if (stepId) params.set('step', stepId);
          return params;
        },
        { replace: stepId === undefined },
      ),
    [setSearch],
  );

  const base = useMemo(() => requestDefaults(search, categories.data), [search, categories.data]);
  const propertyList = Array.isArray(properties.data) ? properties.data : null;
  // A stay named by the address gives the day of the work (its check-out day): its property's stays are read before the wizard opens.
  const needsStays = base.values.bookingId !== '' && base.values.propertyId !== '' && !search.has('date');
  const stays = usePropertyBookings(needsStays ? base.values.propertyId : undefined);

  const defaults = useMemo(() => {
    const known = propertyList ?? [];
    const addressed = known.some((property) => property.id === base.values.propertyId);
    const propertyId = addressed ? base.values.propertyId : known.length === 1 ? known[0].id : '';
    let bookingId = addressed ? base.values.bookingId : '';
    let day = base.values.day;
    if (bookingId) {
      const stay = stays.data?.find((candidate) => candidate.id === bookingId);
      if (stay) {
        // Only the stays not over yet can be linked (the ones the step offers); the day of one that is over is today.
        if (stayDateOf(stay.checkOutDate) < todayInRome()) bookingId = '';
        else if (needsStays) day = dayForStay(stay.checkOutDate);
      } else if (!stays.isPending) {
        bookingId = '';
      }
    }
    return { values: { ...base.values, propertyId, bookingId, day }, prefilled: base.prefilled };
  }, [base, propertyList, stays.data, stays.isPending, needsStays]);

  if (categories.isPending || properties.isPending || (needsStays && stays.isPending)) {
    return <LoadingScreen message={t('requestWizard.loading')} className="h-auto flex-1" />;
  }

  // Without the catalog or the properties there is nothing to ask: the wizard says so, with a way to try again, and does not open on empty lists.
  if (categories.isError || properties.isError) {
    return (
      <ErrorState
        title={t('requestWizard.loadError')}
        error={categories.error ?? properties.error}
        onRetry={() => {
          void categories.refetch();
          void properties.refetch();
        }}
      />
    );
  }

  if (propertyList !== null && propertyList.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title={t('requestWizard.noProperty.title')}
        description={t('requestWizard.noProperty.text')}
        action={{ label: t('requestWizard.noProperty.action'), href: PROPERTY_CREATE_PATH }}
      />
    );
  }

  const goToStep = (stepId: string) =>
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      next.set('step', stepId);
      return next;
    });

  const describe = (id: RequestStepId) => ({
    id,
    label: t(`requestWizard.steps.${id}.label`),
    title: t(`requestWizard.steps.${id}.title`),
    purpose: t(`requestWizard.steps.${id}.purpose`),
  });

  const property: WizardStep<RequestValues> = { ...describe('property'), schema: schemas.property, render: () => <PropertyStep /> };
  const who: WizardStep<RequestValues> = {
    ...describe('channel'),
    render: () => <ChannelStep channel={channel} explicit={search.has(CHANNEL_PARAM)} onChannel={changeChannel} />,
  };
  const service: WizardStep<RequestValues> = { ...describe('service'), schema: schemas.service, render: () => <ServiceStep channel={channel} /> };

  // With a CasaZen supplier the request goes on to its details and the summary; with an external partner the wizard stops at the
  // partners: the work is organised on their site, there is nothing to send.
  const steps: WizardStep<RequestValues>[] =
    channel === 'external'
      ? [property, who, service, { ...describe('partners'), render: ({ goTo }) => <PartnersStep goTo={goTo} /> }]
      : [
          property,
          who,
          service,
          { ...describe('proposals'), schema: schemas.proposals, render: ({ goTo }) => <ProposalsStep onChannel={changeChannel} goTo={goTo} /> },
          { ...describe('details'), schema: schemas.details, render: ({ goTo }) => <DetailsStep goTo={goTo} /> },
          { ...describe('review'), render: () => <ReviewStep /> },
        ];

  return (
    <WizardShell<RequestValues, RequestSent>
      id={REQUEST_WIZARD_ID}
      steps={steps}
      defaultValues={defaults.values}
      initialStepId={openingStepFor(defaults.values, channel)}
      finishLabel={channel === 'external' ? t('requestWizard.finishExternal') : t('requestWizard.finish')}
      finishFailedMessage={refusal ?? t('requestWizard.errors.sendFailed')}
      onFinish={async (values) => {
        if (channel === 'external') return { kind: 'external' as const };
        setRefusal(null);
        try {
          const request = await create.mutateAsync(toCreateRequest(values));
          return { kind: 'request' as const, request, supplierName: values.supplierName };
        } catch (error) {
          const problem = requestProblemOf(error);
          if (!problem) throw error;
          // A refusal that changes what the host chose: the answers stay, the host is taken to the step they are on, with the slots read again.
          if (problem.kind === 'slotTaken' || problem.kind === 'commitmentConflict') {
            void queryClient.invalidateQueries({ queryKey: HOST_SUPPLIER_SLOTS_KEY });
          }
          const message = t(`requestWizard.errors.${problem.kind}`);
          setRefusal(message);
          goToStep(problem.step);
          throw new Error(message);
        }
      }}
      // An address that asks for something (`?propertyId=…&type=cleaning`) is not given the answers of an older visit instead.
      draft={{ exclude: REQUEST_DRAFT_EXCLUDE, accept: () => !defaults.prefilled }}
      onExit={() => navigate(INTERVENTIONS_PATH)}
      renderDone={({ result, values }) => <RequestDone sent={result} values={values} />}
      testIds={{
        root: 'request-wizard',
        back: 'request-back',
        next: 'request-next',
        finish: 'request-finish',
        exit: 'request-exit',
        finishError: 'request-finish-error',
      }}
    />
  );
}

/**
 * «Richiedi un intervento» (SR-08b), `/app/short-rent/interventions/request`: for which property, who to ask (a CasaZen supplier or an
 * external partner), what service, the proposals (the suppliers in the order of the ranking), the details (service, day and time, urgency,
 * notes) and a summary that says what the supplier will see. A request is for the house: a stay is only a link the host may add. The
 * request leaves when the last button is pressed, never before; slot taken, a supplier that is no longer available and the like bring
 * the host back to the step they are on, with the answers kept.
 *
 * `?propertyId=&bookingId=&type=&date=&supplierOrgId=&serviceId=` start it filled in (the entry points of the app use them) and open it on
 * the first step that is not answered; `?channel=external` asks for the partners; `?n=` starts a new one («Fai un'altra richiesta»): the
 * wizard stays done once it is, so the same address would show its confirmation again.
 */
export function RequestInterventionPage() {
  const { t } = useTranslation();
  const [search] = useSearchParams();

  return (
    <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="request-page">
      <PageHeader title={t('requestWizard.title')} crumbs="auto" />
      <RequestWizard key={search.get('n') ?? 'first'} />
    </div>
  );
}
