import { useTranslation } from 'react-i18next';
import { BellRing, Clock, ExternalLink, ListChecks, Undo2 } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { ServiceRequest } from '@/types/service-request';
import { instantToCome } from '../../long-rent/long-rent-request-model';
import { INTERVENTIONS_PATH, interventionPath, marketplaceForPropertyPath, requestInterventionPath } from '../paths';
import type { RequestValues } from './request-model';

/**
 * What the wizard ended with: the answer of the creation and the name of the supplier it was sent to (the answer names it, the wizard
 * remembers it), or the choice of an external partner, which sent nothing to CasaZen.
 */
export type RequestSent = { kind: 'request'; request: ServiceRequest; supplierName: string } | { kind: 'external' };

interface RequestDoneProps {
  /** Without it (the last screen opened again after a reload) the screen says what is true of every request. */
  sent: RequestSent | undefined;
  values: RequestValues;
}

/**
 * «Cosa succede ora» after the request is made. Only true things: the supplier has the request and answers (accepts, refuses or proposes
 * another time), until when it has to answer when the server says so, that the host is told, and that cancelling is free until the work
 * starts. «Vedi la richiesta» leads to its page, «Fai un'altra richiesta» to a new wizard for the same property. With an external partner
 * nothing was sent: the work is organised on the partner's site and it is not followed in Interventi.
 */
export function RequestDone({ sent, values }: RequestDoneProps) {
  const { t, i18n } = useTranslation();
  const another = { label: t('requestWizard.done.another'), to: requestInterventionPath(values.propertyId || undefined, { again: sent?.kind === 'request' ? sent.request.id : 'again' }) };

  if (sent?.kind === 'external') {
    return (
      <div data-testid="request-done">
        <WizardDone
          title={t('requestWizard.done.external.title')}
          description={t('requestWizard.done.external.description')}
          whatNext={[
            { text: t('requestWizard.done.external.site'), icon: ExternalLink },
            { text: t('requestWizard.done.external.notFollowed'), icon: ListChecks },
          ]}
          primary={{ label: t('requestWizard.done.external.back'), to: marketplaceForPropertyPath(values.propertyId || undefined) }}
          secondary={another}
        />
      </div>
    );
  }

  const supplier = (sent?.kind === 'request' ? sent.supplierName.trim() : '') || values.supplierName.trim();
  const respondBy = instantToCome(sent?.kind === 'request' ? sent.request.respondBy : undefined);

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
        primary={{ label: t('requestWizard.done.see'), to: sent?.kind === 'request' ? interventionPath(sent.request.id) : INTERVENTIONS_PATH }}
        secondary={another}
      />
    </div>
  );
}
