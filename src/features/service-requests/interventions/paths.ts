/** Routes of the interventions of Affitti brevi (SR-08): the list, and the page of one request. */
export const INTERVENTIONS_PATH = '/app/short-rent/interventions';

export const interventionPath = (id: string) => `${INTERVENTIONS_PATH}/${encodeURIComponent(id)}`;

/** The kind of the global drawer (UI-15) that shows one intervention: the same one the calendar and the Home open. */
export const INTERVENTION_DRAWER_KIND = 'intervention';

/** Where the host asks for an intervention: the marketplace finds the supplier (the request wizard of SR-08b takes this place). */
export function requestInterventionPath(propertyId?: string): string {
  return propertyId ? `/app/short-rent/marketplace?propertyId=${encodeURIComponent(propertyId)}` : '/app/short-rent/marketplace';
}
