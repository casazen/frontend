import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { PROPERTY_CREATE_PATH } from '@/features/properties/properties-paths';
import { cn } from '@/lib/utils';
import { useBooking } from '@/queries/use-bookings';
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
import { ChannelStep, CleaningBrief, PartnersStep, PropertyStep, ProposalsStep, ServiceStep, type ChangeChannel } from './request-pick-steps';
import { DetailsStep, ReviewStep } from './request-steps';

/** Entry points share a draft only when they refer to the same original job. Moving between steps keeps the same form. */
function entryKey(search: URLSearchParams) {
  const entry = new URLSearchParams();
  for (const field of ['propertyId', 'bookingId', 'type', 'date', 'supplierOrgId', 'serviceId', 'n']) {
    const value = search.get(field);
    if (value) entry.set(field, value);
  }
  const context = entry.toString();
  return context ? `${REQUEST_WIZARD_ID}?${context}` : REQUEST_WIZARD_ID;
}

/** Availability is checked afresh after a reload. Open the first missing answer before showing the review. */
function ResumeRequest({ review, children }: { review?: boolean; children: ReactNode }) {
  const [, setSearch] = useSearchParams();
  const { getValues } = useFormContext<RequestValues>();
  const { propertyId, category, supplierOrgId, serviceId, startTime } = getValues();
  const missing = !propertyId ? 'property' : !category ? 'service' : !supplierOrgId ? 'proposals' : review && (!serviceId || !startTime) ? 'details' : null;
  useEffect(() => {
    if (!missing) return;
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      next.set('step', missing);
      return next;
    }, { replace: true, state: { requestResumed: true } });
  }, [setSearch, missing]);
  return missing ? null : children;
}

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
  const [checkAfterFailure, setCheckAfterFailure] = useState<string | null>(null);
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
  const addressed = propertyList?.some((property) => property.id === base.values.propertyId);
  const linkedStay = useBooking(base.values.bookingId, { enabled: !!addressed });
  const propertyId = addressed ? base.values.propertyId : propertyList?.length === 1 ? propertyList[0].id : '';
  const stay = addressed && linkedStay.data?.propertyId === propertyId && linkedStay.data.status !== 'Cancelled' ? linkedStay.data : undefined;
  const values = {
    ...base.values,
    propertyId,
    bookingId: stay?.id ?? '',
    day: stay && !search.has('date') ? dayForStay(stay.checkOutDate) : base.values.day,
  };
  const needsStay = !!base.values.bookingId && !!addressed;
  if (categories.isPending || properties.isPending || (needsStay && linkedStay.isPending)) {
    return <LoadingScreen message={t('requestWizard.loading')} className="h-auto flex-1" />;
  }

  if (categories.isError || properties.isError || (needsStay && linkedStay.isError)) {
    return (
      <ErrorState
        title={t('requestWizard.loadError')}
        error={categories.error ?? properties.error ?? linkedStay.error}
        onRetry={() => {
          if (categories.isError) void categories.refetch();
          if (properties.isError) void properties.refetch();
          if (needsStay && linkedStay.isError) void linkedStay.refetch();
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

  if (base.values.bookingId && !stay) {
    return <EmptyState icon={Building2} title={t('requestWizard.housekeeping.stayUnavailable')}
      action={{ label: t('interventions.title'), href: INTERVENTIONS_PATH }} />;
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
          { ...describe('proposals'), schema: schemas.proposals, render: ({ goTo }) => <><CleaningBrief /><ProposalsStep onChannel={changeChannel} goTo={goTo} /></> },
          { ...describe('details'), schema: schemas.details, render: ({ goTo }) => <ResumeRequest><DetailsStep goTo={goTo} linkedStay={stay} /></ResumeRequest> },
          { ...describe('review'), render: () => <ResumeRequest review><ReviewStep linkedStay={stay} /></ResumeRequest> },
        ];

  return (
    <WizardShell<RequestValues, RequestSent>
      id={entryKey(search)}
      steps={steps}
      defaultValues={values}
      initialStepId={openingStepFor(values, channel)}
      finishLabel={channel === 'external' ? t('requestWizard.finishExternal') : t('requestWizard.finish')}
      finishFailedMessage={refusal ?? t('requestWizard.errors.sendFailed')}
      aboveFooter={checkAfterFailure && (
        <Link to={checkAfterFailure} className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">
          {t('requestWizard.housekeeping.checkList')}
        </Link>
      )}
      onFinish={async (values) => {
        if (channel === 'external') return { kind: 'external' as const };
        setRefusal(null);
        setCheckAfterFailure(null);
        try {
          const request = await create.mutateAsync(toCreateRequest(values));
          return { kind: 'request' as const, request, supplierName: values.supplierName };
        } catch (error) {
          const problem = requestProblemOf(error);
          if (!problem) {
            if (isAxiosError(error) && (!error.response || error.response.status >= 500)) {
              // The supplier may already have the request when the creation response is lost.
              const message = t('requestWizard.housekeeping.unknown');
              setRefusal(message);
              setCheckAfterFailure(values.bookingId ? `${INTERVENTIONS_PATH}?bookingId=${encodeURIComponent(values.bookingId)}` : INTERVENTIONS_PATH);
              throw new Error(message, { cause: error });
            }
            throw error;
          }
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
      draft={{
        exclude: REQUEST_DRAFT_EXCLUDE,
        version: 2,
        accept: (draft) => !draft.values.propertyId || !!propertyList?.some(({ id }) => id === draft.values.propertyId),
      }}
      onExit={() => navigate(stay ? `/app/short-rent/bookings/${stay.id}` : INTERVENTIONS_PATH)}
      renderDone={({ result, values }) => <RequestDone sent={result} values={values} stayId={stay?.id} />}
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
      <RequestWizard key={entryKey(search)} />
    </div>
  );
}
