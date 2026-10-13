import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { registerCommands, useRegisterCommands, useRegisteredCommandSources } from '../registry';
import type { CommandSource } from '../types';

const source = (id: string): CommandSource => ({ id, getItems: () => [] });

const registered = () => renderHook(() => useRegisteredCommandSources());

describe('registerCommands (UI-06)', () => {
  const undo: Array<() => void> = [];
  afterEach(() => {
    cleanup();
    // The registry lives as long as the module: what a test added goes away with it.
    undo.splice(0).forEach((remove) => remove());
  });

  it('RegisterCommands_Source_IsSeenByThePaletteUntilItIsTakenAway', () => {
    const hook = registered();
    expect(hook.result.current).toEqual([]);

    const mine = source('help');
    let remove = () => {};
    act(() => {
      remove = registerCommands(mine);
    });
    undo.push(remove);
    expect(hook.result.current).toEqual([mine]);

    act(() => remove());
    expect(hook.result.current).toEqual([]);
  });

  it('RegisterCommands_TakingItAwayTwice_DoesNothingTheSecondTime', () => {
    const hook = registered();
    let remove = () => {};
    act(() => {
      remove = registerCommands(source('help'));
    });

    act(() => remove());
    act(() => remove());

    expect(hook.result.current).toEqual([]);
  });

  it('RegisterCommands_SameId_TakesThePlaceOfTheOldOneAndTheOldOnesRemovalKeepsTheNewOne', () => {
    const hook = registered();
    const first = source('help');
    const second = source('help');
    let removeFirst = () => {};
    let removeSecond = () => {};
    act(() => {
      removeFirst = registerCommands(first);
      removeSecond = registerCommands(second);
    });
    undo.push(removeSecond);

    expect(hook.result.current).toEqual([second]);

    // The feature that registered the first one leaves: it must not take the second one with it.
    act(() => removeFirst());
    expect(hook.result.current).toEqual([second]);
  });

  it('RegisterCommands_SeveralSources_AreKeptInTheOrderTheyCame', () => {
    const hook = registered();
    const removers: Array<() => void> = [];
    act(() => {
      removers.push(registerCommands(source('b')), registerCommands(source('a')));
    });
    undo.push(...removers);

    expect(hook.result.current.map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('UseRegisterCommands_ComponentOnTheScreen_RegistersWhileItIsThere', () => {
    const mine = source('page-commands');
    function Page() {
      useRegisterCommands(mine);
      return null;
    }
    const hook = registered();

    const view = render(<Page />);
    expect(hook.result.current).toEqual([mine]);

    view.unmount();
    expect(hook.result.current).toEqual([]);
  });
});
