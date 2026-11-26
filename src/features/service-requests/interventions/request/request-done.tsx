import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/shared/empty-state';
import { useTranslation } from 'react-i18next';
import { Clock, ExternalLink, ListChecks } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { getServiceRequestStatusLabel } from '@/lib/i18n-labels';
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
  stayId?: string;
}

/**
 * «Cosa succede ora» after the request is made. Only true things: the supplier has the request and answers (accepts, refuses or proposes
 * another time), until when it has to answer when the server says so, that the host is told, and that cancelling is free until the work
 * starts. «Vedi la richiesta» leads to its page, «Fai un'altra richiesta» to a new wizard for the same property. With an external partner
 * nothing was sent: the work is organised on the partner's site and it is not followed in Interventi.
 */
export function RequestDone({ sent, values, stayId }: RequestDoneProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const receipt = location.state?.interventionId;
  useEffect(() => {
    if (sent?.kind === 'request' && receipt !== sent.request.id) {
      // Keep only the server id in this history entry. A reload reads the current request status from its detail page.
      void navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: { interventionId: sent.request.id } });
    }
  }, [sent, receipt, navigate, location.pathname, location.search]);
  const backToStay = stayId ? { label: t('compliance.checkout.backToBooking'), to: `/app/short-rent/bookings/${stayId}` } : undefined;
  const another = { label: t('requestWizard.done.another'), to: requestInterventionPath(values.propertyId || undefined, { again: sent?.kind === 'request' ? sent.request.id : 'again' }) };

  if (!sent && typeof receipt === 'string' && receipt) return <Navigate replace to={interventionPath(receipt)} />;
  if (sent?.kind === 'external' || (!sent && new URLSearchParams(location.search).get('channel') === 'external')) {
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
          secondary={backToStay ?? another}
        />
      </div>
    );
  }

  if (!sent) {
    return <EmptyState icon={ListChecks} title={t('requestWizard.housekeeping.verifyTitle')} description={t('requestWizard.housekeeping.verifyText')}
      action={{ label: t('interventions.title'), href: INTERVENTIONS_PATH }} />;
  }

  const supplier = sent.supplierName.trim() || sent.request.supplierName?.trim() || values.supplierName.trim();
  const pending = sent.request.status === 'Richiesto';
  const respondBy = pending ? instantToCome(sent.request.respondBy) : null;

  return (
    <div data-testid="request-done">
      <WizardDone
        title={supplier ? t('requestWizard.done.title', { supplier }) : t('requestWizard.done.titleGeneric')}
        description={t('requestWizard.done.description')}
        whatNext={[
          { text: pending ? t('requestWizard.done.answers') : t('requestWizard.housekeeping.status', { status: getServiceRequestStatusLabel(sent.request.status, t) }), icon: ListChecks },
          ...(respondBy ? [{ text: t('requestWizard.done.respondBy', { when: formatRomeDateTime(respondBy, i18n.language, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) }), icon: Clock }] : []),
        ]}
        primary={{ label: t('requestWizard.done.see'), to: interventionPath(sent.request.id) }}
        secondary={backToStay ?? another}
      />
    </div>
  );
}
