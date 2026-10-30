/** Routes of the interventions of Affitti brevi: the list (SR-08), the page of one request (SR-08) and the guided request (SR-08b). */
export const INTERVENTIONS_PATH = '/app/short-rent/interventions';

export const interventionPath = (id: string) => `${INTERVENTIONS_PATH}/${encodeURIComponent(id)}`;

/** The kind of the global drawer (UI-15) that shows one intervention: the same one the calendar and the Home open. */
export const INTERVENTION_DRAWER_KIND = 'intervention';

/** «Richiedi un intervento»: the guided procedure in four steps. */
export const REQUEST_INTERVENTION_PATH = `${INTERVENTIONS_PATH}/request`;

/** What the address of the guided request can start from (every entry point of the app uses the same words). */
export interface RequestStart {
  bookingId?: string;
  /** A category of `GET /api/service-categories`. */
  type?: string;
  /** The day of the work, `yyyy-MM-dd`. */
  date?: string;
  supplierOrgId?: string;
  /** A new request after one was made: the finished wizard stays finished at its own address, this makes it another one. */
  again?: string;
}

/** Where the host asks for an intervention: the guided request, started from what the caller already knows. */
export function requestInterventionPath(propertyId?: string, start: RequestStart = {}): string {
  const params = new URLSearchParams();
  if (propertyId) params.set('propertyId', propertyId);
  if (start.bookingId) params.set('bookingId', start.bookingId);
  if (start.type) params.set('type', start.type);
  if (start.date) params.set('date', start.date);
  if (start.supplierOrgId) params.set('supplierOrgId', start.supplierOrgId);
  if (start.again) params.set('n', start.again);
  const query = params.toString();
  return query ? `${REQUEST_INTERVENTION_PATH}?${query}` : REQUEST_INTERVENTION_PATH;
}

/** The marketplace of the suppliers for a property: where the host looks around before choosing. */
export function marketplaceForPropertyPath(propertyId?: string): string {
  return propertyId ? `/app/short-rent/marketplace?propertyId=${encodeURIComponent(propertyId)}` : '/app/short-rent/marketplace';
}
