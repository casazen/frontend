import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { PROPERTY_CREATE_PATH } from '@/features/properties/properties-paths';
import { cn } from '@/lib/utils';
import { usePropertyBookings } from '@/queries/use-bookings';
import { HOST_SUPPLIER_SLOTS_KEY } from '@/queries/use-host-supplier-catalog';
import { useProperties } from '@/queries/use-properties';
import { useServiceCategories } from '@/queries/use-service-categories';
import { useCreateIntervention } from '@/queries/use-service-requests';
import { INTERVENTIONS_PATH } from '../paths';
import { RequestDone, type RequestSent } from './request-done';
import {
  REQUEST_DRAFT_EXCLUDE,
  REQUEST_WIZARD_ID,
  requestDefaults,
  requestProblemOf,
  requestStepSchemas,
  toCreateRequest,
  type RequestValues,
} from './request-model';
import { dayForStay, ReviewStep, WhatStep, WhenStep, WhoStep } from './request-steps';

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
        if (needsStays) day = dayForStay(stay.checkOutDate);
      } else if (!stays.isPending) {
        bookingId = '';
      }
    }
    return { values: { ...base.values, propertyId, bookingId, day }, prefilled: base.prefilled };
  }, [base, propertyList, stays.data, stays.isPending, needsStays]);

  if (categories.isPending || properties.isPending || (needsStays && stays.isPending)) {
    return <LoadingScreen message={t('requestWizard.loading')} className="h-auto flex-1" />;
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

  const steps: WizardStep<RequestValues>[] = [
    {
      id: 'what',
      label: t('requestWizard.steps.what.label'),
      title: t('requestWizard.steps.what.title'),
      purpose: t('requestWizard.steps.what.purpose'),
      schema: schemas.what,
      render: () => <WhatStep />,
    },
    {
      id: 'when',
      label: t('requestWizard.steps.when.label'),
      title: t('requestWizard.steps.when.title'),
      purpose: t('requestWizard.steps.when.purpose'),
      schema: schemas.when,
      render: () => <WhenStep />,
    },
    {
      id: 'who',
      label: t('requestWizard.steps.who.label'),
      title: t('requestWizard.steps.who.title'),
      purpose: t('requestWizard.steps.who.purpose'),
      schema: schemas.who,
      render: () => <WhoStep />,
    },
    {
      id: 'review',
      label: t('requestWizard.steps.review.label'),
      title: t('requestWizard.steps.review.title'),
      purpose: t('requestWizard.steps.review.purpose'),
      render: () => <ReviewStep />,
    },
  ];

  return (
    <WizardShell<RequestValues, RequestSent>
      id={REQUEST_WIZARD_ID}
      steps={steps}
      defaultValues={defaults.values}
      finishLabel={t('requestWizard.finish')}
      finishFailedMessage={refusal ?? t('requestWizard.errors.sendFailed')}
      onFinish={async (values) => {
        setRefusal(null);
        try {
          const request = await create.mutateAsync(toCreateRequest(values));
          return { request, supplierName: values.supplierName };
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
 * «Richiedi un intervento» (SR-08b), `/app/short-rent/interventions/request`: what is needed, where and when, who, and a summary that
 * says what the supplier will see. The request leaves when the last button is pressed, never before; slot taken, a supplier that is no
 * longer available and the like bring the host back to the step they are on, with the answers kept.
 *
 * `?propertyId=&bookingId=&type=&date=&supplierOrgId=` start it filled in (the entry points of the app use them); `?n=` starts a new
 * one («Fai un'altra richiesta»): the wizard stays done once it is, so the same address would show its confirmation again.
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
