import { useCallback, useState, type ReactNode } from 'react';
import { ServiceRequestForm } from '@/features/service-requests/components/service-request-form';

/** What a request of an intervention starts from: nothing (the dialog asks for everything), or a supplier and the category. */
export interface InterventionRequestStart {
  supplierOrgId?: string;
  category?: string;
}

interface InterventionRequest {
  /** Press «Richiedi un intervento»: the request starts from `from`. */
  open: (from?: InterventionRequestStart) => void;
  /** The dialog of the request, to put once in the page that calls `open`; nothing while there is no property to ask for. */
  dialog: ReactNode;
}

/**
 * «Richiedi un intervento» from the Marketplace: the one place that knows how a request is started (MKT). Today it is the dialog
 * of the request (the stay, the time, the supplier, with the supplier and the category already chosen when the button was on a
 * supplier); when the guided request of Interventi (SR-08b) is in `develop`, `open` leads there instead and no page changes.
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
      // Another supplier or category starts the form again, so what was typed for the last one is not carried over.
      key={`${from.supplierOrgId ?? ''}|${from.category ?? ''}`}
      propertyId={propertyId}
      supplierOrgId={from.supplierOrgId}
      preselectedCategory={from.category}
      open={isOpen}
      onOpenChange={setIsOpen}
      hideTrigger
    />
  ) : null;

  return { open, dialog };
}
