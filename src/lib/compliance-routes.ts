/** Backend summary links use `/app/properties/...`; host console lives under `/app/short-rent/...`. */
export function normalizeComplianceRouteLink(routeLink: string): string {
  if (routeLink.startsWith('/app/properties/')) {
    return routeLink.replace('/app/properties/', '/app/short-rent/properties/');
  }
  if (routeLink.startsWith('/app/bookings/')) {
    return routeLink.replace('/app/bookings/', '/app/short-rent/bookings/');
  }
  if (routeLink === '/app/compliance') {
    return '/app/short-rent/compliance';
  }
  return routeLink;
}
