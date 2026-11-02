import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestInterventionPath } from '@/features/service-requests/interventions/paths';

/**
 * What a request of an intervention starts from: nothing (the wizard asks for everything), a supplier and the category, or a supplier and
 * one of its services (the page of a supplier: the service fixes the category and is the one chosen).
 */
export interface InterventionRequestStart {
  supplierOrgId?: string;
  category?: string;
  service?: { id: string; category: string };
}

interface InterventionRequest {
  /** Press «Richiedi un intervento»: the guided request opens, started from `from`. */
  open: (from?: InterventionRequestStart) => void;
}

/**
 * «Richiedi un intervento» from the Marketplace: the one place that knows how a request is started (MKT). It leads to the guided request
 * of Interventi (SR-08b), `/interventions/request?propertyId=&type=&supplierOrgId=&serviceId=`, which opens on the first step that the
 * address does not answer already. It used to open a dialog that asked for a stay; the request is for the house, and the stay is a link
 * the host adds in the wizard if it wants.
 */
export function useRequestIntervention(propertyId: string | undefined): InterventionRequest {
  const navigate = useNavigate();

  const open = useCallback(
    (start: InterventionRequestStart = {}) => {
      navigate(
        requestInterventionPath(propertyId, {
          type: start.category ?? start.service?.category,
          supplierOrgId: start.supplierOrgId,
          serviceId: start.service?.id,
        }),
      );
    },
    [navigate, propertyId],
  );

  return { open };
}
