import { describe, expect, it } from 'vitest';
import { buildDemoProfile } from '@/lib/demo-profile';
import { commercialPartAllowed, commercialRouteAllowed } from '../commercial-access';
const profile = { ...buildDemoProfile('short-stay'), commercialSignup: { profile: 'owner' as const, planTier: 'Pro' as const, rooms: 1, addons: ['channels'] }, commercialEnabledAddons: ['channels'] };
describe('purchased modules and guided setup', () => {
  it('keeps the base workspace while exposing only purchased extra sections', () => {
    expect(commercialRouteAllowed(profile, '/app/short-rent/properties')).toBe(true);
    expect(commercialRouteAllowed(profile, '/app/short-rent/bookings')).toBe(true);
    expect(commercialRouteAllowed(profile, '/app/short-rent/channels')).toBe(true);
    expect(commercialRouteAllowed(profile, '/app/short-rent/interventions')).toBe(false);
    expect(commercialRouteAllowed(profile, '/app/short-rent/fiscal')).toBe(false);
    expect(commercialRouteAllowed(profile, '/app/short-rent/automations')).toBe(false);
    expect(commercialRouteAllowed({ ...profile, commercialEnabledAddons: ['ai-agents'] }, '/app/short-rent/automations')).toBe(true);
    expect(commercialRouteAllowed(profile, '/app/short-rent/settings/ai')).toBe(true);
  });
  it('does not recommend configuring extras the organization has not purchased', () => {
    expect(commercialPartAllowed(profile, 'properties')).toBe(true);
    expect(commercialPartAllowed(profile, 'octorateConnection')).toBe(true);
    expect(commercialPartAllowed(profile, 'messagesAi')).toBe(false);
    expect(commercialPartAllowed(profile, 'fiscalDocuments')).toBe(false);
  });
  it('preserves existing accounts rather than changing their contracted access', () => {
    expect(commercialRouteAllowed(buildDemoProfile('short-stay'), '/app/short-rent/fiscal')).toBe(true);
  });
});
