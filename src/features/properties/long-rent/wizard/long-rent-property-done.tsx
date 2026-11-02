import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { usePropertyDocuments } from '@/queries/use-properties';
import type { PropertyDocumentDto } from '@/types';
import { ApeIdentificationForm } from '../../components/ape-identification-form';
import { longRentPropertyPath, newLeaseForPropertyPath } from '../paths';
import { isApeIdentified, isReadyForContract, type LongRentPropertyWizardResult } from './long-rent-property-wizard-model';

/**
 * The APE as the page knows it now: what the upload answered (it alone carries the outcome of the reading), over what the documents
 * of the property say since (code and class typed on this screen are there).
 */
function liveApe(uploaded: PropertyDocumentDto, documents: readonly PropertyDocumentDto[] | undefined): PropertyDocumentDto {
  const stored = documents?.find((document) => document.id === uploaded.id);
  return stored ? { ...uploaded, ...stored, apeCheck: uploaded.apeCheck, apeUnreadFields: uploaded.apeUnreadFields } : uploaded;
}

/**
 * "Cosa succede ora" of the wizard (LR-07c): the property exists whatever happened after it, so this says what was saved, what the
 * contract still needs and where to go. The contract is the main way on only when it can be made; otherwise it is the property, where
 * the missing things are added. A code and a class the reading did not find are typed here, right under the APE that was uploaded.
 */
export function LongRentPropertyDone({ result }: { result: LongRentPropertyWizardResult }) {
  const { t } = useTranslation();
  const { property } = result;
  const uploaded = result.ape.status === 'uploaded' ? result.ape.document : null;
  const documents = usePropertyDocuments(uploaded ? property.id : undefined);
  const ape = uploaded ? liveApe(uploaded, documents.data) : null;

  const ready = isReadyForContract(result, ape ?? undefined);
  const identified = ape ? isApeIdentified(ape) : false;
  // The reading found them (in the file or in the register): the contract prints them, so they are said. Typed by hand: the person knows.
  const readSource = uploaded?.apeIdentificationSource ?? null;

  const whatNext = [
    { text: t('longRentProperties.wizard.done.inList', { name: property.name }) },
    ...(result.cadastral === 'saved' ? [{ text: t('longRentProperties.wizard.done.cadastralSaved') }] : []),
    ...(ape ? [{ text: t('longRentProperties.wizard.done.apeUploaded') }] : []),
  ];

  const todo: string[] = [];
  if (result.cadastral === 'none') todo.push(t('longRentProperties.wizard.done.todo.cadastral'));
  else if (result.cadastral === 'failed') todo.push(t('longRentProperties.wizard.done.todo.cadastralFailed'));
  else if (!result.cadastralComplete) todo.push(t('longRentProperties.wizard.done.todo.cadastralIncomplete'));
  if (result.ape.status === 'none') todo.push(t('longRentProperties.wizard.done.todo.ape'));
  else if (result.ape.status === 'failed') {
    todo.push(
      result.ape.reason
        ? t('longRentProperties.wizard.done.todo.apeFailedWhy', { reason: result.ape.reason })
        : t('longRentProperties.wizard.done.todo.apeFailed'),
    );
  } else if (ape && !identified) todo.push(t('longRentProperties.wizard.done.todo.apeIdentification'));
  else if (ape?.apeCheck === 'Expired') todo.push(t('longRentProperties.wizard.done.todo.apeExpired'));

  const createLease = { label: t('longRentProperties.wizard.done.createLease'), to: newLeaseForPropertyPath(property.id) };
  const openProperty = { label: t('longRentProperties.wizard.done.openProperty'), to: longRentPropertyPath(property.id) };

  return (
    <div data-testid="long-rent-wizard-done">
      <WizardDone
        title={t('longRentProperties.wizard.done.title')}
        description={property.name}
        whatNext={whatNext}
        primary={ready ? createLease : openProperty}
        secondary={ready ? openProperty : createLease}
      >
        {todo.length > 0 && (
          <Alert variant="warning" title={t('longRentProperties.wizard.done.todo.title')} data-testid="long-rent-wizard-todo">
            <ul className="list-disc space-y-1 pl-5">
              {todo.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </Alert>
        )}
        {ape && identified && readSource && (
          <Alert variant="success" data-testid="long-rent-wizard-ape-read">
            {t(readSource === 'Registry' ? 'shared.documentUpload.apeReadRegistry' : 'shared.documentUpload.apeReadDocument', {
              code: ape.apeCode,
              energyClass: ape.apeEnergyClass,
            })}
          </Alert>
        )}
        {ape && !identified && (
          <div data-testid="long-rent-wizard-ape-fields">
            <ApeIdentificationForm propertyId={property.id} document={ape} initiallyEditing />
          </div>
        )}
      </WizardDone>
    </div>
  );
}
