import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchManual, type ManualHit } from '@/lib/manual/manual-search';
import { manualSource } from '../sources/manual';

vi.mock('@/lib/manual/manual-search', () => ({ searchManual: vi.fn() }));

const HOWTO: ManualHit = {
  id: 'immobili.html#aggiungere',
  type: 'howto',
  title: 'Aggiungere un immobile con la procedura guidata',
  chapter: 'Immobili',
  href: '/guida/immobili.html#aggiungere',
};

describe('the manual as a source of the global search', () => {
  beforeEach(() => vi.mocked(searchManual).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('Search_Text_AsksTheManualAndAnswersWithItemsOfTheGuideGroup', async () => {
    vi.mocked(searchManual).mockResolvedValue([HOWTO]);

    const items = await manualSource.search('aggiungere immobile', { signal: new AbortController().signal });

    expect(searchManual).toHaveBeenCalledWith('aggiungere immobile', 5);
    expect(items).toEqual([
      expect.objectContaining({
        id: 'guide:howto:immobili.html#aggiungere',
        kind: 'guide',
        label: 'Aggiungere un immobile con la procedura guidata',
        subtitle: 'Immobili',
      }),
    ]);
  });

  it('Choosing_AnItem_OpensTheManualInANewTabThatCannotReachBackIntoTheApp', async () => {
    vi.mocked(searchManual).mockResolvedValue([HOWTO]);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const [item] = await manualSource.search('immobile', { signal: new AbortController().signal });

    item.run?.();

    expect(item.to).toBeUndefined();
    expect(open).toHaveBeenCalledWith('/guida/immobili.html#aggiungere', '_blank', 'noopener,noreferrer');
  });
});
