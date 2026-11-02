import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, EyeOff, Home } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { Button } from '@/components/ui/button';
import { isOpenBlocker } from '@/features/compliance/activation-wizard-model';
import { useComplianceActivation } from '@/features/compliance/use-compliance';
import { useProperty } from '@/queries/use-properties';
import { fixTargetFor } from './finish/finish-model';
import { PROPERTIES_PATH, PROPERTY_CREATE_PATH, propertyCalendarPath, propertyWizardPath } from '../properties-paths';

interface PropertyWizardDoneProps {
  propertyId: string | null;
}

/** The blocking steps of the activation, said as what the host still has to do (the wording of the wizard, not of the law). */
const OPEN_STEPS = ['base-data', 'cin', 'documents', 'safety'] as const;

/**
 * «Cosa succede ora» (SR-07c). Everything it says is read from the server again — the property and its activation — so it is true
 * after a reload too, and it promises nothing the server did not do:
 * - active and shown on the site: it is ready and guests can book from the site;
 * - active but hidden by the host: it is ready and does not appear on the site (with the way to show it);
 * - otherwise: what is still missing, each with the button that goes where it is fixed. «Da completare» until then.
 */
export function PropertyWizardDone({ propertyId }: PropertyWizardDoneProps) {
  const { t } = useTranslation();
  const property = useProperty(propertyId ?? '', { fresh: true });
  const activation = useComplianceActivation(propertyId ?? '');

  if (!propertyId) return <Navigate to={PROPERTIES_PATH} replace />;
  if (property.isError) return <Navigate to={PROPERTIES_PATH} replace />;
  if (!property.data || !activation.data) return null;

  const name = property.data.name;
  // The wizard again with an empty address: the page starts a new one (it does not go on with the one that has just ended).
  const another = { label: t('propertyWizard.done.another'), to: PROPERTY_CREATE_PATH };

  if (activation.data.complianceStatus === 'Active') {
    const shown = property.data.publishedOnSite !== false;
    return (
      <WizardDone
        title={t(shown ? 'propertyWizard.done.readyTitle' : 'propertyWizard.done.hiddenTitle', { name })}
        description={t(shown ? 'propertyWizard.done.readyDescription' : 'propertyWizard.done.hiddenDescription')}
        whatNext={[
          { icon: CircleCheck, text: t('propertyWizard.done.active') },
          shown ? { icon: Home, text: t('propertyWizard.done.inList') } : { icon: EyeOff, text: t('propertyWizard.done.hiddenHow') },
        ]}
        primary={{ label: t('propertyWizard.done.calendar'), to: propertyCalendarPath(propertyId) }}
        secondary={another}
      >
        {shown ? null : (
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link to={propertyWizardPath(propertyId, 'finish')} data-testid="property-wizard-show-on-site-link">
                {t('propertyWizard.done.show')}
              </Link>
            </Button>
          </div>
        )}
      </WizardDone>
    );
  }

  const open = activation.data.steps.filter((step) => isOpenBlocker(step) && (OPEN_STEPS as readonly string[]).includes(step.id));
  const fixLink = (stepId: string) => {
    const target = fixTargetFor(stepId, property.data);
    return propertyWizardPath(propertyId, target?.kind === 'step' ? target.step : 'finish');
  };

  return (
    <WizardDone
      title={t('propertyWizard.done.title', { name })}
      description={t('propertyWizard.done.description')}
      lead={open.length > 0 ? t('propertyWizard.done.leadOpen') : t('propertyWizard.done.leadReady')}
      whatNext={[
        { icon: Home, text: t('propertyWizard.done.inList') },
        ...open.map((step) => ({ icon: CircleAlert, text: t(`propertyWizard.done.open.${step.id}`) })),
        ...(open.length === 0 ? [{ icon: CircleCheck, text: t('propertyWizard.done.readyToActivate') }] : []),
      ]}
      // The step is named: this screen is the end of the same wizard, which keeps its answers and goes straight to what is missing.
      primary={{ label: t('propertyWizard.done.complete'), to: open[0] ? fixLink(open[0].id) : propertyWizardPath(propertyId, 'finish') }}
      secondary={{ label: t('propertyWizard.done.toList'), to: PROPERTIES_PATH }}
    >
      {open.length > 0 ? (
        <ul className="flex flex-wrap justify-center gap-2" aria-label={t('propertyWizard.done.fixLabel')} data-testid="property-wizard-done-fixes">
          {open.map((step) => (
            <li key={step.id}>
              <Button asChild variant="outline" size="sm">
                <Link to={fixLink(step.id)} data-testid={`property-wizard-done-fix-${step.id}`}>
                  {t(`propertyWizard.done.fix.${step.id}`)}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </WizardDone>
  );
}
