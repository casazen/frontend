import { describe, it, expect, beforeEach } from 'vitest';
import {
  ACTIVE_LAYER_STORAGE_KEY,
  getDefaultHomePath,
  resolveInitialLayer,
} from '../use-app-layer';
import { ROLE_LONG_TERM_LANDLORD, ROLE_PROPERTY_OWNER } from '@/lib/auth-roles';

describe('use-app-layer helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns short-stay home for short-stay layer', () => {
    expect(getDefaultHomePath('short-stay')).toBe('/');
  });

  it('returns leases home for long-term layer', () => {
    expect(getDefaultHomePath('long-term')).toBe('/leases');
  });

  it('resolves short-stay-only users to short-stay layer', () => {
    const user = { roles: [ROLE_PROPERTY_OWNER] };
    expect(resolveInitialLayer(user)).toBe('short-stay');
  });

  it('resolves long-term-only users to long-term layer', () => {
    const user = { roles: [ROLE_LONG_TERM_LANDLORD] };
    expect(resolveInitialLayer(user)).toBe('long-term');
  });

  it('ignores localStorage for single-role users', () => {
    localStorage.setItem(ACTIVE_LAYER_STORAGE_KEY, 'long-term');
    const user = { roles: [ROLE_PROPERTY_OWNER] };
    expect(resolveInitialLayer(user)).toBe('short-stay');
  });

  it('reads localStorage for dual-role users', () => {
    localStorage.setItem(ACTIVE_LAYER_STORAGE_KEY, 'long-term');
    const user = { roles: [ROLE_PROPERTY_OWNER, ROLE_LONG_TERM_LANDLORD] };
    expect(resolveInitialLayer(user)).toBe('long-term');
  });

  it('defaults dual-role users to short-stay when no preference stored', () => {
    const user = { roles: [ROLE_PROPERTY_OWNER, ROLE_LONG_TERM_LANDLORD] };
    expect(resolveInitialLayer(user)).toBe('short-stay');
  });
});
