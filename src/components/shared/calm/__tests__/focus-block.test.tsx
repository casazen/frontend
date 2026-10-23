import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { expectNoAxeViolations } from '@/test/axe';
import { CALM_TONES, TONE_STYLES, type CalmTone } from '../calm-tone';
import { FocusBlock, type FocusBlockProps } from '../focus-block';

const FULL: FocusBlockProps = {
  kicker: 'Adesso',
  title: 'Registra il contratto di Elisa Rossi',
  body: 'Scade tra due giorni: dopo si paga una sanzione.',
  who: 'Tocca a te',
  when: 'Circa 5 minuti',
  then: 'Poi: il conduttore riceve la copia',
  primary: { label: 'Registra ora', onClick: () => undefined },
  secondary: { label: 'Vedi il contratto', href: '/app/long-rent/contracts/1' },
};

function renderBlock(props: Partial<FocusBlockProps> = {}) {
  return render(
    <MemoryRouter>
      <FocusBlock {...FULL} {...props} />
    </MemoryRouter>,
  );
}

describe('FocusBlock (UI-16)', () => {
  afterEach(() => {
    cleanup();
  });

  it('FocusBlock_Default_IsARegionNamedByItsTitleAndItsTitleIsTheOnlyHeading', () => {
    renderBlock();

    const region = screen.getByRole('region', { name: 'Registra il contratto di Elisa Rossi' });
    const headings = within(region).getAllByRole('heading');
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName('Registra il contratto di Elisa Rossi');
    expect(headings[0].tagName).toBe('H2');
  });

  it('FocusBlock_Everything_ShowsExactlyTheWordsOfTheCallerAndNoFixedText', () => {
    renderBlock();

    const region = screen.getByRole('region');
    // In reading order. Nothing else: no "Poi:", no "Adesso", no label of the tone, no hidden text.
    expect(region.textContent).toBe(
      ['Adesso', 'Registra il contratto di Elisa Rossi', 'Scade tra due giorni: dopo si paga una sanzione.', 'Tocca a te', 'Circa 5 minuti', 'Poi: il conduttore riceve la copia', 'Registra ora', 'Vedi il contratto'].join(''),
    );
  });

  it('FocusBlock_OnlyTitleAndPrimary_ShowsNoEmptyParts', () => {
    const { container } = render(
      <MemoryRouter>
        <FocusBlock title="Niente di urgente" primary={{ label: 'Vedi i contratti', href: '/app/long-rent/contracts' }} />
      </MemoryRouter>,
    );

    expect(container.textContent).toBe('Niente di urgenteVedi i contratti');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('FocusBlock_WhoAndWhen_AreAListOfTwoWithAnIconEach', () => {
    renderBlock();

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Tocca a te', 'Circa 5 minuti']);
    for (const item of items) expect(item.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('FocusBlock_OnlyWhen_ShowsOnlyWhen', () => {
    renderBlock({ who: undefined });

    expect(within(screen.getByRole('list')).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Circa 5 minuti']);
  });

  it('FocusBlock_Tone_IsToldByTheTintAndByAnIconOfItsOwnNotOnlyByColor', () => {
    const icons = new Set<string>();
    for (const tone of CALM_TONES) {
      const { container, unmount } = renderBlock({ tone });
      const region = container.querySelector('section')!;

      expect(region).toHaveAttribute('data-tone', tone);
      for (const token of TONE_STYLES[tone].surface.split(' ')) expect(region).toHaveClass(token);
      const icon = region.querySelector('span[aria-hidden="true"] > svg');
      expect(icon, `${tone} has an icon`).not.toBeNull();
      icons.add(icon!.getAttribute('class')!.split(' ').find((name) => name.startsWith('lucide-'))!);
      unmount();
    }

    // Five tones, five different icons and five different tints.
    expect(icons.size).toBe(CALM_TONES.length);
    expect(new Set(CALM_TONES.map((tone) => TONE_STYLES[tone].surface)).size).toBe(CALM_TONES.length);
  });

  it('FocusBlock_Edge_SurvivesForcedColorsWhichDropTheTintAndTheRing', () => {
    const { container } = renderBlock();

    expect(container.querySelector('section')).toHaveClass('forced-colors:outline-1');
  });

  it('FocusBlock_NoTone_IsTheAccentOfTheArea', () => {
    const { container } = renderBlock();

    expect(container.querySelector('section')).toHaveAttribute('data-tone', 'neutral');
    expect(container.querySelector('section')).toHaveClass('bg-primary-soft');
  });

  it('FocusBlock_Icon_ReplacesTheIconOfTheTone', () => {
    const { container } = renderBlock({ tone: 'warning', icon: Wrench });

    expect(container.querySelector('svg.lucide-wrench')).not.toBeNull();
    expect(container.querySelector('svg.lucide-triangle-alert, svg.lucide-alert-triangle')).toBeNull();
  });

  it('FocusBlock_PrimaryAsAnAction_RunsIt', () => {
    const onClick = vi.fn();
    renderBlock({ primary: { label: 'Registra ora', onClick } });

    fireEvent.click(screen.getByRole('button', { name: 'Registra ora' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('FocusBlock_PrimaryLoading_IsBusyAndCannotBeSentTwice', () => {
    const onClick = vi.fn();
    renderBlock({ primary: { label: 'Invia il sollecito', onClick, loading: true } });

    const button = screen.getByRole('button', { name: 'Invia il sollecito' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('FocusBlock_PrimaryAsAPage_IsALinkAndSecondaryComesAfterItAsAnOutline', () => {
    renderBlock({ primary: { label: 'Vai al contratto', href: '/app/long-rent/contracts/1' }, secondary: { label: 'Più tardi', onClick: () => undefined } });

    const primary = screen.getByRole('link', { name: 'Vai al contratto' });
    const secondary = screen.getByRole('button', { name: 'Più tardi' });
    expect(primary).toHaveAttribute('href', '/app/long-rent/contracts/1');
    expect(primary).toHaveClass('bg-primary');
    expect(secondary).toHaveClass('border');
    expect(secondary).not.toHaveClass('bg-primary');
    // The main action first, in the order of reading and of the Tab key.
    expect(primary.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('FocusBlock_Actions_HaveAHitAreaOf44PxAndTakeTheWholeWidthOnAPhone', () => {
    renderBlock();

    for (const action of [screen.getByRole('button', { name: 'Registra ora' }), screen.getByRole('link', { name: 'Vedi il contratto' })]) {
      expect(action).toHaveClass('min-h-11', 'w-full', 'sm:w-auto');
    }
  });

  it('FocusBlock_LongWords_CanBreakInsteadOfPushingThePageSideways', () => {
    renderBlock({ title: 'Via_Francesco_Maria_Giuseppe_Montefeltro_della_Rovere_1234567890', body: 'Indirizzo_molto_molto_lungo_senza_spazi_che_non_entra' });

    expect(screen.getByRole('heading')).toHaveClass('break-words');
    expect(screen.getByText(/Indirizzo_molto/)).toHaveClass('break-words');
    expect(screen.getByRole('region')).toHaveClass('min-w-0');
  });

  it('FocusBlock_ExtraProps_GoToTheRegionButCannotTakeItsNameAway', () => {
    renderBlock({ 'data-testid': 'adesso', className: 'mt-4', 'aria-labelledby': 'altro' } as Partial<FocusBlockProps>);

    const region = screen.getByRole('region', { name: 'Registra il contratto di Elisa Rossi' });
    expect(screen.getByTestId('adesso')).toBe(region);
    expect(region).toHaveClass('mt-4');
  });

  it('FocusBlock_Children_AreNotAccepted', () => {
    render(
      <MemoryRouter>
        {/* @ts-expect-error a block has no children: they would be dropped without a word */}
        <FocusBlock {...FULL}>un testo</FocusBlock>
      </MemoryRouter>,
    );

    expect(screen.queryByText('un testo')).not.toBeInTheDocument();
  });

  it('FocusBlock_TwoBlocks_HaveDifferentNamesBecauseTheNameIsTheirOwnTitle', () => {
    render(
      <MemoryRouter>
        <FocusBlock {...FULL} title="Prima cosa" />
        <FocusBlock {...FULL} title="Seconda cosa" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('region', { name: 'Prima cosa' })).not.toBe(screen.getByRole('region', { name: 'Seconda cosa' }));
  });

  it.each(CALM_TONES.map((tone) => [tone] as [CalmTone]))('FocusBlock_Tone_%s_HasNoAxeViolations', async (tone) => {
    const { container } = renderBlock({ tone });

    await expectNoAxeViolations(container);
  });
});
