export const SERVICES_PATH = '/app/supplier/services';
export const NEW_SERVICE_PATH = `${SERVICES_PATH}/new`;

export function servicePath(id: string): string {
  return `${SERVICES_PATH}/${encodeURIComponent(id)}`;
}

export function draftPath(id: string): string {
  return `${NEW_SERVICE_PATH}?bozza=${encodeURIComponent(id)}`;
}

export function duplicatePath(id: string): string {
  return `${NEW_SERVICE_PATH}?duplica=${encodeURIComponent(id)}`;
}

export function bookingPreviewPath(serviceId?: string): string {
  return `/app/supplier/availability?sezione=anteprima${serviceId ? `&servizio=${encodeURIComponent(serviceId)}` : ''}`;
}

export const ZONE_PATH = '/app/supplier/availability?sezione=regole&zona=1';

export const SHOWCASE_PATH = '/app/supplier/showcase';
