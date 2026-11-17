import { describe, expect, it } from 'vitest';
import type { BillingSetup, PropertySender } from '@/types';
import { billingIdentityComplete, propertySetupReturn, senderChoiceSaved } from '../property-setup-model';

const section = (name: string, complete = true) => ({ section: name, applies: true, complete, values: {}, missing: [] });

describe('property operational onboarding', () => {
  it('requires a saved sender choice rather than the implicit manual default', () => {
    expect(senderChoiceSaved({ applies: true, source: 'DefaultNotConnected', sender: 'Manual' } as PropertySender)).toBe(false);
    expect(senderChoiceSaved({ applies: true, source: 'Stored', sender: 'Manual' } as PropertySender)).toBe(true);
    expect(senderChoiceSaved(null)).toBe(false);
    expect(senderChoiceSaved({ applies: false, source: 'NotApplicable' } as PropertySender)).toBe(false);
  });

  it('requires both persisted issuer identity and tax regime without waiting for external SDI registration', () => {
    expect(billingIdentityComplete(undefined)).toBe(false);
    expect(billingIdentityComplete({ sections: [section('issuer')] } as BillingSetup)).toBe(false);
    expect(billingIdentityComplete({ sections: [section('issuer'), section('vat', false)] } as BillingSetup)).toBe(false);
    expect(billingIdentityComplete({ complete: false, sections: [section('issuer'), section('vat'), section('italy', false)] })).toBe(true);
  });

  it('builds only a local property-wizard return route and rejects external URLs', () => {
    expect(propertySetupReturn(new URLSearchParams({ returnPropertyId: 'p1' }), 'billing')).toBe('/app/short-rent/properties/create?propertyId=p1&step=billing');
    expect(propertySetupReturn(new URLSearchParams({ returnPropertyId: 'https://example.com' }), 'compliance')).toBeNull();
    expect(propertySetupReturn(new URLSearchParams(), 'billing')).toBeNull();
  });
});
