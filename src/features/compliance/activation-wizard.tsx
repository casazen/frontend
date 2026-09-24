import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useProperty, usePropertyDetail, useUpdateProperty } from '@/queries/use-properties';
import { useUpdatePropertyCin } from '@/queries/use-cin';
import { DocumentUploadDialog } from '@/features/properties/components/document-upload-dialog';
import { IcalSettings } from '@/features/properties/components/ical-settings';
import { TouristTaxStepInfo } from '@/features/compliance/components/tourist-tax-step-info';
import { SafetyChecklistForm } from '@/features/compliance/components/safety-checklist-form';
import type { ComplianceWizardStep } from '@/types/compliance.types';
import type { CreatePropertyDto } from '@/types';
import { PropertyForm } from '@/features/properties/components/property-form';

const STEP_ORDER = ['base-data', 'cin', 'documents', 'safety', 'tourist-tax', 'ical'] as const;

const STEP_ICON_COLOR = {
  complete: 'text-green-600',
  warning: 'text-amber-500',
  current: 'text-primary',
  pending: 'text-muted-foreground',
} as const;

function stepIndex(stepId: string): number {
  return STEP_ORDER.indexOf(stepId as (typeof STEP_ORDER)[number]);
}

/** Step title translated by step id; falls back to the label sent by the API for unknown steps. */
function useStepLabel() {
  const { t, i18n } = useTranslation();
  return (step: ComplianceWizardStep) => {
    const key = `compliance.activation.steps.${step.id}`;
    return i18n.exists(key) ? t(key) : step.label;
  };
}

function StepIndicator({ steps, currentStepId }: { steps: ComplianceWizardStep[]; currentStepId: string }) {
  const stepLabel = useStepLabel();
  const sorted = [...steps].sort((a, b) => stepIndex(a.id) - stepIndex(b.id));

  return (
    <div className="flex flex-wrap gap-2" data-testid="activation-wizard-progress">
      {sorted.map((step) => {
        const isCurrent = step.id === currentStepId;
        const Icon =
          step.status === 'complete'
            ? CheckCircle2
            : step.status === 'warning'
              ? AlertTriangle
              : Circle;
        const color =
          step.status === 'complete'
            ? STEP_ICON_COLOR.complete
            : step.status === 'warning'
              ? STEP_ICON_COLOR.warning
              : isCurrent
                ? STEP_ICON_COLOR.current
                : STEP_ICON_COLOR.pending;

        return (
          <button
            key={step.id}
            type="button"
            data-testid={`activation-step-${step.id}`}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              isCurrent ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${color}`} />
            <span>{stepLabel(step)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PropertyActivationWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const stepLabel = useStepLabel();
  const propertyId = id!;

  const { data: property, isLoading: propertyLoading } = useProperty(propertyId);
  const { data: detail } = usePropertyDetail(propertyId);
  const { data: activation, isLoading: activationLoading, refetch } = useComplianceActivation(propertyId);
  const completeActivation = useCompleteComplianceActivation(propertyId);
  const updateProperty = useUpdateProperty();
  const updateCin = useUpdatePropertyCin();

  const [currentStepId, setCurrentStepId] = useState<string>('base-data');
  const [cinCode, setCinCode] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);

  if (propertyLoading || activationLoading) {
    return <LoadingScreen message={t('compliance.activation.loading')} />;
  }

  if (!property || !activation) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">{t('compliance.activation.notFound')}</h2>
        </div>
      </AppShell>
    );
  }

  const steps = activation.steps;
  const currentStep = steps.find((s) => s.id === currentStepId) ?? steps[0];
  // The tourist tax step shows its own translated warning and rate (TouristTaxStepInfo).
  const headerMessage =
    currentStep.id === 'tourist-tax' && currentStep.touristTax ? null : currentStep.message;
  const currentIdx = stepIndex(currentStepId);
  const nextStepId = STEP_ORDER[currentIdx + 1];

  const goNext = () => {
    if (nextStepId) setCurrentStepId(nextStepId);
  };

  const handleBaseDataSave = async (data: CreatePropertyDto) => {
    await updateProperty.mutateAsync({ id: propertyId, data });
    await refetch();
    goNext();
  };

  const handleCinSave = async () => {
    await updateCin.mutateAsync({ propertyId, cinCode: cinCode || null });
    await refetch();
    goNext();
  };

  const handleComplete = async () => {
    // The safety checklist is saved in its own step (CO-07): completing never overwrites it.
    const result = await completeActivation.mutateAsync({ tosAccepted });
    await refetch();
    if (result.complianceStatus === 'Active') {
      navigate(`/app/short-rent/properties/${propertyId}`);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto" data-testid="property-activation-wizard">
        <Breadcrumb />
        <PageHeader
          title={t('compliance.activation.title', { name: property.name })}
          description={t('compliance.activation.description')}
          action={<ComplianceStatusBadge status={activation.complianceStatus} />}
        />

        <StepIndicator steps={steps} currentStepId={currentStepId} />

        <Card>
          <CardHeader>
            <CardTitle>{stepLabel(currentStep)}</CardTitle>
            {headerMessage && (
              <CardDescription className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <span>{headerMessage}</span>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStepId === 'base-data' && (
              <PropertyForm
                property={property}
                onSubmit={handleBaseDataSave}
                isLoading={updateProperty.isPending}
              />
            )}

            {currentStepId === 'cin' && (
              <div className="space-y-4 max-w-md">
                <div>
                  <Label htmlFor="activation-cin">{t('compliance.activation.cinLabel')}</Label>
                  <Input
                    id="activation-cin"
                    data-testid="activation-cin-input"
                    value={cinCode || property.cinCode || ''}
                    onChange={(e) => setCinCode(e.target.value)}
                    placeholder={t('property.form.cin.placeholder')}
                  />
                </div>
                {currentStep.linkUrl && (
                  <a
                    href={currentStep.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    data-testid="activation-cin-guidance"
                  >
                    {t('compliance.activation.cinGuidance')}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <Button onClick={() => void handleCinSave()} disabled={updateCin.isPending}>
                  {updateCin.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('compliance.activation.saveAndContinue')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {currentStepId === 'documents' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t('compliance.activation.documentsHint')}</p>
                <DocumentUploadDialog propertyId={propertyId} />
                {detail?.documents && detail.documents.length > 0 && (
                  <ul className="text-sm space-y-1">
                    {detail.documents.map((doc) => (
                      <li key={doc.id} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        {doc.fileName}
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="outline" onClick={goNext}>
                  {t('compliance.activation.continue')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {currentStepId === 'safety' && (
              <div className="space-y-4">
                <SafetyChecklistForm propertyId={propertyId} onSaved={() => void refetch()} />
                <Button variant="outline" onClick={goNext}>
                  {t('compliance.activation.continue')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {currentStepId === 'tourist-tax' && (
              <div className="space-y-4">
                <TouristTaxStepInfo touristTax={currentStep.touristTax} city={property.city} />
                <Button variant="outline" onClick={goNext}>
                  {t('compliance.activation.continue')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {currentStepId === 'ical' && (
              <div className="space-y-4">
                <IcalSettings propertyId={propertyId} />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="activation-tos"
                    checked={tosAccepted}
                    onCheckedChange={(checked) => setTosAccepted(checked === true)}
                  />
                  <Label htmlFor="activation-tos">{t('compliance.activation.tosAccept')}</Label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild>
            <Link to={`/app/short-rent/properties/${propertyId}/edit`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('compliance.activation.backToEdit')}
            </Link>
          </Button>
          <Button
            data-testid="activation-complete-button"
            onClick={() => void handleComplete()}
            disabled={completeActivation.isPending}
          >
            {completeActivation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('compliance.activation.complete')}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
