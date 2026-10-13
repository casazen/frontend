import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Hero } from '../Hero';

describe('Hero (BK-13)', () => {
  afterEach(cleanup);

  it('Hero_WithImage_ShowsThePhotoWithTheCaptionOnItsDarkBand', () => {
    const { container } = render(<Hero imageUrl="https://cdn.test/hero.jpg" title="Villa Mare" tagline="Sul mare" />);

    expect(screen.getByTestId('public-hero')).toHaveAttribute('data-hero-variant', 'image');
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/hero.jpg');
    expect(container.querySelector('.public-hero-caption')).toContainElement(screen.getByRole('heading', { name: 'Villa Mare' }));
    expect(container.querySelector('.public-hero-caption')).toContainElement(screen.getByText('Sul mare'));
  });

  it('Hero_WithoutImage_IsThePrimaryColorWithTheTextColorChosenForIt', () => {
    const { container } = render(<Hero title="Villa Mare" ctaLabel="Scopri" onCta={vi.fn()} />);

    expect(screen.getByTestId('public-hero')).toHaveAttribute('data-hero-variant', 'plain');
    expect(container.querySelector('img')).toBeNull();
    // No dark band: the text sits on the primary fill and uses --cz-public-on-primary (inherited from the frame).
    expect(container.querySelector('.public-hero-caption')).toBeNull();
    expect(container.querySelector('.public-hero-frame')).toContainElement(screen.getByRole('heading', { name: 'Villa Mare' }));
    // The call to action is inverted, otherwise a primary button would vanish on the primary fill.
    expect(screen.getByRole('button', { name: 'Scopri' })).toHaveClass('public-site-cta-inverse');
  });

  it('Hero_WithImage_CtaIsThePrimaryButtonAndCallsBack', () => {
    const onCta = vi.fn();
    render(<Hero imageUrl="https://cdn.test/hero.jpg" title="Villa Mare" ctaLabel="Scopri" onCta={onCta} />);

    const cta = screen.getByRole('button', { name: 'Scopri' });
    expect(cta).toHaveClass('public-site-cta');
    fireEvent.click(cta);
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it('Hero_NoCtaHandler_RendersNoButton', () => {
    render(<Hero title="Villa Mare" ctaLabel="Scopri" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
