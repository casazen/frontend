import { propertiesListPath, propertyDetailPath } from './mode/paths';

/**
 * The pages the list of properties of Affitti brevi leads to (SR-07). All of them exist already: the list only gives them
 * a way in, with the property they are about.
 */
const AREA = 'short-rent' as const;

/** The list of the properties of the area. */
export const PROPERTIES_PATH = propertiesListPath(AREA);

export const PROPERTY_CREATE_PATH = `${propertiesListPath(AREA)}/create`;

/** What the address calls the drawer of a property: `?detail=property:<id>`. */
export const PROPERTY_DRAWER_KIND = 'property';

/** The full page of the property. */
export const propertyPath = (id: string) => propertyDetailPath(AREA, id);

export const propertyEditPath = (id: string) => `${propertyPath(id)}/edit`;

/** The seasonal price suggestions of the property: its own page, which the sheet only links to. */
export const propertyPricingPath = (id: string) => `${propertyPath(id)}/pricing`;

/** A tab of the page of the property (`?tab=`). */
export const propertyTabPath = (id: string, tab: string) => `${propertyPath(id)}?tab=${tab}`;

/** The wizard that activates a property (or activates it again once what blocked it is fixed). */
export const propertyActivationPath = (id: string) => `${propertyPath(id)}/activation`;

/** The calendar of the area, on this property. */
export const propertyCalendarPath = (id: string) => `/app/${AREA}/bookings/calendar?propertyId=${encodeURIComponent(id)}`;

/** A new booking, started for this property. */
export const propertyNewBookingPath = (id: string) => `/app/${AREA}/bookings/create?propertyId=${encodeURIComponent(id)}`;

/** The bookings of the area, of this property only. */
export const propertyBookingsPath = (id: string) => `/app/${AREA}/bookings?propertyId=${encodeURIComponent(id)}`;

/** Where a host asks a supplier for an intervention on this property. */
export const propertyServiceRequestPath = (id: string) => `/app/${AREA}/marketplace?propertyId=${encodeURIComponent(id)}`;
