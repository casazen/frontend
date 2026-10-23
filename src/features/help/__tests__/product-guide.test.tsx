import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { ProductGuidePage } from '../product-guide-page';
import { GuideLink } from '../guide-link';

beforeEach(async () => { await i18n.changeLanguage('it'); });
afterEach(cleanup);

describe('Product guide', () => {
  it('searches instructions as well as titles and restores topics when cleared', () => {
    render(<ProductGuidePage />);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(11);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  WSKEY-no-match  ' } });
    expect(screen.getByRole('status')).toHaveTextContent('Nessun argomento trovato');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ricevuta del portale' } });
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Alloggiati e adempimenti' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alloggiati e adempimenti' })).toHaveAttribute('href', '#guide-compliance');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(11);
  });

  it('changes the content and search labels with the app language', async () => {
    render(<ProductGuidePage />);
    await act(() => i18n.changeLanguage('en'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('CasaZen guide');
    expect(screen.getByRole('searchbox', { name: 'Search the guide' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(11);
    expect(screen.getByText(/In the current workflow CasaZen prepares/)).toBeInTheDocument();
  });

  it('keeps the header link in the current work area', () => {
    render(<MemoryRouter><GuideLink contextKey="supplier" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Guida' })).toHaveAttribute('href', '/app/supplier/help');
  });
});
