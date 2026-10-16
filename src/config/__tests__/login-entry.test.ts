import { describe, expect, it } from 'vitest';
import { showLoginEntryPoints } from '../login-entry';

describe('showLoginEntryPoints', () => {
  it.each([undefined, null, '', '   ', 42])('showLoginEntryPoints_NoPublicDomain_%s_ShowsTheLink', (value) => {
    expect(showLoginEntryPoints(value)).toBe(true);
  });

  it('showLoginEntryPoints_ProductionBuildWithThePublicDomain_HidesTheLink', () => {
    expect(showLoginEntryPoints('https://www.example.test')).toBe(false);
  });
});
