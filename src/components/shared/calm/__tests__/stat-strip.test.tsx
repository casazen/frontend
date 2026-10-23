import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { CALM_TONES } from '../calm-tone';
import { StatStrip, StatTile } from '../stat-strip';

function renderStrip(children: React.ReactNode, label?: string) {
  return render(
    <MemoryRouter>
      <StatStrip label={label}>{children}</StatStrip>
    </MemoryRouter>,
  );
}

const THREE = [
  <StatTile key="paid" label="Incassati a ottobre" value="3.600 €" delta="+6% su settembre" />,
  <StatTile key="late" label="In ritardo" value="1.200 €" tone="danger" href="/app/long-rent/rents?filter=late" />,
  <StatTile key="todo" label="Ancora da incassare" value={0} />,
];

describe('StatStrip and StatTile (UI-16)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    cleanup();
  });

  it('StatStrip_ThreeTiles_IsANamedGroupWithAListOfThree', () => {
    renderStrip(THREE, 'I canoni del mese');

    const group = screen.getByRole('group', { name: 'I canoni del mese' });
    expect(within(group).getAllByRole('listitem')).toHaveLength(3);
  });

  it('StatStrip_Tiles_ShowExactlyTheLabelTheValueAndTheDeltaOfTheCallerAndNoFixedText', () => {
    renderStrip(THREE);

    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Incassati a ottobre3.600 €+6% su settembre', 'In ritardo1.200 €', 'Ancora da incassare0']);
  });

  it('StatStrip_NoLabel_UsesTheCommonNameInTheLanguageOfTheApp', async () => {
    const { unmount } = renderStrip(THREE);
    expect(screen.getByRole('group', { name: 'In breve' })).toBeInTheDocument();
    unmount();

    await i18n.changeLanguage('en');
    renderStrip(THREE);
    expect(screen.getByRole('group', { name: 'At a glance' })).toBeInTheDocument();
  });

  it('StatTile_WithAnHref_IsTheWholeTileAsALinkAndNamedByWhatItShows', () => {
    renderStrip(THREE);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/app/long-rent/rents?filter=late');
    expect(link).toHaveAccessibleName(/^In ritardo\s?1\.200 €$/);
    // A link tile says so with a chevron, not only with the pointer.
    expect(link.querySelector('svg.lucide-chevron-right')).not.toBeNull();
    // The tiles without an href are not links.
    expect(screen.getAllByRole('listitem')[0].querySelector('a')).toBeNull();
  });

  it('StatTile_LinkWithAState_HandsItToThePageThatOpens', () => {
    render(
      <MemoryRouter initialEntries={['/start']}>
        <Routes>
          <Route
            path="/start"
            element={
              <StatStrip>
                <StatTile label="In ritardo" value={2} href="/app/long-rent/rents" state={{ filter: 'late' }} />
              </StatStrip>
            }
          />
          <Route path="*" element={<Arrived />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: /In ritardo/ }));

    expect(screen.getByTestId('arrived')).toHaveTextContent('{"filter":"late"}');
  });

  it('StatTile_Tone_AddsTheIconOfTheToneAndColorsTheNumberAndNeutralIsPlain', () => {
    renderStrip(CALM_TONES.map((tone) => <StatTile key={tone} label={`Numero ${tone}`} value={1} tone={tone} />));

    const items = screen.getAllByRole('listitem');
    // Neutral: no icon, the text color of the page. The others: an icon before the label and the color of the tone.
    expect(items[0].querySelector('svg')).toBeNull();
    expect(items[0].querySelector('.text-2xl')).toHaveClass('text-foreground');
    for (const [index, tone] of CALM_TONES.entries()) {
      if (tone === 'neutral') continue;
      expect(items[index].querySelector('svg'), tone).toHaveAttribute('aria-hidden', 'true');
      expect(items[index].querySelector('.text-2xl'), tone).toHaveClass(`text-${tone}-foreground`);
    }
  });

  it('StatStrip_ThreeFourOrTwoTiles_FillTheRowFromATabletOrALaptopAndStackOnAPhone', () => {
    const { unmount } = renderStrip(THREE);
    // Three tiles: three across from a tablet, not two and one alone on the next line.
    expect(screen.getByRole('list')).toHaveClass('grid-cols-1', 'sm:grid-cols-3');
    expect(screen.getByRole('list')).not.toHaveClass('sm:grid-cols-2');
    unmount();

    renderStrip([...THREE, <StatTile key="four" label="Quarto" value={4} />]);
    expect(screen.getByRole('list')).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4');
  });

  it('StatStrip_Tiles_AreSubgridsOfTheStripFromATablet', () => {
    renderStrip(THREE);

    // Three rows for each tile (name, number, delta): the item of the list is a subgrid of the strip, and the tile in it of the item.
    for (const item of screen.getAllByRole('listitem')) {
      expect(item).toHaveClass('sm:row-span-3', 'sm:grid', 'sm:grid-rows-subgrid', 'sm:*:row-span-3', 'sm:*:grid', 'sm:*:grid-rows-subgrid');
    }
    expect(screen.getByRole('list')).not.toHaveClass('lg:auto-rows-[auto_auto_auto_1fr]');
  });

  it('StatStrip_AListBesideTheTiles_TakesFourRowsFromALaptopAndTheTilesKeepTheirThree', () => {
    renderStrip([...THREE.slice(0, 2), <div key="list" data-testid="the-list">Prossimi arrivi</div>]);

    const [first, second, list] = screen.getAllByRole('listitem');
    for (const tile of [first, second]) {
      expect(tile).toHaveClass('lg:row-span-3', 'lg:grid', 'lg:grid-rows-subgrid');
      expect(tile).not.toHaveClass('sm:grid-rows-subgrid');
    }
    // The fourth row is the one that takes the room the list asks for; in two columns the strip is as it was.
    expect(list).toHaveClass('lg:row-span-4');
    expect(list).not.toHaveClass('sm:row-span-3');
    expect(screen.getByRole('list')).toHaveClass('lg:auto-rows-[auto_auto_auto_1fr]');
  });

  it('StatStrip_AtMostFourTiles_DoesNotWarn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderStrip([...THREE, <StatTile key="four" label="Quarto" value={4} />]);

    expect(warn).not.toHaveBeenCalled();
  });

  it('StatStrip_MoreThanFourTiles_WarnsInDevelopmentButStillShowsThem', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderStrip([...THREE, <StatTile key="four" label="Quarto" value={4} />, <StatTile key="five" label="Quinto" value={5} />]);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/StatStrip: 5 tiles.*at most 4/));
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('StatStrip_MoreThanFourTiles_StaysSilentInABuild', () => {
    vi.stubEnv('DEV', false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderStrip([...THREE, <StatTile key="four" label="Quarto" value={4} />, <StatTile key="five" label="Quinto" value={5} />]);

    expect(warn).not.toHaveBeenCalled();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('StatStrip_TilesInAFragmentAListAndBehindAFalseCondition_AreAllFoundAndCounted', () => {
    const hidden = false as boolean;
    renderStrip(
      <>
        <StatTile label="Uno" value={1} />
        {hidden && <StatTile label="Mai" value={0} />}
        {['Due', 'Tre'].map((name) => (
          <StatTile key={name} label={name} value={2} />
        ))}
      </>,
    );

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Uno1', 'Due2', 'Tre2']);
    expect(screen.getByRole('list')).toHaveClass('sm:grid-cols-3');
  });

  it('StatStrip_ATileThatGoes_DoesNotMakeTheOnesAfterItStartAgain', () => {
    const tiles = (names: string[]) => names.map((name) => <StatTile key={name} label={name} value={1} href={`/app/${name}`} />);
    const { rerender } = render(
      <MemoryRouter>
        <StatStrip>{tiles(['uno', 'due', 'tre'])}</StatStrip>
      </MemoryRouter>,
    );
    const third = screen.getByRole('link', { name: /tre/ });

    rerender(
      <MemoryRouter>
        <StatStrip>{tiles(['due', 'tre'])}</StatStrip>
      </MemoryRouter>,
    );

    // The same element, so a link that had the focus keeps it.
    expect(screen.getByRole('link', { name: /tre/ })).toBe(third);
  });

  it('StatStrip_NoTiles_RendersNothing', () => {
    const { container } = renderStrip(null);

    expect(container).toBeEmptyDOMElement();
  });

  it('StatTile_Alone_IsADivAndKeepsItsExtraProps', () => {
    render(<StatTile label="Aperte" value={5} data-testid="aperte" className="py-6" />);

    expect(screen.getByTestId('aperte').tagName).toBe('DIV');
    expect(screen.getByTestId('aperte')).toHaveClass('py-6');
  });

  it('StatTile_NotALink_TakesNoOnClickBecauseItIsNotAControl', () => {
    // The type is the guard (the line below must not compile): a tile that is clickable is a link, with an `href`.
    // @ts-expect-error a tile that is not a link is not a control: it takes no onClick
    const tile = <StatTile label="Chiuse" value={1} onClick={() => undefined} />;

    expect(tile.props.label).toBe('Chiuse');
  });

  it('StatTile_HoverUnderline_BelongsToTheLinkOfTheTileAndNotToAnyGroupAboveIt', () => {
    renderStrip(THREE);

    const [plain, linked] = [screen.getByText('Incassati a ottobre'), screen.getByText('In ritardo')];
    expect(plain.parentElement?.className).not.toMatch(/group-hover/);
    expect(linked.parentElement).toHaveClass('group-hover/tile:underline');
    expect(screen.getByRole('link')).toHaveClass('group/tile');
  });

  it('StatTile_LongLabelsAndValues_CanBreak', () => {
    render(<StatTile label="Un'etichetta_molto_molto_lunga_senza_spazi_che_non_entra_in_una_colonna" value="1.234.567.890,00 €" />);

    expect(screen.getByText(/etichetta_molto/)).toHaveClass('break-words', 'min-w-0');
    expect(screen.getByText('1.234.567.890,00 €')).toHaveClass('break-words');
  });

  it('StatStrip_WithEveryVariant_HasNoAxeViolations', async () => {
    const { container } = renderStrip(
      <>
        <StatTile label="Incassati" value="3.600 €" delta="+6% su settembre" />
        <StatTile label="In ritardo" value="1.200 €" tone="danger" href="/app/long-rent/rents" />
        <StatTile label="Da approvare" value={3} tone="warning" />
        <StatTile label="Positivo" value="87%" tone="success" />
      </>,
    );

    await expectNoAxeViolations(container);
  });
});

function Arrived() {
  return <p data-testid="arrived">{JSON.stringify(useLocation().state)}</p>;
}
