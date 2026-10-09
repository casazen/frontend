import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { contrastRatio } from '@/lib/public-site-colors';
import { fallbackColor, themeColor } from '@/test/colors';
import { Progress, Ring } from '../progress';

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

/** The fill (first child) is the only thing that moves. */
const fillOf = (bar: HTMLElement) => bar.firstElementChild as HTMLElement;

/** Every transition and animation class of the element must sit behind `motion-safe:`. */
function expectNoMotionWithoutPermission(element: Element) {
  const classes = (element.getAttribute('class') ?? '').split(/\s+/);
  const moving = classes.filter((c) => /(^|:)(transition|duration|ease|animate)/.test(c));
  expect(moving.length).toBeGreaterThan(0);
  for (const c of moving) expect(c.startsWith('motion-safe:'), c).toBe(true);
}

describe('Progress', () => {
  it('Progress_Value_IsAProgressbarWithItsRange', () => {
    render(<Progress value={40} label="Configurazione completata" />);

    const bar = screen.getByRole('progressbar', { name: 'Configurazione completata' });
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(fillOf(bar).style.width).toBe('40%');
  });

  it('Progress_NoLabel_UsesAGenericNameInTheLanguageOfTheUser', async () => {
    render(<Progress value={10} />);
    expect(screen.getByRole('progressbar', { name: 'Avanzamento' })).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(screen.getByRole('progressbar', { name: 'Progress' })).toBeInTheDocument();
  });

  it('Progress_ValueText_IsWhatAssistiveTechnologyReads', () => {
    render(<Progress value={33.3} label="Passi" valueText="Passo 2 di 6" />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuetext', 'Passo 2 di 6');
    expect(bar).toHaveAttribute('aria-valuenow', '33');
  });

  it.each([
    [-20, '0', '0%'],
    [0, '0', '0%'],
    [100, '100', '100%'],
    [250, '100', '100%'],
    [Number.NaN, '0', '0%'],
    [12.6, '13', '12.6%'],
  ])('Progress_Value_%s_IsClampedTo0And100', (value, now, width) => {
    render(<Progress value={value} label="Avanzamento" />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', now);
    expect(fillOf(bar).style.width).toBe(width);
  });

  it('Progress_Motion_OnlyWhenTheUserAllowsIt', () => {
    render(<Progress value={50} label="Avanzamento" />);

    expectNoMotionWithoutPermission(fillOf(screen.getByRole('progressbar')));
  });

  it('Progress_Sizes_AreEightAndSixPixels', () => {
    const { rerender } = render(<Progress value={50} label="Avanzamento" />);
    expect(screen.getByRole('progressbar')).toHaveClass('h-2');

    rerender(<Progress value={50} size="sm" label="Avanzamento" />);
    expect(screen.getByRole('progressbar')).toHaveClass('h-1.5');
  });

  it('Progress_Colors_TheFillIsReadableAgainstTheTrack', () => {
    const { rerender } = render(<Progress value={50} label="Avanzamento" />);
    const track = themeColor('muted');

    // Default: the primary of the area. 3:1 is the minimum for a graphic that carries information (WCAG 1.4.11).
    expect(fillOf(screen.getByRole('progressbar'))).toHaveClass('bg-primary');
    expect(contrastRatio(themeColor('primary'), track)).toBeGreaterThanOrEqual(3);

    rerender(<Progress value={50} tone="success" label="Avanzamento" />);
    const success = fallbackColor(fillOf(screen.getByRole('progressbar')).className, 'success');
    expect(contrastRatio(success, track)).toBeGreaterThanOrEqual(3);
  });

  it('Progress_ClassNameAndAria_AreTheCallers', () => {
    render(<Progress value={50} className="max-w-xs" aria-label="Il mio avanzamento" />);

    const bar = screen.getByRole('progressbar', { name: 'Il mio avanzamento' });
    expect(bar).toHaveClass('max-w-xs');
  });
});

describe('Ring', () => {
  it('Ring_Value_IsAProgressbarAndShowsThePercentage', () => {
    render(<Ring value={62} />);

    const ring = screen.getByRole('progressbar', { name: '62% completato' });
    expect(ring).toHaveAttribute('aria-valuenow', '62');
    expect(ring).toHaveAttribute('aria-valuemin', '0');
    expect(ring).toHaveAttribute('aria-valuemax', '100');
    // The number is drawn for the eyes; assistive technology already has the value.
    expect(screen.getByText('62%')).toHaveAttribute('aria-hidden', 'true');
    expect(ring.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Ring_Label_CanBeReplacedAndFollowsTheLanguage', async () => {
    const { rerender } = render(<Ring value={50} label="Checklist" />);
    expect(screen.getByRole('progressbar', { name: 'Checklist' })).toBeInTheDocument();

    rerender(<Ring value={50} />);
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(screen.getByRole('progressbar', { name: '50% complete' })).toBeInTheDocument();
  });

  it('Ring_Arc_IsDrawnWithTheRightLength', () => {
    const { rerender } = render(<Ring value={25} size={44} />);
    const circumference = 2 * Math.PI * ((44 - 5) / 2);

    let circles = screen.getByRole('progressbar').querySelectorAll('circle');
    expect(circles).toHaveLength(2);
    expect(Number(circles[1].getAttribute('stroke-dasharray'))).toBeCloseTo(circumference, 3);
    expect(Number(circles[1].getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * 0.75, 3);

    rerender(<Ring value={100} size={44} />);
    circles = screen.getByRole('progressbar').querySelectorAll('circle');
    expect(Number(circles[1].getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
  });

  it('Ring_Zero_DrawsOnlyTheTrackNotADot', () => {
    render(<Ring value={0} />);

    expect(screen.getByRole('progressbar').querySelectorAll('circle')).toHaveLength(1);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it.each([
    [-5, '0'],
    [180, '100'],
    [Number.NaN, '0'],
  ])('Ring_Value_%s_IsClamped', (value, now) => {
    render(<Ring value={value} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', now);
  });

  it('Ring_Size_SetsTheBox', () => {
    render(<Ring value={50} size={64} />);

    const ring = screen.getByRole('progressbar');
    expect(ring.style.width).toBe('64px');
    expect(ring.style.height).toBe('64px');
    expect(ring.querySelector('svg')).toHaveAttribute('viewBox', '0 0 64 64');
  });

  it('Ring_Motion_OnlyWhenTheUserAllowsIt', () => {
    render(<Ring value={50} />);

    expectNoMotionWithoutPermission(screen.getByRole('progressbar').querySelectorAll('circle')[1]);
  });
});
