import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, Home } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { isOpenBlocker } from '@/features/compliance/activation-wizard-model';
import { useComplianceActivation } from '@/features/compliance/use-compliance';
import { useProperty } from '@/queries/use-properties';
import { PROPERTIES_PATH, propertyActivationPath } from '../properties-paths';

interface PropertyWizardDoneProps {
  propertyId: string | null;
}

/** The blocking steps of the activation, said as what the host still has to do (the wording of the wizard, not of the law). */
const OPEN_STEP_TEXT: Readonly<Record<string, string>> = {
  'base-data': 'propertyWizard.done.open.base-data',
  cin: 'propertyWizard.done.open.cin',
  documents: 'propertyWizard.done.open.documents',
  safety: 'propertyWizard.done.open.safety',
};

/**
 * «Cosa succede ora» (SR-07b). The property exists on the server and is «Da completare» until it is activated: the points that are
 * still open are the **server's** (`compliance/activation`), never worked out here, and nothing is promised that it did not say.
 * It reads the property itself, so the screen makes sense when it is opened again (a reload).
 */
export function PropertyWizardDone({ propertyId }: PropertyWizardDoneProps) {
  const { t } = useTranslation();
  const property = useProperty(propertyId ?? '');
  const activation = useComplianceActivation(propertyId ?? '');

  if (!propertyId) return <Navigate to={PROPERTIES_PATH} replace />;
  if (property.isError) return <Navigate to={PROPERTIES_PATH} replace />;
  if (!property.data) return null;

  const open = (activation.data?.steps ?? []).filter(isOpenBlocker);
  const known = open.filter((step) => OPEN_STEP_TEXT[step.id]);
  const name = property.data.name;

  return (
    <WizardDone
      title={t('propertyWizard.done.title', { name })}
      description={t('propertyWizard.done.description')}
      lead={known.length > 0 ? t('propertyWizard.done.leadOpen') : t('propertyWizard.done.leadReady')}
      whatNext={[
        { icon: Home, text: t('propertyWizard.done.inList') },
        ...known.map((step) => ({ icon: CircleAlert, text: t(OPEN_STEP_TEXT[step.id]) })),
        ...(activation.data && known.length === 0 ? [{ icon: CircleCheck, text: t('propertyWizard.done.readyToActivate') }] : []),
      ]}
      primary={{ label: t('propertyWizard.done.complete'), to: propertyActivationPath(propertyId) }}
      secondary={{ label: t('propertyWizard.done.toList'), to: PROPERTIES_PATH }}
    />
  );
}
