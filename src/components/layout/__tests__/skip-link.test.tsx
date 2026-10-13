import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { SkipLink } from '../skip-link';

describe('SkipLink', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('SkipLink_Rendered_PointsToTheContentAndSaysItInTheLanguageOfTheUi', async () => {
    render(<SkipLink targetId="main-content" />);

    const link = screen.getByRole('link', { name: 'Vai al contenuto' });
    expect(link).toHaveAttribute('href', '#main-content');

    await i18n.changeLanguage('en');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument();
  });

  it('SkipLink_Rendered_IsOffTheScreenUntilItHasTheFocus', () => {
    render(<SkipLink targetId="main-content" />);

    const link = screen.getByRole('link', { name: 'Vai al contenuto' });
    expect(link).toHaveClass('fixed', 'focus:top-3');
    expect(link.className).toContain('top-[-6rem]');
  });

  it('SkipLink_Clicked_FocusesTheContentWithoutChangingTheAddress', () => {
    render(
      <>
        <SkipLink targetId="main-content" />
        <main id="main-content" tabIndex={-1}>
          pagina
        </main>
      </>,
    );
    const link = screen.getByRole('link', { name: 'Vai al contenuto' });
    const click = createEvent.click(link);

    fireEvent(link, click);

    expect(screen.getByRole('main')).toHaveFocus();
    // Left to the browser, the link would add `#main-content` to the address and to the history.
    expect(click.defaultPrevented).toBe(true);
  });

  it('SkipLink_TargetMissing_LeavesTheDefaultBehaviour', () => {
    render(<SkipLink targetId="nowhere" />);
    const link = screen.getByRole('link', { name: 'Vai al contenuto' });
    const click = createEvent.click(link);

    fireEvent(link, click);

    expect(click.defaultPrevented).toBe(false);
  });
});
