import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AA_TEXT_CONTRAST, contrastRatio } from '@/lib/public-site-colors';
import { mixOklab, themeColor } from '@/test/colors';
import { Button } from '../button';

afterEach(cleanup);

const WHITE = '#ffffff';

describe('Button variants', () => {
  it('Button_ExistingVariants_KeepTheirClasses', () => {
    const expected: Record<string, string> = {
      default: 'bg-primary',
      destructive: 'bg-destructive',
      outline: 'border-input',
      secondary: 'bg-secondary',
      ghost: 'hover:bg-accent',
      link: 'underline-offset-4',
    };
    for (const [variant, className] of Object.entries(expected)) {
      const { unmount } = render(<Button variant={variant as 'default'}>{variant}</Button>);
      const button = screen.getByRole('button', { name: variant });
      expect(button, variant).toHaveClass(className);
      expect(button, variant).not.toHaveAttribute('aria-busy');
      expect(button, variant).not.toHaveAttribute('aria-disabled');
      unmount();
    }
  });

  it('Button_NoNewProps_RendersTheSameMarkupAsBefore', () => {
    const { container } = render(<Button>Salva</Button>);

    const button = container.firstElementChild as HTMLElement;
    expect(container.children).toHaveLength(1);
    expect(button.tagName).toBe('BUTTON');
    expect(button.childNodes).toHaveLength(1);
    expect(button).toHaveTextContent('Salva');
    expect(button).toBeEnabled();
  });

  it('Button_SoftVariant_IsTheAccentTintWithTheAccentText', () => {
    render(<Button variant="soft">Soft</Button>);

    const classes = screen.getByRole('button', { name: 'Soft' }).className;
    expect(classes).toContain('--color-primary-soft');
    expect(classes).toContain('--color-primary-text');
  });

  it('Button_DangerOutlineVariant_IsRedTextOnTheSurface', () => {
    render(<Button variant="danger-outline">Elimina</Button>);

    const button = screen.getByRole('button', { name: 'Elimina' });
    expect(button).toHaveClass('bg-background');
    expect(button.className).toContain('--color-danger-foreground');
  });

  it('Button_SoftAndDangerOutline_MeetAaWithTheFallbackColorsOfToday', () => {
    // Until the semantic tokens exist the colors derive from the tokens of globals.css. Text must be readable on the
    // normal and on the hover background.
    const primary = themeColor('primary');
    const destructive = themeColor('destructive');

    render(
      <>
        <Button variant="soft">Soft</Button>
        <Button variant="danger-outline">Danger</Button>
      </>,
    );
    const soft = screen.getByRole('button', { name: 'Soft' }).className;
    const percent = (pattern: RegExp) => Number(pattern.exec(soft)?.[1]);
    const softPercent = percent(/--color-primary-soft,color-mix\(in_oklab,var\(--color-primary\)_(\d+)%/);
    const hoverPercent = percent(/hover:bg-\[color:color-mix\(in_oklab,var\(--color-primary\)_(\d+)%/);

    expect(contrastRatio(primary, mixOklab(primary, softPercent, WHITE))).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    expect(contrastRatio(primary, mixOklab(primary, hoverPercent, WHITE))).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);

    const danger = screen.getByRole('button', { name: 'Danger' }).className;
    const dangerText = /--color-danger-foreground,(#[0-9a-f]{6})/.exec(danger)?.[1] ?? '';
    expect(contrastRatio(dangerText, WHITE)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    // hover:bg-destructive/10 = 10% of the destructive over the surface
    expect(contrastRatio(dangerText, mixOklab(destructive, 10, WHITE))).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
  });
});

describe('Button loading', () => {
  it('Button_Loading_ShowsASpinnerAndAnnouncesBusy', () => {
    render(<Button loading>Salvataggio...</Button>);

    const button = screen.getByRole('button', { name: 'Salvataggio...' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    const spinner = button.querySelector('svg');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
    expect(spinner).toHaveClass('animate-spin', 'motion-reduce:animate-none');
    // The spinner comes before the label.
    expect(button.firstElementChild).toBe(spinner);
  });

  it('Button_Loading_IgnoresTheClickButStaysFocusable', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Salva
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Salva' });
    const notCancelled = fireEvent.click(button);
    button.focus();

    expect(onClick).not.toHaveBeenCalled();
    expect(notCancelled).toBe(false);
    // Not `disabled`: the person who pressed it keeps the focus.
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
  });

  it('Button_Loading_DoesNotSubmitItsFormAgain', () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const { rerender } = render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading>
          Invia
        </Button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Invia' }));
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <form onSubmit={onSubmit}>
        <Button type="submit">Invia</Button>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Invia' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('Button_NotLoading_CallsOnClickAndHasNoBusyState', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salva</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('button').querySelector('svg')).toBeNull();
  });

  it('Button_Disabled_StillUsesTheNativeDisabledAttribute', () => {
    render(<Button disabled>Salva</Button>);

    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
  });

  it('Button_LoadingLink_IgnoresTheClickToo', () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter>
        <Button asChild loading onClick={onClick}>
          <Link to="/app/next">Continua</Link>
        </Button>
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'Continua' });
    const notCancelled = fireEvent.click(link);

    expect(link).toHaveAttribute('aria-busy', 'true');
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(onClick).not.toHaveBeenCalled();
    expect(notCancelled).toBe(false);
  });
});

describe('Button iconRight, block and asChild', () => {
  it('Button_IconRight_GoesAfterTheLabelAndIsHiddenFromAssistiveTechnology', () => {
    render(<Button iconRight={<ArrowRight data-testid="arrow" />}>Avanti</Button>);

    const button = screen.getByRole('button', { name: 'Avanti' });
    const arrow = screen.getByTestId('arrow');
    expect(arrow.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(button.lastElementChild).toContainElement(arrow);
    expect(button.textContent).toBe('Avanti');
  });

  it('Button_Block_TakesTheWholeWidth', () => {
    render(<Button block>Conferma</Button>);

    expect(screen.getByRole('button', { name: 'Conferma' })).toHaveClass('w-full');
  });

  it('Button_AsChildWithoutNewProps_RendersJustTheChild', () => {
    const { container } = render(
      <Button asChild variant="outline">
        <a href="/vai">Vai</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Vai' });
    expect(container.children).toHaveLength(1);
    expect(link).toHaveAttribute('href', '/vai');
    expect(link).toHaveClass('border-input');
    expect(link.childNodes).toHaveLength(1);
  });

  it('Button_AsChildWithIconRight_PutsTheIconInsideTheLink', () => {
    render(
      <MemoryRouter>
        <Button asChild iconRight={<ArrowRight data-testid="arrow" />}>
          <Link to="/app/next">Continua</Link>
        </Button>
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'Continua' });
    expect(link).toHaveAttribute('href', '/app/next');
    expect(link).toContainElement(screen.getByTestId('arrow'));
  });

  it('Button_Ref_PointsAtTheButton', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Salva</Button>);

    expect(ref.current).toBe(screen.getByRole('button', { name: 'Salva' }));
  });
});

describe('Button touch targets', () => {
  it('Button_Sizes_ReachFortyFourPixelsOnTouchScreens', () => {
    // Mouse and keyboard keep the heights they had (40, 36, 44, 40); only a coarse pointer raises them to 44 px.
    const { rerender } = render(<Button>Predefinito</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-10', 'pointer-coarse:min-h-11');

    rerender(<Button size="sm">Piccolo</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-9', 'pointer-coarse:min-h-11');

    rerender(<Button size="lg">Grande</Button>);
    expect(screen.getByRole('button')).toHaveClass('h-11');

    rerender(<Button size="icon" aria-label="Chiudi" />);
    expect(screen.getByRole('button')).toHaveClass('h-10', 'w-10', 'pointer-coarse:min-h-11', 'pointer-coarse:min-w-11');
  });
});
