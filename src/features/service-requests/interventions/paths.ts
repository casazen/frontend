export const INTERVENTIONS_PATH = '/app/short-rent/interventions';

export const interventionPath = (id: string) => `${INTERVENTIONS_PATH}/${encodeURIComponent(id)}`;

export const INTERVENTION_DRAWER_KIND = 'intervention';

export const REQUEST_INTERVENTION_PATH = `${INTERVENTIONS_PATH}/request`;

export interface RequestStart {
  bookingId?: string;
  type?: string;
  date?: string;
  supplierOrgId?: string;
  serviceId?: string;
  again?: string;
}

export function requestInterventionPath(propertyId?: string, start: RequestStart = {}): string {
  const params = new URLSearchParams();
  if (propertyId) params.set('propertyId', propertyId);
  if (start.bookingId) params.set('bookingId', start.bookingId);
  if (start.type) params.set('type', start.type);
  if (start.date) params.set('date', start.date);
  if (start.supplierOrgId) params.set('supplierOrgId', start.supplierOrgId);
  if (start.serviceId) params.set('serviceId', start.serviceId);
  if (start.again) params.set('n', start.again);
  const query = params.toString();
  return query ? `${REQUEST_INTERVENTION_PATH}?${query}` : REQUEST_INTERVENTION_PATH;
}

export function marketplaceForPropertyPath(propertyId?: string): string {
  return propertyId ? `/app/short-rent/marketplace?propertyId=${encodeURIComponent(propertyId)}` : '/app/short-rent/marketplace';
}
