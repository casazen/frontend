/** The addresses of Servizi e prezzi (rotte reali, in inglese: the menu, the e-mails and the showcase point at them). */
export const SERVICES_PATH = '/app/supplier/services';
export const NEW_SERVICE_PATH = `${SERVICES_PATH}/new`;

/** The page of a service: every field, with the preview beside them. */
export function servicePath(id: string): string {
  return `${SERVICES_PATH}/${encodeURIComponent(id)}`;
}

/** The creation, reopened on a draft the supplier started (the draft is the service itself, saved at every step). */
export function draftPath(id: string): string {
  return `${NEW_SERVICE_PATH}?bozza=${encodeURIComponent(id)}`;
}

/** The creation that starts from a copy of a service: the copy is made once, then the address is the one of its draft. */
export function duplicatePath(id: string): string {
  return `${NEW_SERVICE_PATH}?duplica=${encodeURIComponent(id)}`;
}

/**
 * "Come lo vedono i clienti": the times a customer could book, per service, in Disponibilità (SP-07b builds the section, the
 * `?sezione=` and `?servizio=` of the demo). Until then the link opens Disponibilità.
 */
export function bookingPreviewPath(serviceId?: string): string {
  return `/app/supplier/availability?sezione=anteprima${serviceId ? `&servizio=${encodeURIComponent(serviceId)}` : ''}`;
}

/** Where the zone is changed (the comuni of the supplier are valid for every service, D10): Disponibilità › Regole › Zona. */
export const ZONE_PATH = '/app/supplier/availability?sezione=regole&zona=1';

/** The preview of the showcase of the supplier (the page of "Il mio sito vetrina"). */
export const SHOWCASE_PATH = '/app/supplier/showcase';
