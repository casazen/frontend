import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { getActivationBlockedProblem } from '@/api/compliance.api';
import { useCompleteComplianceActivation, useComplianceActivation } from '@/features/compliance/use-compliance';
import { getProblemMessage } from '@/lib/api-errors';
import { getPlanLimitMessage, getPlanUpgradeCta, getPlanUpgradePath, isPlanLimitError } from '@/lib/entitlement-error';
import { clearWizardDraft } from '@/lib/wizard-draft';
import { usePlanUsage } from '@/queries/use-properties';
import { useCurrentUser, useEntitlement } from '@/queries/use-users';
import type { Property } from '@/types';
import type { ActivationBlocker } from '@/types/compliance.types';
import { PROPERTIES_PATH } from '../properties-paths';
import { finishActions, finishStage } from './finish/finish-model';
import {
  PROPERTY_ID_PARAM,
  amenitiesUpdatePayload,
  baseStepSchema,
  baseUpdatePayload,
  createPayload,
  photosStepSchema,
  photosUpdatePayload,
  pricesStepSchema,
  pricesUpdatePayload,
  rulesStepSchema,
  rulesUpdatePayload,
  visibilityUpdatePayload,
  wizardDefaults,
  type PropertyWizardValues,
  type WizardStepId,
} from './property-wizard-model';
import { PropertyWizardDone } from './property-wizard-done';
import { AmenitiesStep } from './steps/amenities-step';
import { BaseStep } from './steps/base-step';
import { FinishStep } from './steps/finish-step';
import { PhotosStep } from './steps/photos-step';
import { PricesStep } from './steps/prices-step';
import { RulesStep } from './steps/rules-step';
import { useWizardCreateProperty, useWizardSaveProperty } from './use-wizard-property';

/** Name of the flow: the draft of the first step lives under it. */
const WIZARD_ID = 'property-new';

/** The wizard's plan notice: the same box and words the creation page has always had, so the limit reads the same everywhere. */
function PlanLimitAlert() {
  return (
    <div role="alert" data-testid="plan-limit-alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
      <p className="font-medium text-destructive">{getPlanLimitMessage()}</p>
      <Link to={getPlanUpgradePath('short-rent')} className="mt-1 inline-block font-medium text-primary underline underline-offset-2">
        {getPlanUpgradeCta()}
      </Link>
    </div>
  );
}

interface SaveAndCloseProps {
  /** Saves the answers of the step on screen, as «Avanti» does. */
  save: (stepId: string, values: PropertyWizardValues) => Promise<void>;
  onSaved: () => void;
}

/**
 * «Salva e chiudi» (SR-07b): leaves the wizard from any step with what was answered saved, as «Avanti» saves it, and without going
 * on. The property exists already and is «Da completare»: nothing is lost by closing the browser either. A step that is not valid
 * is not saved: its problems show, as with «Avanti».
 */
function SaveAndClose({ save, onSaved }: SaveAndCloseProps) {
  const { t } = useTranslation();
  const wizard = useOptionalWizard();
  const form = useFormContext<PropertyWizardValues>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (!wizard) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!(await form.trigger())) return;
      await save(wizard.stepId, form.getValues());
      onSaved();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {error ? (
        <Alert variant="danger" className="w-full" data-testid="property-wizard-save-close-error">
          {getProblemMessage(error, t) ?? t('wizard.errors.finishFailed')}
        </Alert>
      ) : null}
      <Button type="button" variant="ghost" size="sm" loading={busy} onClick={() => void run()} data-testid="property-wizard-save-close">
        {t('propertyWizard.exit.saveAndClose')}
      </Button>
    </div>
  );
}

interface PropertyWizardProps {
  /** The property when the wizard reopens on one (`?propertyId=`); absent when a new one is being added. */
  property?: Property;
  /** The step to open on when the address names none. */
  initialStepId?: WizardStepId;
  /** Told the id of the property this very wizard created, so the page knows that the id which appears in the address is its own. */
  onCreated?: (propertyId: string) => void;
}

/**
 * «Aggiungi immobile» (SR-07b): a guided flow on `WizardShell` that creates the property on the server at the end of its first step
 * (SR-D11) and saves each step as the person goes on, so closing the browser loses nothing after the first «Avanti» and the flow can
 * be reopened where it was (`?propertyId=`). The first «Avanti» creates; the next ones update. What is missing is the server's: the
 * last step and the confirmation read it from the activation, it is not worked out here.
 *
 * The six steps: the basics, the photos and the text of the listing, the amenities and the safety sheet, the house rules, the prices,
 * and the last one — calendars, CIN, documents, the summary, «Mostra la casa sul sito» and the activation with the terms.
 */
export function PropertyWizard({ property, initialStepId, onCreated }: PropertyWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, org } = useCurrentUser();
  const create = useWizardCreateProperty();
  const saveProperty = useWizardSaveProperty();
  const [defaults] = useState(() => wizardDefaults(property));
  const [propertyId, setPropertyId] = useState<string | null>(property?.id ?? null);
  const [planLimitHit, setPlanLimitHit] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  /** The blockers of the last refused activation (409): the server knows some that the screen could not. */
  const [refused, setRefused] = useState<readonly ActivationBlocker[] | null>(null);
  /** «Mostra la casa sul sito» as the server has it: what the form started from, then what was last written. */
  const storedVisibility = useRef(defaults.publishedOnSite);

  // What is missing and where the property stands, read again after every save (the saves invalidate it): the last step and its
  // button are drawn from it, nothing is worked out from the form.
  const activation = useComplianceActivation(propertyId ?? '');
  const completeActivation = useCompleteComplianceActivation(propertyId ?? '');
  const stage = finishStage(activation.data);

  // Said before the first step is saved: the plan usage (any writer reads it) or the entitlement (the billing administrator) say
  // there is no room, or the server just refused (403 `plan_limit_reached`). The server stays the source of truth on a create.
  const planUsage = usePlanUsage(!propertyId);
  const entitlement = useEntitlement();
  const blockedByPlan = !propertyId && (planLimitHit || planUsage.data?.canAdd === false || entitlement.data?.canAddProperty === false);

  // The property is in the address from the moment it exists (the reload and the links need it), whichever way the step changed.
  // The address is read from the browser, not from this render: «Avanti» changes the step right after the creation, and the router
  // has not rendered that yet when this runs — the copy of the address that `setSearchParams((previous) => …)` hands over is the
  // old one, and writing the property into it would put the old step back and keep the wizard on the first step. It runs again at
  // every address the router renders (`searchParams`), so a later step change that leaves the property out is mended too.
  useEffect(() => {
    if (!propertyId) return;
    const current = new URLSearchParams(window.location.search);
    if (current.get(PROPERTY_ID_PARAM) === propertyId) return;
    current.set(PROPERTY_ID_PARAM, propertyId);
    setSearchParams(current, { replace: true });
  }, [propertyId, searchParams, setSearchParams]);

  const saveBase = async (values: PropertyWizardValues) => {
    try {
      if (propertyId) {
        await saveProperty.mutateAsync({ id: propertyId, data: baseUpdatePayload(values) });
        return;
      }
      const created = await create.mutateAsync(createPayload(values));
      // From now on the answers live on the server: the draft of the first step must not offer to add this property again.
      if (user?.id) clearWizardDraft(WIZARD_ID, { userId: user.id, orgId: org?.id ?? null });
      onCreated?.(created.id);
      setPropertyId(created.id);
    } catch (error) {
      if (isPlanLimitError(error)) setPlanLimitHit(true);
      throw error;
    }
  };

  // The headline and the description; the photos themselves go to the server as they are chosen, not with the step.
  const savePhotos = async (values: PropertyWizardValues) => {
    if (!propertyId) return;
    await saveProperty.mutateAsync({ id: propertyId, data: photosUpdatePayload(values) });
  };

  const saveRules = async (values: PropertyWizardValues) => {
    if (!propertyId) return;
    await saveProperty.mutateAsync({ id: propertyId, data: rulesUpdatePayload(values) });
  };

  const savePrices = async (values: PropertyWizardValues) => {
    if (!propertyId) return;
    await saveProperty.mutateAsync({ id: propertyId, data: pricesUpdatePayload(values) });
  };

  // The last button: writes the switch (first, so that a «no» is in place when the property goes live) and activates, when the server
  // says that nothing blocks; with a blocker open it sends nothing and the host finishes later.
  const finish = async (values: PropertyWizardValues) => {
    if (!propertyId) return null;
    setRefused(null);
    for (const action of finishActions(stage, values.publishedOnSite, storedVisibility.current)) {
      if (action === 'visibility') {
        await saveProperty.mutateAsync({ id: propertyId, data: visibilityUpdatePayload(values.publishedOnSite) });
        storedVisibility.current = values.publishedOnSite;
      } else {
        try {
          await completeActivation.mutateAsync({ tosAccepted: true });
        } catch (error) {
          const blocked = getActivationBlockedProblem(error);
          if (blocked) setRefused(blocked.blockers.length > 0 ? blocked.blockers : blocked.incompleteBlockers.map((step) => ({ step, code: '', message: '' })));
          throw error;
        }
      }
    }
    return propertyId;
  };

  // A property created in this visit has no amenity yet; one the wizard reopened on keeps the ones the house rules decide.
  const saveAmenities = async (values: PropertyWizardValues) => {
    if (!propertyId) return;
    await saveProperty.mutateAsync({ id: propertyId, data: amenitiesUpdatePayload(values, property ?? { amenities: [] }) });
  };

  const steps: WizardStep<PropertyWizardValues>[] = [
    {
      id: 'base',
      label: t('propertyWizard.steps.base.label'),
      title: t('propertyWizard.steps.base.title'),
      purpose: t('propertyWizard.steps.base.purpose'),
      schema: baseStepSchema,
      beforeNext: saveBase,
      // Over the limit of the plan the first «Avanti» cannot create anything: it is off, as the form of before was, and the notice
      // says why. The server still decides on a create (a stale page cannot get past it).
      nextDisabled: blockedByPlan,
      render: ({ form }) => (
        <>
          {blockedByPlan ? <PlanLimitAlert /> : null}
          <BaseStep form={form} />
        </>
      ),
    },
    {
      id: 'photos',
      label: t('propertyWizard.steps.photos.label'),
      title: t('propertyWizard.steps.photos.title'),
      purpose: t('propertyWizard.steps.photos.purpose'),
      optional: true,
      schema: photosStepSchema,
      beforeNext: savePhotos,
      render: ({ form }) => (propertyId ? <PhotosStep form={form} propertyId={propertyId} /> : null),
    },
    {
      id: 'amenities',
      label: t('propertyWizard.steps.amenities.label'),
      title: t('propertyWizard.steps.amenities.title'),
      purpose: t('propertyWizard.steps.amenities.purpose'),
      optional: true,
      beforeNext: saveAmenities,
      render: ({ form }) => (propertyId ? <AmenitiesStep form={form} propertyId={propertyId} /> : null),
    },
    {
      id: 'rules',
      label: t('propertyWizard.steps.rules.label'),
      title: t('propertyWizard.steps.rules.title'),
      purpose: t('propertyWizard.steps.rules.purpose'),
      optional: true,
      schema: rulesStepSchema,
      beforeNext: saveRules,
      render: ({ form }) => (propertyId ? <RulesStep form={form} /> : null),
    },
    {
      id: 'prices',
      label: t('propertyWizard.steps.prices.label'),
      title: t('propertyWizard.steps.prices.title'),
      purpose: t('propertyWizard.steps.prices.purpose'),
      schema: pricesStepSchema,
      beforeNext: savePrices,
      render: ({ form }) => (propertyId ? <PricesStep form={form} propertyId={propertyId} /> : null),
    },
    {
      id: 'finish',
      label: t('propertyWizard.steps.finish.label'),
      title: t('propertyWizard.steps.finish.title'),
      purpose: t('propertyWizard.steps.finish.purpose'),
      // The terms are the one thing the host still has to do when nothing blocks; a click before that would only be refused.
      nextDisabled: stage === 'loading' || (stage === 'ready' && !tosAccepted),
      render: ({ form }) =>
        propertyId ? (
          <FinishStep
            form={form}
            propertyId={propertyId}
            activation={activation.data}
            activationFailed={activation.isError}
            onRetryActivation={() => void activation.refetch()}
            refused={refused}
            tosAccepted={tosAccepted}
            onTosChange={setTosAccepted}
          />
        ) : null,
    },
  ];
  const saveByStep: Record<string, (values: PropertyWizardValues) => Promise<void>> = {
    base: saveBase,
    photos: savePhotos,
    amenities: saveAmenities,
    rules: saveRules,
    prices: savePrices,
    // The calendars, the CIN and the documents are saved by their own buttons; the switch goes with the last one.
    finish: async () => undefined,
  };

  return (
    <WizardShell<PropertyWizardValues, string | null>
      id={WIZARD_ID}
      steps={steps}
      defaultValues={defaults}
      initialStepId={initialStepId}
      finishLabel={t(`propertyWizard.last.button.${stage === 'ready' ? 'activate' : stage === 'active' ? 'done' : 'later'}`)}
      finishFailedMessage={t('propertyWizard.errors.saveFailed')}
      onFinish={finish}
      // The first step is not saved yet: the draft keeps its answers over a reload. Once the property exists they are on the server.
      draft={propertyId ? false : { accept: (saved) => saved.step === 'base' }}
      onExit={() => navigate(PROPERTIES_PATH)}
      aboveFooter={
        propertyId ? (
          <SaveAndClose
            save={(stepId, values) => saveByStep[stepId]?.(values) ?? Promise.resolve()}
            onSaved={() => {
              toast.success(t('propertyWizard.exit.saved'));
              navigate(PROPERTIES_PATH);
            }}
          />
        ) : null
      }
      renderDone={() => <PropertyWizardDone propertyId={propertyId ?? searchParams.get(PROPERTY_ID_PARAM)} />}
      testIds={{
        root: 'property-wizard',
        back: 'property-wizard-back',
        next: 'property-wizard-next',
        finish: 'property-wizard-finish',
        exit: 'property-wizard-exit',
      }}
    />
  );
}
