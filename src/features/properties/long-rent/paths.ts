/** Routes of the long-term (long-rent) property pages (A7-06). */
export const LONG_RENT_PROPERTIES_PATH = '/app/long-rent/properties';

export const longRentPropertyPath = (id: string) => `${LONG_RENT_PROPERTIES_PATH}/${id}`;

export const longRentPropertyEditPath = (id: string) => `${LONG_RENT_PROPERTIES_PATH}/${id}/edit`;

export const LONG_RENT_PROPERTY_CREATE_PATH = `${LONG_RENT_PROPERTIES_PATH}/new`;

/** Lease form with the property preselected. */
export const newLeaseForPropertyPath = (id: string) => `/app/long-rent/leases/new?propertyId=${encodeURIComponent(id)}`;
