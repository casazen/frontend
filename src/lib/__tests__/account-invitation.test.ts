import { describe, expect, it } from 'vitest';
import { accountInvitationLogin } from '@/lib/account-invitation';

const ticket = 'organization=org_case123&invitation=inv_ticket123';
const hex = 'ab'.repeat(32);
const contact = 'b'.repeat(43);

describe('accountInvitationLogin', () => {
  it.each([
    ['owner', hex, '/portale-proprietari/invito', { ownerInvitation: hex }],
    ['owner-contact', contact, '/portale-proprietari/contatto', { ownerContactInvitation: contact }],
    ['team', hex, `/invite/accept?token=${hex}`, undefined],
    ['host', hex, `/invito-host/${hex}`, undefined],
    ['supplier', hex, `/register?inviteToken=${hex}`, undefined],
  ])('hands the %s invitation back to its existing acceptance page', (flow, token, returnTo, appState) => {
    const options = accountInvitationLogin(`#${ticket}&flow=${flow}&token=${token}`);
    expect(options?.authorizationParams).toEqual({ organization: 'org_case123', invitation: 'inv_ticket123' });
    expect(options?.appState).toEqual(appState);
    expect(options?.returnTo).toBe(returnTo);
  });

  it.each([
    `#${ticket}&flow=external&token=${hex}`,
    `#${ticket}&flow=host&token=//example.com`,
    `#flow=owner&token=${hex}`,
    `#${ticket}&flow=owner&token=short`,
  ])('rejects an invalid invitation', (fragment) => {
    expect(accountInvitationLogin(fragment)).toBeNull();
  });
});
