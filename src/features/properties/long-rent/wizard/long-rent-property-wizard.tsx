import { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { getProblemMessage } from '@/lib/api-errors';
import { isPlanLimitError } from '@/lib/entitlement-error';
import { prepareDocument } from '@/lib/document-pdf';
import { ME_QUERY_KEY } from '@/lib/onboarding-gate';
import { useCreateProperty, useUpdatePropertyCadastral, useUploadPropertyDocument } from '@/queries/use-properties';
import type { Property } from '@/types';
import { isDuplicateAddressError } from '../../property-errors';
import { LONG_RENT_PROPERTIES_PATH } from '../paths';
import { LongRentPropertyDone } from './long-rent-property-done';
import {
  APE_MAX_BYTES,
  LONG_RENT_PROPERTY_STEP_SCHEMAS,
  LONG_RENT_PROPERTY_WIZARD_DEFAULTS,
  LONG_RENT_PROPERTY_WIZARD_DRAFT_EXCLUDE,
  LONG_RENT_PROPERTY_WIZARD_ID,
  hasApeSelection,
  isCadastralComplete,
  toCadastralPayload,
  toCreatePayload,
  type LongRentPropertyWizardResult,
  type LongRentPropertyWizardValues,
} from './long-rent-property-wizard-model';
import { AddressStep, ApeStep, CadastralStep, ReviewStep } from './long-rent-property-wizard-steps';

interface LongRentPropertyWizardProps {
  /** The server (or the profile) says the plan has no room for another property: the page swaps the wizard for the plan notice. */
  onPlanLimit: () => void;
  /** "Annulla" on the first step: out of the flow. */
  onExit: () => void;
}

/**
 * The wizard "Aggiungi immobile" of Affitti lunghi (LR-07c), on `WizardShell`: address, cadastral data, APE and a summary, then
 * "Cosa succede ora". It is its own wizard, not the one of the short-term area: it takes only fields the long-term model has and asks
 * nothing about nights, guests or rates. The property is created by the last button, always `Long`; the cadastral data and the APE are
 * saved after it and never undo it: whatever fails is told on the last screen with the way to do it from the sheet of the property.
 */
export function LongRentPropertyWizard({ onPlanLimit, onExit }: LongRentPropertyWizardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const createProperty = useCreateProperty('Long');
  const saveCadastral = useUpdatePropertyCadastral();
  const uploadDocument = useUploadPropertyDocument();
  // What to say when the last button fails with an error that has no words of its own (a duplicate address, for one).
  const [failureMessage, setFailureMessage] = useState<string | undefined>(undefined);
  // The APE is being read: the server takes up to two minutes over a photographed certificate, and the button alone does not say so.
  const [reading, setReading] = useState(false);
  // The file made of the pages chosen, when the APE step already made it (a photo is turned into a PDF there, once).
  const prepared = useRef<{ selection: unknown; file: File } | null>(null);

  const apeFile = async (values: LongRentPropertyWizardValues): Promise<File> => {
    if (prepared.current?.selection === values.ape) return prepared.current.file;
    const file = await prepareDocument(values.ape, APE_MAX_BYTES);
    prepared.current = { selection: values.ape, file };
    return file;
  };

  const steps: WizardStep<LongRentPropertyWizardValues>[] = [
    {
      id: 'address',
      label: t('longRentProperties.wizard.steps.address.label'),
      title: t('longRentProperties.wizard.steps.address.title'),
      purpose: t('longRentProperties.wizard.steps.address.purpose'),
      schema: LONG_RENT_PROPERTY_STEP_SCHEMAS.address,
      render: () => <AddressStep />,
    },
    {
      id: 'cadastral',
      label: t('longRentProperties.wizard.steps.cadastral.label'),
      title: t('longRentProperties.wizard.steps.cadastral.title'),
      purpose: t('longRentProperties.wizard.steps.cadastral.purpose'),
      optional: true,
      schema: LONG_RENT_PROPERTY_STEP_SCHEMAS.cadastral,
      render: () => <CadastralStep />,
    },
    {
      id: 'ape',
      label: t('longRentProperties.wizard.steps.ape.label'),
      title: t('longRentProperties.wizard.steps.ape.title'),
      purpose: t('longRentProperties.wizard.steps.ape.purpose'),
      optional: true,
      schema: LONG_RENT_PROPERTY_STEP_SCHEMAS.ape,
      // A photo is turned into a PDF here, so a file the browser cannot make stops the step, not the last button.
      beforeNext: async (values) => {
        if (hasApeSelection(values)) await apeFile(values);
      },
      render: () => <ApeStep />,
    },
    {
      id: 'review',
      label: t('longRentProperties.wizard.steps.review.label'),
      title: t('longRentProperties.wizard.steps.review.title'),
      purpose: t('longRentProperties.wizard.steps.review.purpose'),
      render: () => <ReviewStep />,
    },
  ];

  const finish = async (values: LongRentPropertyWizardValues): Promise<LongRentPropertyWizardResult> => {
    setFailureMessage(undefined);

    let property: Property;
    try {
      property = await createProperty.mutateAsync(toCreatePayload(values));
    } catch (error) {
      if (isPlanLimitError(error)) onPlanLimit();
      else if (isDuplicateAddressError(error)) {
        setFailureMessage(t('longRentProperties.wizard.duplicate'));
        // Not the error of the request: its words are the server's, this one says where to fix it.
        throw new Error('duplicate_property_address');
      }
      throw error;
    }
    // The profile carries `hasProperties`: refresh it before leaving, or the guard would send the host back to the first property.
    await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });

    // From here the property exists: nothing below may throw out of this function, or the wizard would ask to create it again.
    let cadastral: LongRentPropertyWizardResult['cadastral'] = 'none';
    const cadastralData = toCadastralPayload(values);
    if (cadastralData) {
      try {
        await saveCadastral.mutateAsync({ propertyId: property.id, data: cadastralData });
        cadastral = 'saved';
      } catch {
        cadastral = 'failed';
      }
    }

    let ape: LongRentPropertyWizardResult['ape'] = { status: 'none' };
    if (hasApeSelection(values)) {
      setReading(true);
      try {
        const file = await apeFile(values);
        const document = await uploadDocument.mutateAsync({ propertyId: property.id, file, documentType: 'Ape' });
        ape = { status: 'uploaded', document };
      } catch (error) {
        const reason =
          error instanceof Error && error.message.startsWith('documentPages.') ? t(error.message) : (getProblemMessage(error, t) ?? '');
        ape = { status: 'failed', reason };
      } finally {
        setReading(false);
      }
    }

    // The last screen tells all of it: the toasts of each request would say it again.
    toast.dismiss();
    return { property, cadastral, cadastralComplete: isCadastralComplete(values), ape };
  };

  return (
    <WizardShell<LongRentPropertyWizardValues, LongRentPropertyWizardResult>
      id={LONG_RENT_PROPERTY_WIZARD_ID}
      steps={steps}
      defaultValues={LONG_RENT_PROPERTY_WIZARD_DEFAULTS}
      finishLabel={t('longRentProperties.wizard.finish')}
      finishFailedMessage={failureMessage ?? t('longRentProperties.wizard.finishFailed')}
      onFinish={finish}
      aboveFooter={
        reading ? (
          <p role="status" className="text-sm text-muted-foreground" data-testid="long-rent-wizard-reading">
            {t('longRentProperties.wizard.reading')}
          </p>
        ) : null
      }
      draft={{ exclude: LONG_RENT_PROPERTY_WIZARD_DRAFT_EXCLUDE }}
      onExit={onExit}
      // Opened again on the last screen (a reload): the answers and the property are gone from here, so the list is the way on.
      renderDone={({ result }) => (result ? <LongRentPropertyDone result={result} /> : <Navigate to={LONG_RENT_PROPERTIES_PATH} replace />)}
      testIds={{
        root: 'long-rent-property-wizard',
        back: 'long-rent-property-wizard-back',
        next: 'long-rent-property-wizard-next',
        skip: 'long-rent-property-wizard-skip',
        finish: 'long-rent-property-wizard-finish',
        exit: 'long-rent-property-wizard-exit',
        finishError: 'long-rent-property-wizard-finish-error',
      }}
    />
  );
}
