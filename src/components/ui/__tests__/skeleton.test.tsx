import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { Skeleton, SkeletonCard, SkeletonLine, SkeletonList, SkeletonTable } from '../skeleton';

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

/** The pulsing blocks of a preset (everything that is a `Skeleton`). */
const blocksOf = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('.animate-pulse'));

describe('Skeleton', () => {
  it('Skeleton_Base_IsUnchanged', () => {
    render(<Skeleton data-testid="s" className="h-10 w-full" />);

    expect(screen.getByTestId('s')).toHaveClass('animate-pulse', 'rounded-md', 'bg-muted', 'h-10', 'w-full');
  });
});

describe('Skeleton presets', () => {
  const presets: Array<[string, (label?: string) => ReactElement]> = [
    ['SkeletonLine', (label) => <SkeletonLine lines={2} label={label} />],
    ['SkeletonCard', (label) => <SkeletonCard label={label} />],
    ['SkeletonTable', (label) => <SkeletonTable label={label} />],
    ['SkeletonList', (label) => <SkeletonList label={label} />],
  ];

  it.each(presets)('%s_Loading_IsOneStatusRegionAnnouncedOnce', (_name, make) => {
    render(make());

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent('Caricamento...');
    // The placeholders are drawn for the eyes only.
    for (const block of blocksOf(region)) expect(block.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it.each(presets)('%s_Motion_StopsWhenTheUserAsksForReducedMotion', (_name, make) => {
    render(make());

    const blocks = blocksOf(screen.getByRole('status'));
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) expect(block).toHaveClass('motion-reduce:animate-none');
  });

  it.each(presets)('%s_Label_CanSayWhatIsLoading', (_name, make) => {
    render(make('Caricamento prenotazioni...'));

    expect(screen.getByRole('status')).toHaveTextContent('Caricamento prenotazioni...');
    expect(screen.getByRole('status')).not.toHaveTextContent('Caricamento...');
  });

  it('SkeletonPresets_NoLabel_FollowTheLanguage', async () => {
    render(<SkeletonList />);
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    expect(screen.getByRole('status')).toHaveTextContent(i18n.getFixedT('en')('shared.loading.srOnly'));
  });
});

describe('SkeletonLine', () => {
  it('SkeletonLine_Lines_AreAsManyAsAskedAndTheLastIsShorter', () => {
    render(<SkeletonLine lines={3} />);

    const lines = blocksOf(screen.getByRole('status'));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toHaveClass('w-full');
    expect(lines[2]).toHaveClass('w-2/3');
  });

  it('SkeletonLine_Default_IsOneFullWidthLine', () => {
    render(<SkeletonLine />);

    const lines = blocksOf(screen.getByRole('status'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveClass('h-3', 'w-full');
  });

  it('SkeletonLine_LineClassName_CanStandInForAField', () => {
    render(<SkeletonLine lineClassName="h-10" className="max-w-sm" />);

    expect(blocksOf(screen.getByRole('status'))[0]).toHaveClass('h-10');
    expect(screen.getByRole('status')).toHaveClass('max-w-sm');
  });
});

describe('SkeletonCard', () => {
  it('SkeletonCard_Default_IsATitleAndThreeLines', () => {
    render(<SkeletonCard />);

    expect(blocksOf(screen.getByRole('status'))).toHaveLength(4);
  });

  it('SkeletonCard_Media_AddsAnImageBlock', () => {
    render(<SkeletonCard lines={2} media />);

    const blocks = blocksOf(screen.getByRole('status'));
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toHaveClass('h-32', 'w-full');
  });
});

describe('SkeletonTable', () => {
  it('SkeletonTable_RowsAndColumns_MakeAHeaderAndTheBody', () => {
    render(<SkeletonTable rows={3} columns={5} />);

    expect(blocksOf(screen.getByRole('status'))).toHaveLength((3 + 1) * 5);
    const grids = Array.from(screen.getByRole('status').querySelectorAll<HTMLElement>('[style]'));
    expect(grids).toHaveLength(4);
    for (const grid of grids) expect(grid.style.gridTemplateColumns).toBe('repeat(5, minmax(0, 1fr))');
  });

  it('SkeletonTable_Defaults_AreFiveRowsOfFour', () => {
    render(<SkeletonTable />);

    expect(blocksOf(screen.getByRole('status'))).toHaveLength(6 * 4);
  });
});

describe('SkeletonList', () => {
  it('SkeletonList_Items_AreAnAvatarAndTwoLinesEach', () => {
    render(<SkeletonList items={3} />);

    const blocks = blocksOf(screen.getByRole('status'));
    expect(blocks).toHaveLength(9);
    expect(blocks.filter((b) => b.classList.contains('rounded-full'))).toHaveLength(3);
  });
});
