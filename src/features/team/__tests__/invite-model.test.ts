import { describe, expect, it } from 'vitest';
import { inviteDefaults, inviteScopeOf, inviteStepSchemas, knownEmails, toInvitationRequest } from '../invite/invite-model';
import type { PickerProperty } from '../team-properties';

const properties: PickerProperty[] = [
  { id: 'short', name: 'A', city: '', area: 'short-rent' },
  { id: 'long', name: 'B', city: '', area: 'long-rent' },
];

describe('agency rental areas in invitations', () => {
  it('starts a long-term-only invitation in the enabled area despite an inactive property link', () => {
    const { values } = inviteDefaults(new URLSearchParams('area=short-rent&property=short'), 'it', properties, ['long-rent']);
    expect(values.areas).toEqual(['long-rent']);
    expect(values.propertyIds).toEqual([]);
  });

  it('limits administrator reviews and requests to all active areas, including both for a dual agency', () => {
    const { values } = inviteDefaults(new URLSearchParams('role=admin'), 'en', properties, ['short-rent']);
    values.areas = ['long-rent'];
    expect(inviteScopeOf(values, properties, ['short-rent']).areas).toEqual(['short-rent']);
    expect(toInvitationRequest(values, properties, ['short-rent']).areas).toEqual(['short-rent']);
    expect(toInvitationRequest(values, properties, ['short-rent', 'long-rent']).areas).toEqual(['short-rent', 'long-rent']);
  });

  it('validates stale collaborator choices and only carries properties in an active selected area', () => {
    const { values } = inviteDefaults(new URLSearchParams(), 'it', properties, ['short-rent']);
    const schemas = inviteStepSchemas(knownEmails([], []), ['short-rent']);
    values.areas = ['long-rent'];
    expect(schemas.where.safeParse(values).success).toBe(false);
    values.areas.push('short-rent');
    values.scope = 'Selected';
    values.propertyIds = ['long', 'short'];
    expect(toInvitationRequest(values, properties, ['short-rent'])).toMatchObject({ areas: ['short-rent'], propertyIds: ['short'] });
  });
});
