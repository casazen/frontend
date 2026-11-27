export const LONG_RENT_PROPERTIES_PATH = '/app/long-rent/properties';

export const longRentPropertyPath = (id: string) => `${LONG_RENT_PROPERTIES_PATH}/${id}`;

export const longRentPropertyDataPath = (id: string) => `${LONG_RENT_PROPERTIES_PATH}/${id}?tab=data`;

export const longRentPropertyEditPath = (id: string) => `${LONG_RENT_PROPERTIES_PATH}/${id}/edit`;

export const LONG_RENT_PROPERTY_CREATE_PATH = `${LONG_RENT_PROPERTIES_PATH}/new`;

export const newLeaseForPropertyPath = (id: string) => `/app/long-rent/leases/new?propertyId=${encodeURIComponent(id)}`;

export const longRentLeasePath = (id: string) => `/app/long-rent/leases/${id}`;

export const LONG_RENT_PROPERTY_DRAWER_KIND = 'long-rent-property';
