import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPlanResume, readPlanResume, savePlanResume } from '../plan-resume';

describe('the place saved in the onboarding plan', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); });

  it('survives closing the tab, stays within the account and stores only a step and its expiry', () => {
    savePlanResume('one', 'org', 'mittente');
    sessionStorage.clear();
    expect(readPlanResume('one', 'org')).toBe('mittente');
    expect(readPlanResume('two', 'org')).toBeNull();
    expect(readPlanResume('one', 'other')).toBeNull();
    expect(readPlanResume(null, 'org')).toBeNull();
    expect(Object.keys(JSON.parse(localStorage.getItem(localStorage.key(0)!)!)).sort()).toEqual(['expiresAt', 'step']);
    clearPlanResume('one', 'org');
    expect(localStorage.length).toBe(0);
  });

  it('discards an expired position', () => {
    vi.useFakeTimers();
    savePlanResume('host', 'org', 'channels');
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(readPlanResume('host', 'org')).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
