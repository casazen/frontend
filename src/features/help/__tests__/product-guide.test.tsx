import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { MemoryRouter } from 'react-router-dom';
import { ProductGuidePage } from '../product-guide-page';

beforeEach(async () => { await i18n.changeLanguage('it'); });
afterEach(cleanup);

describe('Product guide', () => {
  it('searches instructions as well as titles and restores topics when cleared', () => {
    render(<MemoryRouter initialEntries={['/app/short-rent/help']}><ProductGuidePage /></MemoryRouter>);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(11);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  WSKEY-no-match  ' } });
    expect(screen.getByRole('status')).toHaveTextContent('Nessun argomento trovato');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ricevuta del portale' } });
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Alloggiati e adempimenti' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alloggiati e adempimenti' })).toHaveAttribute('href', '/app/short-rent/help#guide-compliance');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(11);
  });

  it('changes the content and search labels with the app language', async () => {
    render(<MemoryRouter initialEntries={['/app/short-rent/help']}><ProductGuidePage /></MemoryRouter>);
    await act(() => i18n.changeLanguage('en'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('CasaZen guide');
    expect(screen.getByRole('searchbox', { name: 'Search the guide' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(11);
    fireEvent.click(screen.getByRole('link', { name: /Alloggiati/ }));
    expect(screen.getByText(/In the current workflow CasaZen prepares/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
    fireEvent.click(screen.getByRole('link', { name: 'Back to topics' }));
    expect(screen.getByRole('link', { name: /Alloggiati/ })).toHaveFocus();
  });
  // The way in from the header is the «Guida» panel now (its link to this page per area: `features/guide/__tests__/guide.test.tsx`).
});
