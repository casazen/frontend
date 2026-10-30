import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { getProblemMessage } from '@/lib/api-errors';
import { getPlanLimitMessage, getPlanUpgradeCta, getPlanUpgradePath, isPlanLimitError } from '@/lib/entitlement-error';
import { clearWizardDraft } from '@/lib/wizard-draft';
import { usePlanUsage } from '@/queries/use-properties';
import { useCurrentUser, useEntitlement } from '@/queries/use-users';
import type { Property } from '@/types';
import { PROPERTIES_PATH } from '../properties-paths';
import {
  PROPERTY_ID_PARAM,
  amenitiesUpdatePayload,
  baseStepSchema,
  baseUpdatePayload,
  createPayload,
  photosStepSchema,
  photosUpdatePayload,
  wizardDefaults,
  type PropertyWizardValues,
  type WizardStepId,
} from './property-wizard-model';
import { PropertyWizardDone } from './property-wizard-done';
import { AmenitiesStep } from './steps/amenities-step';
import { BaseStep } from './steps/base-step';
import { PhotosStep } from './steps/photos-step';
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
 * confirmation at the end reads it from the activation, it is not worked out here.
 *
 * The steps of the design that follow (photos, house rules, prices, calendars and activation) are added by the tasks that build them;
 * until then the property is completed from its page and from the activation wizard, as it always was.
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

  // Said before the first step is saved: the plan usage (any writer reads it) or the entitlement (the billing administrator) say
  // there is no room, or the server just refused (403 `plan_limit_reached`). The server stays the source of truth on a create.
  const planUsage = usePlanUsage(!propertyId);
  const entitlement = useEntitlement();
  const blockedByPlan = !propertyId && (planLimitHit || planUsage.data?.canAdd === false || entitlement.data?.canAddProperty === false);

  // The property is in the address from the moment it exists (the reload and the links need it), whichever way the step changed: a
  // navigation made with an older copy of the address cannot drop it, because this runs after it and looks at the address as it is.
  useEffect(() => {
    if (!propertyId || searchParams.get(PROPERTY_ID_PARAM) === propertyId) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set(PROPERTY_ID_PARAM, propertyId);
        return next;
      },
      { replace: true },
    );
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
  ];
  const saveByStep: Record<string, (values: PropertyWizardValues) => Promise<void>> = { base: saveBase, photos: savePhotos, amenities: saveAmenities };

  return (
    <WizardShell<PropertyWizardValues, string | null>
      id={WIZARD_ID}
      steps={steps}
      defaultValues={defaults}
      initialStepId={initialStepId}
      finishLabel={t('propertyWizard.finish')}
      finishFailedMessage={t('propertyWizard.errors.saveFailed')}
      onFinish={() => propertyId}
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
