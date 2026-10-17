import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Info } from 'lucide-react';
import { createSiteI18n } from '../site-i18n';
import { SiteApp } from '../site-app';
import { SITE_PAGES } from '../site-pages';
import { BulletList, CardGrid, FeatureCard, Steps } from '../components/site-blocks';

/** The rows of a card: `sm:row-span-3` and `md:row-span-3` are the cards that are subgrids of their grid. */
const ROW_SPAN = /(?:sm|md):row-span-(\d)/;

function dom(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

function rowsOf(card: Element): number | null {
  const match = ROW_SPAN.exec(card.getAttribute('class') ?? '');
  return match ? Number(match[1]) : null;
}

describe('cards that line up (the subgrid cards of the public site)', () => {
  it('FeatureCard_IconTitleAndText_HasThreeRows', () => {
    const root = dom(renderToString(<FeatureCard icon={Info} title="Titolo" text="Testo" />));
    const card = root.firstElementChild!;

    expect(rowsOf(card)).toBe(3);
    expect(card.children).toHaveLength(3);
  });

  it('FeatureCard_WithAList_HasAFourthRowForIt', () => {
    const root = dom(renderToString(<FeatureCard icon={Info} title="Titolo" text="Testo" heading="h2"><BulletList items={['uno', 'due']} /></FeatureCard>));
    const card = root.firstElementChild!;

    expect(rowsOf(card)).toBe(4);
    expect(card.children).toHaveLength(4);
    expect(card.children[3].querySelector('ul')).not.toBeNull();
  });

  it('FeatureCard_ExtraWithNothingInIt_KeepsTheRowOfItsNeighbours', () => {
    const root = dom(renderToString(<FeatureCard icon={Info} title="Titolo" text="Testo" extra>{null}</FeatureCard>));
    const card = root.firstElementChild!;

    expect(rowsOf(card)).toBe(4);
    expect(card.children).toHaveLength(4);
    expect(card.children[3].textContent).toBe('');
  });

  it('FeatureCard_IsAPlainColumnInASingleColumnGrid', () => {
    const root = dom(renderToString(<FeatureCard icon={Info} title="Titolo" text="Testo" />));
    const classes = root.firstElementChild!.getAttribute('class')!.split(' ');

    // `flex flex-col` below `sm`, the subgrid from there: with one column there is nothing to line up with.
    expect(classes).toContain('flex');
    expect(classes).toContain('sm:grid');
    expect(classes).toContain('sm:grid-rows-subgrid');
  });

  it('Steps_WithTitles_HaveThreeRowsAndWithoutTwo', () => {
    const titled = dom(renderToString(<Steps items={[{ title: 'Uno', text: 'a' }, { title: 'Due', text: 'b' }]} />));
    const plain = dom(renderToString(<Steps items={[{ text: 'a' }, { text: 'b' }]} />));

    for (const card of titled.querySelectorAll('li')) {
      expect(rowsOf(card)).toBe(3);
      expect(card.children).toHaveLength(3);
    }
    for (const card of plain.querySelectorAll('li')) {
      expect(rowsOf(card)).toBe(2);
      expect(card.children).toHaveLength(2);
    }
  });

  it('Steps_OneWithoutATitleAmongOthers_KeepsTheRowEmpty', () => {
    const root = dom(renderToString(<Steps items={[{ title: 'Uno', text: 'a' }, { text: 'b' }]} />));
    const [first, second] = Array.from(root.querySelectorAll('li'));

    expect(rowsOf(first)).toBe(3);
    expect(rowsOf(second)).toBe(3);
    expect(second.children).toHaveLength(3);
  });

  it('CardGrid_Cards_AreItsDirectChildren', () => {
    const root = dom(
      renderToString(
        <CardGrid>
          <FeatureCard icon={Info} title="Uno" text="a" />
          <FeatureCard icon={Info} title="Due" text="b" />
        </CardGrid>,
      ),
    );

    // A subgrid takes its rows from its parent: nothing may stand between the card and the grid.
    expect(Array.from(root.firstElementChild!.children).every((card) => rowsOf(card) === 3)).toBe(true);
  });

  it.each(SITE_PAGES.map((page) => page.id))('render_%s_theCardsOfAGridHaveTheSameRowsAndOneChildForEach', (page) => {
    const html = renderToString(
      <SiteApp page={page} i18n={createSiteI18n('it')} legal={{ name: null, vatId: null, address: null, email: 'info@example.com' }} year={2026} />,
    );
    const root = dom(html);
    const cards = Array.from(root.querySelectorAll('[class*="row-span-"]'));
    expect(cards.length).toBeGreaterThan(0);

    // The cards of a grid take the same number of rows, else the ones with fewer end higher; and each child is a row.
    const grids = new Set(cards.map((card) => card.parentElement!));
    for (const grid of grids) {
      const spans = Array.from(grid.children).map(rowsOf);
      expect(new Set(spans).size, `${page}: ${spans.join(',')}`).toBe(1);
    }
    for (const card of cards) {
      expect(card.children.length, `${page}: ${card.textContent?.slice(0, 30)}`).toBe(rowsOf(card));
    }
  });
});
