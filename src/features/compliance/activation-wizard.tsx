import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  Info,
  Loader2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Breadcrumb } from '@/components/shared/breadcrumb';
import { ComplianceStatusBadge } from '@/features/compliance/compliance-status-badge';
import {
  useComplianceActivation,
  useCompleteComplianceActivation,
} from '@/features/compliance/use-compliance';
import { getActivationBlockedProblem } from '@/api/compliance.api';
import { useProperty, usePropertyDetail, useUpdateProperty } from '@/queries/use-properties';
import { useUpdatePropertyCin } from '@/queries/use-cin';
import { DocumentUploadDialog } from '@/features/properties/components/document-upload-dialog';
import { IcalSettings } from '@/features/properties/components/ical-settings';
import { TouristTaxStepInfo } from '@/features/compliance/components/tourist-tax-step-info';
import { SafetyChecklistForm } from '@/features/compliance/components/safety-checklist-form';
import { PropertyForm } from '@/features/properties/components/property-form';
import {
  REVIEW_STEP_ID,
  blockerText,
  changedPropertyFields,
  initialStepId,
  knownBlockers,
  propertyFormPayload,
  stepTitle,
  wizardStepIds,
} from '@/features/compliance/activation-wizard-model';
import { CIN_FORMAT_MESSAGE_KEY, isEmptyOrValidCin, normalizeCin } from '@/lib/cin-format';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { getPropertyDocumentTypeLabel } from '@/lib/i18n-labels';
import type {
  ActivationBlocker,
  ComplianceActivationResult,
  ComplianceStepStatus,
  ComplianceWizardStep,
} from '@/types/compliance.types';
import type { CreatePropertyDto, Property } from '@/types';

const STEP_ICON_COLOR = {
  complete: 'text-green-600',
  warning: 'text-amber-500',
  current: 'text-primary',
  pending: 'text-muted-foreground',
} as const;

/** Link to a step of the wizard (`?step=`): a real link, so it can be opened, shared and followed with "back". */
function stepHref(stepId: string) {
  return { search: `?step=${encodeURIComponent(stepId)}` };
}

function useStepTexts(steps: ComplianceWizardStep[]) {
  const { t, i18n } = useTranslation();
  const exists = (key: string) => i18n.exists(key);
  return {
    title: (stepId: string) => stepTitle(stepId, steps, t, exists),
    blocker: (blocker: ActivationBlocker) => blockerText(blocker, steps, t, exists),
  };
}

function StepStatusIcon({ status, current }: { status: ComplianceStepStatus; current: boolean }) {
  const Icon = status === 'complete' ? CheckCircle2 : status === 'warning' ? AlertTriangle : Circle;
  const color =
    status === 'complete'
      ? STEP_ICON_COLOR.complete
      : status === 'warning'
        ? STEP_ICON_COLOR.warning
        : current
          ? STEP_ICON_COLOR.current
          : STEP_ICON_COLOR.pending;
  return <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} aria-hidden="true" />;
}

/** Status of a step of the wizard: from the server, or of the summary (complete when nothing blocks). */
function stepStatus(stepId: string, steps: ComplianceWizardStep[], reviewStatus: ComplianceStepStatus): ComplianceStepStatus {
  if (stepId === REVIEW_STEP_ID) return reviewStatus;
  return steps.find((s) => s.id === stepId)?.status ?? 'pending';
}

/** Progress bar: every step is clickable and shows whether it is complete (A5-18 d). */
function StepIndicator({
  stepIds,
  steps,
  currentStepId,
  reviewStatus,
  onSelect,
}: {
  stepIds: string[];
  steps: ComplianceWizardStep[];
  currentStepId: string;
  reviewStatus: ComplianceStepStatus;
  onSelect: (stepId: string) => void;
}) {
  const { t } = useTranslation();
  const texts = useStepTexts(steps);
  const required = steps.filter((s) => s.blocker);
  const done = required.filter((s) => s.status === 'complete').length;

  return (
    <nav className="space-y-2" aria-label={t('compliance.activation.progress', { done, total: required.length })}>
      <p className="text-sm text-muted-foreground" data-testid="activation-wizard-progress-text">
        {t('compliance.activation.progress', { done, total: required.length })}
      </p>
      <ol className="flex flex-wrap gap-2" data-testid="activation-wizard-progress">
        {stepIds.map((stepId) => {
          const status = stepStatus(stepId, steps, reviewStatus);
          const isCurrent = stepId === currentStepId;
          return (
            <li key={stepId}>
              <button
                type="button"
                data-testid={`activation-step-${stepId}`}
                data-status={status}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onSelect(stepId)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted ${
                  isCurrent ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <StepStatusIcon status={status} current={isCurrent} />
                <span>{texts.title(stepId)}</span>
                <span className="sr-only">{`(${t(`compliance.activation.stepStatus.${status}`)})`}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Blockers translated by code, each with a link to the step that fixes it. */
function BlockerList({
  blockers,
  steps,
  stepIds,
  onNavigate,
}: {
  blockers: ActivationBlocker[];
  steps: ComplianceWizardStep[];
  stepIds: string[];
  onNavigate: (stepId: string) => void;
}) {
  const { t } = useTranslation();
  const texts = useStepTexts(steps);
  return (
    <ul className="mt-2 space-y-2" data-testid="activation-blocker-list">
      {blockers.map((blocker, index) => (
        <li key={`${blocker.step}-${blocker.code}-${index}`} data-code={blocker.code} className="flex flex-col gap-0.5">
          <span>{texts.blocker(blocker)}</span>
          {stepIds.includes(blocker.step) && blocker.step !== REVIEW_STEP_ID && (
            <Link
              to={stepHref(blocker.step)}
              onClick={() => onNavigate(blocker.step)}
              className="inline-flex items-center gap-1 text-primary hover:underline"
              data-testid={`activation-blocker-link-${blocker.step}`}
            >
              {t('compliance.activation.goToStep', { step: texts.title(blocker.step) })}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/** What keeps a step incomplete, translated by code (the safety step shows its own list in the form). */
function StepBlockers({ step }: { step: ComplianceWizardStep }) {
  const { t } = useTranslation();
  const texts = useStepTexts([step]);
  if (step.status === 'complete') return null;
  if (step.blockers && step.blockers.length > 0) {
    return (
      <ul className="space-y-1 text-sm text-amber-800" data-testid={`activation-step-blockers-${step.id}`}>
        {step.blockers.map((b, index) => (
          <li key={`${b.code}-${index}`} className="flex items-start gap-2" data-code={b.code}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            <span>{texts.blocker(b)}</span>
          </li>
        ))}
      </ul>
    );
  }
  // Only the iCal step warns without blockers; a step unknown here shows the text of the server.
  const hint = step.id === 'ical' ? t('compliance.activation.stepHint.ical') : step.message;
  if (!hint) return null;
  return (
    <p className="flex items-start gap-2 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
      <span>{hint}</span>
    </p>
  );
}

/** A step kept mounted while hidden: what the host typed survives going back and forth (A5-18). */
function StepPanel({ active, stepId, children }: { active: boolean; stepId: string; children: ReactNode }) {
  return (
    <div hidden={!active} data-testid={`activation-panel-${stepId}`}>
      {children}
    </div>
  );
}

export function PropertyActivationWizard() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const propertyId = id!;

  const propertyQuery = useProperty(propertyId, { fresh: true });
  const activationQuery = useComplianceActivation(propertyId);

  const failed = propertyQuery.isError || activationQuery.isError;
  const fetching = propertyQuery.isFetching || activationQuery.isFetching;
  // The steps are always read again from the server before the wizard starts (never a stale cache). Once started,
  // the wizard stays mounted: a failed refresh never drops what the host typed in the steps.
  const ready =
    !!propertyQuery.data && !!activationQuery.data && activationQuery.isFetchedAfterMount && !activationQuery.isError;
  const [started, setStarted] = useState(false);
  if (ready && !started) setStarted(true);

  if (!started && failed && !fetching) {
    const error = propertyQuery.error ?? activationQuery.error;
    if (getHttpStatus(error) === 404) {
      return (
        <AppShell>
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">{t('compliance.activation.notFound')}</h2>
          </div>
        </AppShell>
      );
    }
    return (
      <AppShell>
        <div className="mx-auto max-w-md space-y-4 py-12 text-center" role="alert" data-testid="activation-load-error">
          <p className="text-sm text-destructive">
            {getProblemMessage(error, t) ?? t('compliance.activation.loadFailed')}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              if (propertyQuery.isError) void propertyQuery.refetch();
              if (activationQuery.isError) void activationQuery.refetch();
            }}
          >
            {t('compliance.activation.retry')}
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!(ready || started) || !propertyQuery.data || !activationQuery.data) {
    return <LoadingScreen message={t('compliance.activation.loading')} />;
  }

  return (
    <ActivationWizardContent
      propertyId={propertyId}
      property={propertyQuery.data}
      activation={activationQuery.data}
      refreshFailed={activationQuery.isError && !activationQuery.isFetching}
      refetchActivation={() => void activationQuery.refetch()}
    />
  );
}

function ActivationWizardContent({
  propertyId,
  property,
  activation,
  refreshFailed,
  refetchActivation,
}: {
  propertyId: string;
  property: Property;
  activation: ComplianceActivationResult;
  /** The last refresh of the steps failed: the wizard shows the previous state and offers a retry. */
  refreshFailed: boolean;
  refetchActivation: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const steps = activation.steps;
  const texts = useStepTexts(steps);
  const stepIds = wizardStepIds(steps);

  const { data: detail, isLoading: documentsLoading, isError: documentsError, refetch: refetchDetail } =
    usePropertyDetail(propertyId, { fresh: true });
  const completeActivation = useCompleteComplianceActivation(propertyId);
  const updateProperty = useUpdateProperty();
  const updateCin = useUpdatePropertyCin();

  // Opens on the first blocking step still open, or on the summary when everything is complete (from the server).
  const [initialStep] = useState(() => initialStepId(steps));
  const requestedStep = searchParams.get('step');
  const currentStepId =
    requestedStep && stepIds.includes(requestedStep)
      ? requestedStep
      : stepIds.includes(initialStep)
        ? initialStep
        : stepIds[0];
  const currentIdx = stepIds.indexOf(currentStepId);
  const currentStep = steps.find((s) => s.id === currentStepId);

  // Base data: the form starts from the stored property and sends only what the host changed.
  const [baseSnapshot, setBaseSnapshot] = useState(property);
  const [baseFormVersion, setBaseFormVersion] = useState(0);
  const [baseDirty, setBaseDirty] = useState(false);
  if (!baseDirty && baseSnapshot !== property) {
    // Newer server data and nothing typed: show it (e.g. the CIN saved in its step).
    setBaseSnapshot(property);
    setBaseFormVersion((v) => v + 1);
  }

  // CIN: null = not edited, the input shows the stored CIN.
  const [cinDraft, setCinDraft] = useState<string | null>(null);
  const [cinError, setCinError] = useState<string | null>(null);
  const cinChanged = cinDraft !== null && normalizeCin(cinDraft) !== normalizeCin(property.cinCode);

  const [tosAccepted, setTosAccepted] = useState(false);
  const [blockedBlockers, setBlockedBlockers] = useState<ActivationBlocker[] | null>(null);

  const openBlockers = knownBlockers(steps);
  const reviewStatus: ComplianceStepStatus = openBlockers.length === 0 ? 'complete' : 'pending';
  const canComplete = openBlockers.length === 0 && tosAccepted && !completeActivation.isPending;

  const onNavigate = () => {
    // The 409 list refers to the last attempt: after a step is opened the summary shows the fresh server state.
    setBlockedBlockers(null);
    refetchActivation();
  };

  const goTo = (stepId: string) => {
    onNavigate();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('step', stepId);
      return next;
    });
  };

  const goNext = () => {
    const next = stepIds[currentIdx + 1];
    if (next) goTo(next);
  };

  const goBack = () => {
    const previous = stepIds[currentIdx - 1];
    if (previous) goTo(previous);
  };

  const handleBaseDataSave = async (data: CreatePropertyDto) => {
    const changes = changedPropertyFields(propertyFormPayload(baseSnapshot), data);
    if (Object.keys(changes).length > 0) {
      try {
        await updateProperty.mutateAsync({ id: propertyId, data: changes });
      } catch {
        return; // Toast from the mutation (getProblemMessage); the form keeps what the host typed.
      }
      setBaseDirty(false);
    }
    goNext();
  };

  const discardBaseChanges = () => {
    setBaseDirty(false);
    setBaseSnapshot(property);
    setBaseFormVersion((v) => v + 1);
  };

  const handleCinSave = async () => {
    setCinError(null);
    if (!cinChanged) {
      goNext();
      return;
    }
    if (!isEmptyOrValidCin(cinDraft)) {
      setCinError(t(CIN_FORMAT_MESSAGE_KEY));
      return;
    }
    const normalized = normalizeCin(cinDraft);
    try {
      await updateCin.mutateAsync({ propertyId, cinCode: normalized });
    } catch {
      return; // Toast from the mutation (getProblemMessage), the input keeps the value.
    }
    setCinDraft(normalized ?? '');
    goNext();
  };

  const handleComplete = async () => {
    setBlockedBlockers(null);
    try {
      // Only the terms: the checklist, the CIN and the documents are saved in their own steps (never overwritten here).
      const result = await completeActivation.mutateAsync({ tosAccepted: true });
      if (result.complianceStatus === 'Active') {
        navigate(`/app/short-rent/properties/${propertyId}`);
        return;
      }
      refetchActivation();
    } catch (error) {
      const blocked = getActivationBlockedProblem(error);
      if (blocked) {
        setBlockedBlockers(
          blocked.blockers.length > 0
            ? blocked.blockers
            : blocked.incompleteBlockers.map((step) => ({ step, code: '', message: '' })),
        );
      }
      // Other errors: toast from the mutation with getProblemMessage.
      refetchActivation();
    }
  };

  const unsavedSteps = [baseDirty ? 'base-data' : null, cinChanged ? 'cin' : null].filter(
    (s): s is string => s !== null,
  );
  const cinGuidanceUrl = steps.find((s) => s.id === 'cin')?.linkUrl;
  const touristTax = steps.find((s) => s.id === 'tourist-tax')?.touristTax;
  const documents = detail?.documents ?? [];

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto" data-testid="property-activation-wizard">
        <Breadcrumb />
        <PageHeader
          title={t('compliance.activation.title', { name: property.name })}
          description={t('compliance.activation.description')}
          action={<ComplianceStatusBadge status={activation.complianceStatus} />}
        />

        {refreshFailed && (
          <div
            className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
            role="alert"
            data-testid="activation-refresh-error"
          >
            <span>{t('compliance.activation.refreshFailed')}</span>
            <Button variant="outline" size="sm" onClick={refetchActivation}>
              {t('compliance.activation.retry')}
            </Button>
          </div>
        )}

        <StepIndicator
          stepIds={stepIds}
          steps={steps}
          currentStepId={currentStepId}
          reviewStatus={reviewStatus}
          onSelect={goTo}
        />

        <Card>
          <CardHeader>
            <CardTitle>{texts.title(currentStepId)}</CardTitle>
            {currentStep && currentStep.id !== 'safety' && currentStep.id !== 'tourist-tax' && (
              <StepBlockers step={currentStep} />
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <StepPanel active={currentStepId === 'base-data'} stepId="base-data">
              <PropertyForm
                key={baseFormVersion}
                property={baseSnapshot}
                onSubmit={handleBaseDataSave}
                onCancel={discardBaseChanges}
                onDirtyChange={setBaseDirty}
                isLoading={updateProperty.isPending}
              />
            </StepPanel>

            <StepPanel active={currentStepId === 'cin'} stepId="cin">
              <div className="space-y-4 max-w-md">
                <div className="space-y-1">
                  <Label htmlFor="activation-cin">{t('compliance.activation.cinLabel')}</Label>
                  <Input
                    id="activation-cin"
                    data-testid="activation-cin-input"
                    value={cinDraft ?? property.cinCode ?? ''}
                    onChange={(e) => {
                      setCinDraft(e.target.value);
                      setCinError(null);
                    }}
                    placeholder={t('property.form.cin.placeholder')}
                    aria-invalid={cinError ? true : undefined}
                    aria-describedby={cinError ? 'activation-cin-error' : undefined}
                  />
                  {cinError && (
                    <p id="activation-cin-error" className="text-sm text-destructive" role="alert">
                      {cinError}
                    </p>
                  )}
                </div>
                {cinGuidanceUrl && (
                  <a
                    href={cinGuidanceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    data-testid="activation-cin-guidance"
                  >
                    {t('compliance.activation.cinGuidance')}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}
                <div>
                  <Button onClick={() => void handleCinSave()} disabled={updateCin.isPending}>
                    {updateCin.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('compliance.activation.saveAndContinue')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </StepPanel>

            <StepPanel active={currentStepId === 'documents'} stepId="documents">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t('compliance.activation.documentsHint')}</p>
                <DocumentUploadDialog propertyId={propertyId} />
                {documentsLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('compliance.activation.documentsLoading')}
                  </p>
                ) : documentsError ? (
                  <div className="space-y-2" role="alert" data-testid="activation-documents-error">
                    <p className="text-sm text-destructive">{t('compliance.activation.documentsLoadFailed')}</p>
                    <Button variant="outline" size="sm" onClick={() => void refetchDetail()}>
                      {t('compliance.activation.retry')}
                    </Button>
                  </div>
                ) : documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('compliance.activation.documentsEmpty')}</p>
                ) : (
                  <ul className="text-sm space-y-1" data-testid="activation-documents">
                    {documents.map((doc) => (
                      <li key={doc.id} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                        <span className="font-medium">{getPropertyDocumentTypeLabel(doc.documentType, t)}</span>
                        <span className="text-muted-foreground">{doc.fileName}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </StepPanel>

            <StepPanel active={currentStepId === 'safety'} stepId="safety">
              <SafetyChecklistForm propertyId={propertyId} onSaved={refetchActivation} />
            </StepPanel>

            <StepPanel active={currentStepId === 'tourist-tax'} stepId="tourist-tax">
              <TouristTaxStepInfo touristTax={touristTax} city={property.city} />
            </StepPanel>

            <StepPanel active={currentStepId === 'ical'} stepId="ical">
              <IcalSettings propertyId={propertyId} />
            </StepPanel>

            {currentStepId === REVIEW_STEP_ID && (
              <div className="space-y-6" data-testid="activation-review">
                <p className="text-sm text-muted-foreground">{t('compliance.activation.review.intro')}</p>

                {activation.complianceStatus === 'Active' && (
                  <p className="flex items-start gap-2 text-sm text-green-700" data-testid="activation-review-active">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('compliance.activation.review.active')}
                  </p>
                )}
                {activation.complianceStatus === 'Suspended' && (
                  <p
                    className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
                    data-testid="activation-review-suspended"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                    {t('compliance.activation.review.suspended')}
                  </p>
                )}

                <section className="space-y-2" aria-labelledby="activation-review-steps">
                  <h3 id="activation-review-steps" className="font-semibold">
                    {t('compliance.activation.review.stepsTitle')}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {steps.map((step) => (
                      <li key={step.id} className="flex items-center gap-2" data-testid={`activation-review-step-${step.id}`}>
                        <StepStatusIcon status={step.status} current={false} />
                        <Link to={stepHref(step.id)} onClick={onNavigate} className="hover:underline">
                          {texts.title(step.id)}
                        </Link>
                        <span className="text-muted-foreground">
                          {t(`compliance.activation.stepStatus.${step.status}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                {blockedBlockers ? (
                  <div
                    className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
                    role="alert"
                    data-testid="activation-blocked"
                  >
                    <p className="font-medium">{t('compliance.activation.blockerList.blockedTitle')}</p>
                    <BlockerList blockers={blockedBlockers} steps={steps} stepIds={stepIds} onNavigate={onNavigate} />
                  </div>
                ) : openBlockers.length > 0 ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" data-testid="activation-known-blockers">
                    <p className="font-medium">{t('compliance.activation.blockerList.knownTitle')}</p>
                    <BlockerList blockers={openBlockers} steps={steps} stepIds={stepIds} onNavigate={onNavigate} />
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-green-700" data-testid="activation-no-blockers">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {t('compliance.activation.blockerList.none')}
                  </p>
                )}

                {unsavedSteps.map((stepId) => (
                  <p key={stepId} className="flex items-start gap-2 text-sm text-amber-800" data-testid={`activation-unsaved-${stepId}`}>
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <Link to={stepHref(stepId)} onClick={onNavigate} className="hover:underline">
                      {t('compliance.activation.review.unsaved', { step: texts.title(stepId) })}
                    </Link>
                  </p>
                ))}

                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="activation-tos"
                      className="mt-0.5"
                      checked={tosAccepted}
                      onCheckedChange={(checked) => setTosAccepted(checked === true)}
                    />
                    <Label htmlFor="activation-tos">{t('compliance.activation.tosAccept')}</Label>
                  </div>
                  {openBlockers.length > 0 ? (
                    <p className="text-xs text-muted-foreground">{t('compliance.activation.review.blockersHint')}</p>
                  ) : (
                    !tosAccepted && (
                      <p className="text-xs text-muted-foreground">{t('compliance.activation.review.tosHint')}</p>
                    )
                  )}
                  <Button
                    data-testid="activation-complete-button"
                    onClick={() => void handleComplete()}
                    disabled={!canComplete}
                  >
                    {completeActivation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('compliance.activation.complete')}
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" onClick={goBack} disabled={currentIdx <= 0} data-testid="activation-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('compliance.activation.back')}
          </Button>
          {currentIdx < stepIds.length - 1 && (
            <Button variant="outline" onClick={goNext} data-testid="activation-next">
              {t('compliance.activation.next')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        <Button variant="ghost" asChild>
          <Link to={`/app/short-rent/properties/${propertyId}/edit`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('compliance.activation.backToEdit')}
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
