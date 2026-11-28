import { propertiesListPath, propertyDetailPath } from './mode/paths';

const AREA = 'short-rent' as const;

export const PROPERTIES_PATH = propertiesListPath(AREA);

export const PROPERTY_CREATE_PATH = `${propertiesListPath(AREA)}/create`;

export const PROPERTY_DRAWER_KIND = 'property';

export const propertyPath = (id: string) => propertyDetailPath(AREA, id);

export const propertyEditPath = (id: string) => `${propertyPath(id)}/edit`;

export const propertyPricingPath = (id: string) => `${propertyPath(id)}/pricing`;

export const propertyTabPath = (id: string, tab: string) => `${propertyPath(id)}?tab=${tab}`;

export const propertyActivationPath = (id: string) => `${propertyPath(id)}/activation`;

export const propertyWizardPath = (id: string, step?: string) =>
  `${PROPERTY_CREATE_PATH}?propertyId=${encodeURIComponent(id)}${step ? `&step=${encodeURIComponent(step)}` : ''}`;

export const propertyCalendarPath = (id: string) => `/app/${AREA}/bookings/calendar?propertyId=${encodeURIComponent(id)}`;

export const propertyNewBookingPath = (id: string) => `/app/${AREA}/bookings/create?propertyId=${encodeURIComponent(id)}`;

export const propertyBookingsPath = (id: string) => `/app/${AREA}/bookings?propertyId=${encodeURIComponent(id)}`;

export const propertyServiceRequestPath = (id: string) => `/app/${AREA}/marketplace?propertyId=${encodeURIComponent(id)}`;

export const AUTOMATIONS_PATH = `/app/${AREA}/automations`;
