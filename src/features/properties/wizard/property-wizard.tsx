import { usePlanReturn } from '@/features/onboarding/plan-return';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useFormContext, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { WizardShell, type WizardShellProps, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { ownerOnboardingApi } from '@/api/owner-onboarding.api';
import { getBillingSetup } from '@/api/billing-setup.api';
import { propertySenderApi } from '@/api/property-sender.api';
import { useCommercialProfile } from '@/hooks/use-commercial-profile';
import { commercialRouteAllowed } from '@/features/onboarding/commercial-access';
import { billingIdentityComplete, senderChoiceSaved } from './property-setup-model';
import { BillingSetupStep } from './steps/billing-setup-step';
import { ComplianceSetupStep } from './steps/compliance-setup-step';
import { getActivationBlockedProblem } from '@/api/compliance.api';
import { openReminders } from '@/features/compliance/activation-wizard-model';
import { useCompleteComplianceActivation, useComplianceActivation } from '@/features/compliance/use-compliance';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { getPlanLimitMessage, getPlanUpgradeCta, getPlanUpgradePath, isPlanLimitError } from '@/lib/entitlement-error';
import { clearWizardDraft } from '@/lib/wizard-draft';
import { photoMetaSignature } from '@/lib/listing-photos';
import { textDraftsChanged, textDraftsFromProfile } from '@/lib/listing-texts';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { usePropertyRooms, useSavePropertyRooms, useSaveStayDiscounts } from '@/queries/use-listing-data';
import type { AdoptedTexts } from '@/queries/use-listing-status';
import { usePlanUsage } from '@/queries/use-properties';
import { useSaveListingTexts, useSavePhotoMeta } from '@/queries/use-site-profile';
import { useCurrentUser, useEntitlement } from '@/queries/use-users';
import type { Property } from '@/types';
import type { ActivationBlocker } from '@/types/compliance.types';
import { PROPERTIES_PATH } from '../properties-paths';
import { finishActions, finishStage } from './finish/finish-model';
import {
  EMPTY_LISTING_SEED,
  PROPERTY_ID_PARAM,
  SAVE_AND_CLOSE_SCHEMAS,
  adoptableFieldsOf,
  amenitiesUpdatePayload,
  baseStepSchema,
  baseUpdatePayload,
  createPayload,
  descriptionsLengthsSchema,
  descriptionsStepSchema,
  descriptionsUpdatePayload,
  photosStepSchema,
  pricesStepSchema,
  pricesUpdatePayload,
  rulesStepSchema,
  rulesUpdatePayload,
  visibilityUpdatePayload,
  wizardDefaults,
  type PropertyWizardValues,
  type WizardListingSeed,
  type WizardStepId,
} from './property-wizard-model';
import { forgetPropertyStep, rememberPropertyStep } from './property-setup-progress';
import { PropertyWizardDone } from './property-wizard-done';
import { roomInputs, roomsSignature, type RoomDraft } from './rooms-model';
import { stayDiscountTiers } from './stay-discounts-model';
import { AmenitiesStep } from './steps/amenities-step';
import { BaseStep } from './steps/base-step';
import { ChannelsStep } from './steps/channels-step';
import { DescriptionsStep } from './steps/descriptions-step';
import { FinishStep } from './steps/finish-step';
import { PhotosStep } from './steps/photos-step';
import { PricesStep } from './steps/prices-step';
import { OwnerStep } from './steps/owner-step';
import { propertyHasOwner } from './owner-step-model';
import { RulesStep } from './steps/rules-step';
import { useWizardCreateProperty, useWizardSaveProperty } from './use-wizard-property';

const WIZARD_ID = 'property-new';

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
  save?: (stepId: string, values: PropertyWizardValues) => Promise<void>;
  onSaved: (step: string) => void;
}

function SaveAndClose({ save, onSaved }: SaveAndCloseProps) {
  const { t } = useTranslation();
  const wizard = useOptionalWizard();
  const form = useFormContext<PropertyWizardValues>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (!wizard) return null;

  const run = async () => {
    if (!save) {
      onSaved(wizard.stepId);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const lenient = SAVE_AND_CLOSE_SCHEMAS[wizard.stepId];
      if (lenient ? !lenient.safeParse(form.getValues()).success : false) {
        await form.trigger();
        return;
      }
      if (!lenient && !(await form.trigger())) return;
      await save(wizard.stepId, form.getValues());
      onSaved(wizard.stepId);
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
  property?: Property;
  listing?: WizardListingSeed;
  onlySteps?: readonly WizardStepId[];
  initialStepId?: WizardStepId;
  onCreated?: (propertyId: string) => void;
}

/**
 * «Aggiungi immobile» (SR-07b): a guided flow on `WizardShell` that creates the property on the server at the end of its first step
 * (SR-D11) and saves each step as the person goes on, so closing the browser loses nothing after the first «Avanti» and the flow can
 * be reopened where it was (`?propertyId=`). The first «Avanti» creates; the next ones update. What is missing is the server's: the
 * last step and the confirmation read it from the activation, it is not worked out here.
 *
 * The seven steps: the basics with the rooms, the photos with their captions and rooms, the amenities and the safety sheet, the
 * descriptions in the languages of the channel manager, the house rules, the prices with the length-of-stay discounts, and the last
 * one — calendars, CIN, documents, the summary, «Mostra la casa sul sito» and the activation with the terms.
 */
export function PropertyWizard({ property, listing = EMPTY_LISTING_SEED, onlySteps, initialStepId, onCreated }: PropertyWizardProps) {
  const { t } = useTranslation();
  // The channels step exists only where the channel manager is connected (its flag): the endpoints it reads answer 404 otherwise.
  const { flags } = useFeatureFlags();
  const connectorOn = flags.octorateConnector;
  const commercial = useCommercialProfile();
  const complianceOn = commercialRouteAllowed(commercial, '/app/short-rent/compliance');
  const billingOn = flags.fiscalDocumentIssuance && commercialRouteAllowed(commercial, '/app/short-rent/fiscal');
  const navigate = useNavigate();
  const planReturn = usePlanReturn();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, org } = useCurrentUser();
  const { contexts } = useWorkspace();
  const create = useWizardCreateProperty();
  const saveProperty = useWizardSaveProperty();
  const saveRoomsMutation = useSavePropertyRooms();
  const saveDiscountsMutation = useSaveStayDiscounts();
  const saveTextsMutation = useSaveListingTexts();
  const savePhotoMetaMutation = useSavePhotoMeta();
  const [defaults] = useState(() => wizardDefaults(property, listing));
  const [propertyId, setPropertyId] = useState<string | null>(property?.id ?? null);
  const storedRooms = usePropertyRooms(propertyId ?? undefined);
  const roomIds = useRef(new Map<string, string>(listing.rooms.map((room) => [room.id, room.id])));
  const savedRooms = useRef(roomsSignature(defaults.rooms));
  const savedTexts = useRef(textDraftsFromProfile(listing.siteProfile));
  const savedPhotoMeta = useRef(photoMetaSignature(defaults.photoMeta));
  const savedDiscounts = useRef(JSON.stringify(stayDiscountTiers(defaults.stayDiscounts)));
  const [planLimitHit, setPlanLimitHit] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [setupFailure, setSetupFailure] = useState<string | null>(null);
  const [remindersAccepted, setRemindersAccepted] = useState(false);
  const [refused, setRefused] = useState<readonly ActivationBlocker[] | null>(null);
  const storedVisibility = useRef(defaults.publishedOnSite);

  const activation = useComplianceActivation(propertyId ?? '');
  const completeActivation = useCompleteComplianceActivation(propertyId ?? '');
  const stage = finishStage(activation.data);
  const remindersOpen = openReminders(activation.data?.steps ?? []).length > 0;

  const planUsage = usePlanUsage(!propertyId);
  const canAssignOwner = isOrgBillingAdmin(contexts);
  const entitlement = useEntitlement(canAssignOwner);
  const ownerRequired = entitlement.data?.isAgency ?? (org?.isAgency === true && org.planTier === 'Agency');
  const verifyOwner = async () => {
    if (!ownerRequired || !propertyId) return;
    const report = await ownerOnboardingApi.getReadiness(propertyId);
    if (!propertyHasOwner(report, propertyId)) throw new Error(t('propertyWizard.owner.required'));
  };
  const blockedByPlan = !propertyId && (planLimitHit || planUsage.data?.canAdd === false || entitlement.data?.canAddProperty === false);

  useEffect(() => {
    if (!propertyId) return;
    const current = new URLSearchParams(window.location.search);
    if (current.get(PROPERTY_ID_PARAM) === propertyId) return;
    current.set(PROPERTY_ID_PARAM, propertyId);
    setSearchParams(current, { replace: true });
  }, [propertyId, searchParams, setSearchParams]);

  const saveRooms = async (id: string, rooms: readonly RoomDraft[]) => {
    if (rooms.length === 0) return;
    const signature = roomsSignature(rooms);
    if (signature === savedRooms.current) return;
    const saved = await saveRoomsMutation.mutateAsync({ propertyId: id, rooms: roomInputs(rooms, (key) => roomIds.current.get(key)) });
    rooms.forEach((room, index) => {
      const stored = saved[index];
      if (stored) roomIds.current.set(room.key, stored.id);
    });
    savedRooms.current = signature;
  };

  const saveBase = async (values: PropertyWizardValues) => {
    try {
      if (propertyId) {
        await saveProperty.mutateAsync({ id: propertyId, data: baseUpdatePayload(values) });
        await saveRooms(propertyId, values.rooms);
        return;
      }
      const created = await create.mutateAsync(createPayload(values));
      if (user?.id) clearWizardDraft(WIZARD_ID, { userId: user.id, orgId: org?.id ?? null });
      onCreated?.(created.id);
      setPropertyId(created.id);
      await saveRooms(created.id, values.rooms);
    } catch (error) {
      if (isPlanLimitError(error)) setPlanLimitHit(true);
      throw error;
    }
  };

  const savePhotos = async (values: PropertyWizardValues) => {
    if (!propertyId) return;
    const known = storedRooms.data ? new Set(storedRooms.data.map((room) => room.id)) : null;
    const drafts = values.photoMeta.map((draft) => (known && draft.roomId !== '' && !known.has(draft.roomId) ? { ...draft, roomId: '' } : draft));
    const signature = photoMetaSignature(drafts);
    if (signature === savedPhotoMeta.current) return;
    await savePhotoMetaMutation.mutateAsync({ propertyId, drafts });
    savedPhotoMeta.current = signature;
  };

  const saveDescriptions = async (values: PropertyWizardValues) => {
    if (!propertyId) return;
    await saveProperty.mutateAsync({ id: propertyId, data: descriptionsUpdatePayload(values) });
    if (!textDraftsChanged(savedTexts.current, values.texts)) return;
    await saveTextsMutation.mutateAsync({ propertyId, drafts: values.texts });
    savedTexts.current = structuredClone(values.texts);
  };

  // «Prendi la nuova versione» rewrote the Italian description, the house rules and the texts of the other languages on the server. The form
  // starts from them again, and so does the record of what was last saved: the next «Avanti» on the texts or the rules (after a «Modifica»
  // of the summary, or a step back) would otherwise send the old ones back over the ones just adopted (E02/F03/US01/T04, NF-27).
  const adoptServerTexts = (form: UseFormReturn<PropertyWizardValues>, adopted: AdoptedTexts) => {
    const fields = adoptableFieldsOf(adopted.property, adopted.siteProfile);
    form.setValue('listingTitle', fields.listingTitle);
    form.setValue('description', fields.description);
    form.setValue('houseRules', fields.houseRules);
    form.setValue('texts', fields.texts);
    savedTexts.current = textDraftsFromProfile(adopted.siteProfile);
  };

  const saveRules = async (values: PropertyWizardValues) => {
    if (!propertyId) return;
    await saveProperty.mutateAsync({ id: propertyId, data: rulesUpdatePayload(values) });
  };

  const savePrices = async (values: PropertyWizardValues) => {
    if (!propertyId) return;
    await saveProperty.mutateAsync({ id: propertyId, data: pricesUpdatePayload(values) });
    const discounts = stayDiscountTiers(values.stayDiscounts);
    const signature = JSON.stringify(discounts);
    if (signature === savedDiscounts.current) return;
    await saveDiscountsMutation.mutateAsync({ propertyId, discounts });
    savedDiscounts.current = signature;
  };

  const verifyCompliance = async (values: PropertyWizardValues) => {
    setSetupFailure(null);
    if (!propertyId || !complianceOn || values.country !== 'IT') return;
    const sender = await propertySenderApi.get(propertyId);
    if (!senderChoiceSaved(sender)) {
      const message = t('propertySetup.compliance.required');
      setSetupFailure(message);
      throw new Error(message);
    }
  };
  const verifyBilling = async () => {
    setSetupFailure(null);
    if (!billingOn) return;
    if (!billingIdentityComplete(await getBillingSetup())) {
      const message = t('propertySetup.billing.required');
      setSetupFailure(message);
      throw new Error(message);
    }
  };

  // The last button: writes the switch (first, so that a «no» is in place when the property goes live) and activates, when the server
  // says that nothing blocks; with a blocker open it sends nothing and the host finishes later.
  const finish = async (values: PropertyWizardValues) => {
    if (!propertyId) return null;
    setSetupFailure(null);
    if (stage === 'ready' || stage === 'active') await verifyOwner();
    if (stage === 'ready' && !onlySteps) {
      await verifyCompliance(values);
      await verifyBilling();
    }
    setRefused(null);
    for (const action of finishActions(stage, values.publishedOnSite, storedVisibility.current)) {
      if (action === 'visibility') {
        await saveProperty.mutateAsync({ id: propertyId, data: visibilityUpdatePayload(values.publishedOnSite) });
        storedVisibility.current = values.publishedOnSite;
      } else {
        try {
          await completeActivation.mutateAsync({ tosAccepted: true, ...(remindersOpen ? { remindersAcknowledged: true } : {}) });
        } catch (error) {
          const blocked = getActivationBlockedProblem(error);
          if (blocked) setRefused(blocked.blockers.length > 0 ? blocked.blockers : blocked.incompleteBlockers.map((step) => ({ step, code: '', message: '' })));
          throw error;
        }
      }
    }
    if (user?.id && org?.id) {
      const scope = { userId: user.id, orgId: org.id };
      if (stage === 'ready' || stage === 'active') forgetPropertyStep(scope, propertyId);
      else rememberPropertyStep(scope, propertyId, 'finish');
    }
    return propertyId;
  };

  const saveAmenities = async (values: PropertyWizardValues) => {
    if (!propertyId) return;
    await saveProperty.mutateAsync({ id: propertyId, data: amenitiesUpdatePayload(values, property ?? { amenities: [] }) });
  };

  const allSteps: WizardStep<PropertyWizardValues>[] = [
    {
      id: 'base',
      label: t('propertyWizard.steps.base.label'),
      title: t('propertyWizard.steps.base.title'),
      purpose: t('propertyWizard.steps.base.purpose'),
      schema: baseStepSchema,
      beforeNext: saveBase,
      nextDisabled: blockedByPlan,
      render: ({ form }) => (
        <>
          {blockedByPlan ? <PlanLimitAlert /> : null}
          <BaseStep form={form} storedRoomCount={storedRooms.data?.length ?? 0} />
        </>
      ),
    },
    ...(ownerRequired ? [{
      id: 'owner',
      label: t('propertyWizard.owner.label'),
      title: t('propertyWizard.owner.title'),
      purpose: t('propertyWizard.owner.purpose'),
      beforeNext: verifyOwner,
      render: () => propertyId ? <OwnerStep propertyId={propertyId} canAssign={canAssignOwner} /> : null,
    } satisfies WizardStep<PropertyWizardValues>] : []),
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
      id: 'descriptions',
      label: t('propertyWizard.steps.descriptions.label'),
      title: t('propertyWizard.steps.descriptions.title'),
      purpose: t('propertyWizard.steps.descriptions.purpose'),
      // The Italian and the English headline and description are what a channel takes a listing with: required where the channel manager is
      // connected. Where it is not (the production default) the step stays what the headline and the description of the photos step always
      // were — optional, only their lengths checked, and not asked for again by `WizardShell` at the last button.
      optional: !connectorOn,
      schema: connectorOn ? descriptionsStepSchema : descriptionsLengthsSchema,
      beforeNext: saveDescriptions,
      render: ({ form }) => (propertyId ? <DescriptionsStep form={form} propertyId={propertyId} required={connectorOn} /> : null),
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
    ...(connectorOn
      ? [
          {
            id: 'channels',
            label: t('propertyWizard.steps.channels.label'),
            title: t('propertyWizard.steps.channels.title'),
            purpose: t('propertyWizard.steps.channels.purpose'),
            optional: true,
            nextLabel: t('propertyWizard.channels.next'),
            render: ({ form, goTo }) =>
              propertyId ? <ChannelsStep form={form} propertyId={propertyId} goTo={goTo} onAdopted={(adopted) => adoptServerTexts(form, adopted)} /> : null,
          } satisfies WizardStep<PropertyWizardValues>,
        ]
      : []),
    ...(complianceOn ? [{
      id: 'compliance',
      label: t('propertySetup.compliance.label'),
      title: t('propertySetup.compliance.heading'),
      purpose: t('propertySetup.compliance.purpose'),
      beforeNext: verifyCompliance,
      render: ({ form }: { form: UseFormReturn<PropertyWizardValues> }) => propertyId ? <ComplianceSetupStep propertyId={propertyId} country={form.getValues('country')} /> : null,
    } satisfies WizardStep<PropertyWizardValues>] : []),
    ...(billingOn ? [{
      id: 'billing',
      label: t('propertySetup.billing.label'),
      title: t('propertySetup.billing.heading'),
      purpose: t('propertySetup.billing.purpose'),
      beforeNext: verifyBilling,
      render: () => propertyId ? <BillingSetupStep propertyId={propertyId} /> : null,
    } satisfies WizardStep<PropertyWizardValues>] : []),
    {
      id: 'finish',
      label: t('propertyWizard.steps.finish.label'),
      title: t('propertyWizard.steps.finish.title'),
      purpose: t('propertyWizard.steps.finish.purpose'),
      nextDisabled: stage === 'loading' || (stage === 'ready' && (!tosAccepted || (remindersOpen && !remindersAccepted))),
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
            remindersAccepted={remindersAccepted}
            onRemindersChange={setRemindersAccepted}
          />
        ) : null,
    },
  ];
  const saveByStep: Record<string, (values: PropertyWizardValues) => Promise<void>> = {
    base: saveBase,
    owner: async () => undefined,
    photos: savePhotos,
    amenities: saveAmenities,
    descriptions: saveDescriptions,
    rules: saveRules,
    prices: savePrices,
    // Publishing is its own button; the calendars, the CIN and the documents are saved by theirs, and the switch goes with the last step.
    channels: async () => undefined,
    finish: async () => undefined,
  };

  return (
    <PropertyWizardShell
      id={WIZARD_ID}
      steps={allSteps}
      onlySteps={onlySteps && ownerRequired ? [...onlySteps, 'owner'] : onlySteps}
      defaultValues={defaults}
      initialStepId={initialStepId}
      onStepChange={({ to }) => {
        setSetupFailure(null);
        if (propertyId && user?.id && org?.id) rememberPropertyStep({ userId: user.id, orgId: org.id }, propertyId, to);
      }}
      finishLabel={t(`propertyWizard.last.button.${stage === 'ready' ? 'activate' : stage === 'active' ? 'done' : 'later'}`)}
      finishFailedMessage={setupFailure ?? t('propertyWizard.errors.saveFailed')}
      onFinish={finish}
      draft={propertyId ? false : { accept: (saved) => saved.step === 'base' }}
      onExit={() => navigate(planReturn ?? PROPERTIES_PATH)}
      aboveFooter={
        <SaveAndClose
          save={propertyId ? (stepId, values) => saveByStep[stepId]?.(values) ?? Promise.resolve() : undefined}
          onSaved={(step) => {
            if (propertyId && user?.id && org?.id) rememberPropertyStep({ userId: user.id, orgId: org.id }, propertyId, step);
            toast.success(t(propertyId ? 'propertyWizard.exit.saved' : 'propertyWizard.exit.kept'));
            navigate(planReturn ?? PROPERTIES_PATH);
          }}
        />
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

interface PropertyWizardShellProps extends WizardShellProps<PropertyWizardValues, string | null> {
  onlySteps?: readonly WizardStepId[];
}

function PropertyWizardShell({ onlySteps, steps, ...shell }: PropertyWizardShellProps) {
  const [searchParams] = useSearchParams();
  const named = searchParams.get('step');
  const shown = onlySteps ? steps.filter((step) => step.id === named || (onlySteps as readonly string[]).includes(step.id)) : steps;

  return <WizardShell<PropertyWizardValues, string | null> {...shell} steps={shown} />;
}
