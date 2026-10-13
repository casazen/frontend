import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCommandItems } from '../command-items';
import type { CommandSource } from '../types';
import { item, makeContext } from './test-context';

describe('buildCommandItems (UI-06)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('BuildCommandItems_BuiltInSources_GivePagesThenActions', () => {
    const kinds = buildCommandItems(makeContext()).map((entry) => entry.kind);

    expect(kinds[0]).toBe('page');
    expect(kinds).toContain('action');
    expect(kinds.indexOf('action')).toBeGreaterThan(kinds.lastIndexOf('page'));
  });

  it('BuildCommandItems_SourceOfAFeature_IsAddedAfterTheBuiltInOnes', () => {
    const help: CommandSource = { id: 'help', getItems: () => [item('help:open', 'Apri il centro assistenza', { kind: 'action' })] };

    const items = buildCommandItems(makeContext(), [help]);

    expect(items.at(-1)?.id).toBe('help:open');
  });

  it('BuildCommandItems_SourceReceivesTheContextOfTheUser', () => {
    const getItems = vi.fn(() => []);
    const context = makeContext({ areas: ['long-rent'] });

    buildCommandItems(context, [{ id: 'mine', getItems }]);

    expect(getItems).toHaveBeenCalledWith(context);
  });

  it('BuildCommandItems_SameIdFromTwoSources_ShowsOnceTheFirstOne', () => {
    const first: CommandSource = { id: 'a', getItems: () => [item('same', 'La prima')] };
    const second: CommandSource = { id: 'b', getItems: () => [item('same', 'La seconda'), item('other', 'Un altra')] };

    const items = buildCommandItems(makeContext(), [first, second]).filter((entry) => ['same', 'other'].includes(entry.id));

    expect(items.map((entry) => entry.label)).toEqual(['La prima', 'Un altra']);
  });

  it('BuildCommandItems_SourceThatFails_IsLeftOutAndTheOthersAreStillThere', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken: CommandSource = {
      id: 'broken',
      getItems: () => {
        throw new Error('boom');
      },
    };
    const fine: CommandSource = { id: 'fine', getItems: () => [item('fine:1', 'Funziona')] };

    const items = buildCommandItems(makeContext(), [broken, fine]);

    expect(items.map((entry) => entry.id)).toContain('fine:1');
    expect(items.length).toBeGreaterThan(5);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('broken');
  });
});
