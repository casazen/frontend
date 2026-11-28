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

export type RequestSent = { kind: 'request'; request: ServiceRequest; supplierName: string } | { kind: 'external' };

interface RequestDoneProps {
  sent: RequestSent | undefined;
  values: RequestValues;
  stayId?: string;
}

export function RequestDone({ sent, values, stayId }: RequestDoneProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const receipt = location.state?.interventionId;
  useEffect(() => {
    if (sent?.kind === 'request' && receipt !== sent.request.id) {
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
