import { useTranslation } from 'react-i18next';
import { BellRing, Clock, ListChecks, Undo2 } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { ServiceRequest } from '@/types/service-request';
import { instantToCome } from '../../long-rent/long-rent-request-model';
import { INTERVENTIONS_PATH, interventionPath, requestInterventionPath } from '../paths';
import type { RequestValues } from './request-model';

/** What the creation answered and the name of the supplier it was sent to (the answer names it, the wizard remembers it). */
export interface RequestSent {
  request: ServiceRequest;
  supplierName: string;
}

interface RequestDoneProps {
  /** Without it (the last screen opened again after a reload) the screen says what is true of every request. */
  sent: RequestSent | undefined;
  values: RequestValues;
}

/**
 * «Cosa succede ora» after the request is made. Only true things: the supplier has the request and answers (accepts, refuses or proposes
 * another time), until when it has to answer when the server says so, that the host is told, and that cancelling is free until the work
 * starts. «Vedi la richiesta» leads to its page, «Fai un'altra richiesta» to a new wizard for the same property.
 */
export function RequestDone({ sent, values }: RequestDoneProps) {
  const { t, i18n } = useTranslation();
  const supplier = sent?.supplierName.trim() || values.supplierName.trim();
  const respondBy = instantToCome(sent?.request.respondBy);

  return (
    <div data-testid="request-done">
      <WizardDone
        title={supplier ? t('requestWizard.done.title', { supplier }) : t('requestWizard.done.titleGeneric')}
        description={t('requestWizard.done.description')}
        whatNext={[
          { text: t('requestWizard.done.answers'), icon: ListChecks },
          ...(respondBy ? [{ text: t('requestWizard.done.respondBy', { when: formatRomeDateTime(respondBy, i18n.language, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) }), icon: Clock }] : []),
          { text: t('requestWizard.done.told'), icon: BellRing },
          { text: t('requestWizard.done.cancel'), icon: Undo2 },
        ]}
        primary={{ label: t('requestWizard.done.see'), to: sent ? interventionPath(sent.request.id) : INTERVENTIONS_PATH }}
        secondary={{ label: t('requestWizard.done.another'), to: requestInterventionPath(values.propertyId || undefined, { again: sent?.request.id ?? 'again' }) }}
      />
    </div>
  );
}
