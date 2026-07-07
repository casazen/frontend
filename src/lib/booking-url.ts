export function buildPropertyBookingPath(orgSlug: string, property: { id: string; slug?: string | null }): string {
  const segment = property.slug?.trim() || property.id;
  return `/book/${orgSlug}/property/${segment}`;
}

export function buildOrgBookingPath(orgSlug: string): string {
  return `/book/${orgSlug}`;
}

export function isPropertyPublishable(property: { isActive: boolean; complianceStatus?: string }): boolean {
  return property.isActive && property.complianceStatus === 'Active';
}
