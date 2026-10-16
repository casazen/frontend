import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDetail, getDetailsVersion, isHostMounted, registerDetail, registerHost, subscribeToDetails, type DetailDef } from '../detail-registry';

const def = (title = 'detailDrawer.fallbackTitle'): DetailDef => ({ title, Content: () => null });

describe('registry of the detail drawer (UI-15)', () => {
  const undo: Array<() => void> = [];
  const register = (kind: string, d: DetailDef = def()) => {
    const unregister = registerDetail(kind, d);
    undo.push(unregister);
    return unregister;
  };

  afterEach(() => {
    while (undo.length > 0) undo.pop()?.();
  });

  it('registerDetail_AKind_CanBeLookedUp', () => {
    const d = def();
    register('probe', d);

    expect(getDetail('probe')).toBe(d);
    expect(getDetail('another')).toBeUndefined();
  });

  it.each(['Booking', '1x', 'a b', '', 'booking:x'])('registerDetail_%j_IsRefusedBecauseItCannotTravelInTheAddress', (kind) => {
    expect(() => registerDetail(kind, def())).toThrow(/lowercase word/);
    expect(getDetail(kind)).toBeUndefined();
  });

  it('registerDetail_TheSameKindAgain_ReplacesTheFirst', () => {
    const first = def();
    const second = def();
    register('probe', first);
    register('probe', second);

    expect(getDetail('probe')).toBe(second);
  });

  it('registerDetail_ReturnedFunction_TakesTheKindAway', () => {
    const unregister = register('probe');

    unregister();

    expect(getDetail('probe')).toBeUndefined();
  });

  it('registerDetail_UnregisteringAReplacedDefinition_LeavesTheNewOneAlone', () => {
    const first = def();
    const second = def();
    const unregisterFirst = register('probe', first);
    register('probe', second);

    unregisterFirst();

    expect(getDetail('probe')).toBe(second);
  });

  it('registerHost_TheHostOfTheShell_IsKnownWhileItIsThereAndForgottenWhenItGoes', () => {
    expect(isHostMounted()).toBe(false);

    const unregister = registerHost();
    expect(isHostMounted()).toBe(true);

    unregister();
    expect(isHostMounted()).toBe(false);
  });

  it('registerHost_ASecondHost_IsToldLoudlyAndTheFirstStillCounts', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const first = registerHost();
    expect(error).not.toHaveBeenCalled();

    const second = registerHost();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('mounted more than once'));

    second();
    expect(isHostMounted()).toBe(true);
    first();
    expect(isHostMounted()).toBe(false);
    error.mockRestore();
  });

  it('subscribeToDetails_ARegistration_TellsTheListenersAndChangesTheVersion', () => {
    const listener = vi.fn();
    const stop = subscribeToDetails(listener);
    const before = getDetailsVersion();

    const unregister = register('probe');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getDetailsVersion()).toBeGreaterThan(before);

    unregister();
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    register('probe');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
