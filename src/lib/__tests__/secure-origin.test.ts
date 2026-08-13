import { describe, expect, it } from 'vitest';
import { isPublicUnauthenticatedPath, isSecureAuth0Origin } from '@/lib/secure-origin';

describe('isSecureAuth0Origin', () => {
  it('allows https and localhost', () => {
    expect(isSecureAuth0Origin({ protocol: 'https:', hostname: 'example.com' })).toBe(true);
    expect(isSecureAuth0Origin({ protocol: 'http:', hostname: 'localhost' })).toBe(true);
    expect(isSecureAuth0Origin({ protocol: 'http:', hostname: '127.0.0.1' })).toBe(true);
  });

  it('rejects plain http LAN IPs', () => {
    expect(isSecureAuth0Origin({ protocol: 'http:', hostname: '172.20.10.4' })).toBe(false);
    expect(isSecureAuth0Origin({ protocol: 'http:', hostname: '192.168.1.10' })).toBe(false);
  });
});

describe('isPublicUnauthenticatedPath', () => {
  it('matches direct booking and SEO surfaces', () => {
    expect(isPublicUnauthenticatedPath('/book/acme/property/villa')).toBe(true);
    expect(isPublicUnauthenticatedPath('/book/acme')).toBe(true);
    expect(isPublicUnauthenticatedPath('/search')).toBe(true);
    expect(isPublicUnauthenticatedPath('/p/affitti-brevi/lazio/roma')).toBe(true);
    expect(isPublicUnauthenticatedPath('/checkin/token')).toBe(true);
  });

  it('does not match host console routes', () => {
    expect(isPublicUnauthenticatedPath('/login')).toBe(false);
    expect(isPublicUnauthenticatedPath('/app/short-rent')).toBe(false);
    expect(isPublicUnauthenticatedPath('/register')).toBe(false);
  });
});
