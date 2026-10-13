import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { trackSeoEvent } from '@/lib/seo-events';
import { SeoCtaBlock } from './seo-cta-block';

vi.mock('@/lib/seo-events', () => ({ trackSeoEvent: vi.fn(() => true) }));

beforeEach(() => {
  vi.mocked(trackSeoEvent).mockClear();
  window.sessionStorage.clear();
});

afterEach(() => cleanup());

describe('SeoCtaBlock (SE-04, #300 AC8)', () => {
  it('SeoCtaBlock_ClickOnTheCta_CountsTheClickForTheComuneAndKeepsTheLink', () => {
    render(
      <MemoryRouter initialEntries={['/p/affitti-brevi/lombardia/como']}>
        <SeoCtaBlock cta={{ signupUrl: '/signup?comune=como&utm_source=seo-compliance&utm_medium=cta' }} comuneName="Como" comuneSlug="como" />
      </MemoryRouter>,
    );

    const link = screen.getByTestId('seo-cta-signup');
    expect(link).toHaveAttribute('href', expect.stringContaining('/signup?comune=como'));
    // The click must not be cancelled: the browser still follows the link.
    const notPrevented = fireEvent.click(link);

    expect(notPrevented).toBe(true);
    expect(trackSeoEvent).toHaveBeenCalledTimes(1);
    expect(trackSeoEvent).toHaveBeenCalledWith('cta_click', 'como');
  });

  it('SeoCtaBlock_NoClick_CountsNothing', () => {
    render(
      <MemoryRouter>
        <SeoCtaBlock cta={{ signupUrl: '/signup?comune=como' }} comuneName="Como" comuneSlug="como" />
      </MemoryRouter>,
    );

    expect(trackSeoEvent).not.toHaveBeenCalled();
  });
});
