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
    expect(isPublicUnauthenticatedPath('/rent/pay/11111111-1111-1111-1111-111111111111')).toBe(true);
    expect(isPublicUnauthenticatedPath('/service/pay/11111111-1111-1111-1111-111111111111')).toBe(true);
    expect(isPublicUnauthenticatedPath('/guided-form')).toBe(true);
  });

  it('matches the pages the marketing e-mails link to, which never load Auth0', () => {
    expect(isPublicUnauthenticatedPath('/unsubscribe')).toBe(true);
    expect(isPublicUnauthenticatedPath('/marketing/confirm')).toBe(true);
    // The welcome page behind the QR code in a house (CRM-03): a guest who only scanned it is not asked for an account either.
    expect(isPublicUnauthenticatedPath('/benvenuto/TEST-benvenuto-villa-lago')).toBe(true);
  });

  it('does not match host console routes', () => {
    expect(isPublicUnauthenticatedPath('/login')).toBe(false);
    expect(isPublicUnauthenticatedPath('/app/short-rent')).toBe(false);
    expect(isPublicUnauthenticatedPath('/register')).toBe(false);
  });
});
