import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AlignedCard } from '../card';

afterEach(cleanup);

describe('AlignedCard', () => {
  it('AlignedCard_Default_IsASubgridOfItsGridAtEveryWidth', () => {
    render(
      <AlignedCard rows={4} data-testid="card" className="extra">
        <div>title</div>
      </AlignedCard>,
    );

    const card = screen.getByTestId('card');
    expect(card).toHaveClass('grid', 'grid-rows-subgrid', 'gap-y-0', 'row-span-4', 'p-6', 'extra');
    expect(card).not.toHaveClass('flex');
  });

  it.each([
    ['sm', 'sm:grid', 'sm:grid-rows-subgrid'],
    ['md', 'md:grid', 'md:grid-rows-subgrid'],
    ['lg', 'lg:grid', 'lg:grid-rows-subgrid'],
  ] as const)('AlignedCard_From%s_IsAPlainColumnBelowItAndASubgridFromIt', (from, grid, subgrid) => {
    render(
      <AlignedCard rows={3} from={from} data-testid="card" style={{ color: 'red' }}>
        <div>title</div>
      </AlignedCard>,
    );

    const card = screen.getByTestId('card');
    // Below the width: `flex flex-col`; from it: the subgrid, over as many rows as the card has.
    expect(card).toHaveClass('flex', 'flex-col', grid, subgrid, `${from}:gap-y-0`, `${from}:[grid-row:span_var(--aligned-rows)]`);
    expect(card).not.toHaveClass('grid-rows-subgrid');
    expect(card.style.getPropertyValue('--aligned-rows')).toBe('3');
    // The style of the caller is kept.
    expect(card.style.color).toBe('red');
  });
});
