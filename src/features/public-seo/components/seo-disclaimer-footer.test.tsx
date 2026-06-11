import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SeoDisclaimerFooter } from './seo-disclaimer-footer';

afterEach(() => {
  cleanup();
});

describe('SeoDisclaimerFooter (#258 AC7)', () => {
  const disclaimers = {
    lastUpdated: 'Ultimo aggiornamento: 1 giugno 2026',
    notLegalAdvice:
      "Informazione generale, non consulenza legale. L'host resta responsabile degli adempimenti.",
    aiGenerated: 'Contenuto generato con AI — verifica le fonti ufficiali',
  };

  it('renders all three disclaimer lines', () => {
    render(<SeoDisclaimerFooter disclaimers={disclaimers} />);

    const footer = screen.getByTestId('seo-disclaimer-footer');
    expect(footer).toHaveTextContent(disclaimers.lastUpdated);
    expect(footer).toHaveTextContent('non consulenza legale');
    expect(footer).toHaveTextContent('Contenuto generato con AI');
  });
});
