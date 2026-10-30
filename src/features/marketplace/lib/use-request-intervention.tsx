import { useCallback, useState, type ReactNode } from 'react';
import { ServiceRequestForm, type RequestedService } from '@/features/service-requests/components/service-request-form';

/**
 * What a request of an intervention starts from: nothing (the dialog asks for everything), a supplier and the category, or a supplier
 * and one of its services (the page of a supplier: the service fixes the category and the duration).
 */
export interface InterventionRequestStart {
  supplierOrgId?: string;
  category?: string;
  service?: RequestedService;
}

interface InterventionRequest {
  /** Press «Richiedi un intervento»: the request starts from `from`. */
  open: (from?: InterventionRequestStart) => void;
  /** The dialog of the request, to put once in the page that calls `open`; nothing while there is no property to ask for. */
  dialog: ReactNode;
}

/**
 * «Richiedi un intervento» from the Marketplace: the one place that knows how a request is started (MKT). Today it is the dialog
 * of the request (the stay, the time, the supplier, with the supplier, the category and the service already chosen when the button
 * was on a supplier or on one of its services); when the guided request of Interventi (SR-08b) is in `develop`, `open` leads there
 * instead (`/interventions/request?propertyId=&supplierOrgId=&serviceId=`) and no page changes.
 */
export function useRequestIntervention(propertyId: string | undefined): InterventionRequest {
  const [from, setFrom] = useState<InterventionRequestStart>({});
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((start: InterventionRequestStart = {}) => {
    setFrom(start);
    setIsOpen(true);
  }, []);

  const dialog = propertyId ? (
    <ServiceRequestForm
      // Another supplier, category or service starts the form again, so what was typed for the last one is not carried over.
      key={`${from.supplierOrgId ?? ''}|${from.category ?? ''}|${from.service?.id ?? ''}`}
      propertyId={propertyId}
      supplierOrgId={from.supplierOrgId}
      preselectedCategory={from.category}
      service={from.service}
      open={isOpen}
      onOpenChange={setIsOpen}
      hideTrigger
    />
  ) : null;

  return { open, dialog };
}
