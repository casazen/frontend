/** Routes of the long-term (long-rent) property pages (A7-06). */
export const LONG_RENT_PROPERTIES_PATH = '/app/long-rent/properties';

export const longRentPropertyPath = (id: string) => `${LONG_RENT_PROPERTIES_PATH}/${id}`;

/** The page of a property on its tab "Dati" (the place and the cadastral identification): where the contract wizard sends a landlord to complete them. */
export const longRentPropertyDataPath = (id: string) => `${LONG_RENT_PROPERTIES_PATH}/${id}?tab=data`;

export const longRentPropertyEditPath = (id: string) => `${LONG_RENT_PROPERTIES_PATH}/${id}/edit`;

export const LONG_RENT_PROPERTY_CREATE_PATH = `${LONG_RENT_PROPERTIES_PATH}/new`;

/** Lease form with the property preselected. */
export const newLeaseForPropertyPath = (id: string) => `/app/long-rent/leases/new?propertyId=${encodeURIComponent(id)}`;

/** The page of a lease: where the list of the properties leads from the tenant of a property. */
export const longRentLeasePath = (id: string) => `/app/long-rent/leases/${id}`;

/** What the address calls the drawer of a property of this section: `?detail=long-rent-property:<id>`. */
export const LONG_RENT_PROPERTY_DRAWER_KIND = 'long-rent-property';
