import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { ManualHint } from '../manual-hint';

function renderHint(anchor?: string) {
  return render(
    <MemoryRouter>
      <p>
        QR di benvenuto{' '}
        <ManualHint page="immobili" anchor={anchor} title="QR di benvenuto">
          Stampa il cartello e mettilo in casa.
        </ManualHint>
      </p>
    </MemoryRouter>,
  );
}

describe('ManualHint', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('ManualHint_Default_IsAButtonNamedAfterWhatItExplains', () => {
    renderHint();

    expect(screen.getByRole('button', { name: "Cos'è: QR di benvenuto" })).toBeInTheDocument();
  });

  it('ManualHint_Opened_ShowsTheSentenceAndALinkToTheSectionOfTheManual', () => {
    renderHint('stampare-il-codice-qr');
    fireEvent.click(screen.getByRole('button', { name: "Cos'è: QR di benvenuto" }));

    expect(screen.getByText('Stampa il cartello e mettilo in casa.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Apri nel manuale' });
    expect(link).toHaveAttribute('href', '/guida/immobili.html#stampare-il-codice-qr');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('ManualHint_WithoutASection_OpensThePageOfTheManual', () => {
    renderHint();
    fireEvent.click(screen.getByRole('button', { name: "Cos'è: QR di benvenuto" }));

    expect(screen.getByRole('link', { name: 'Apri nel manuale' })).toHaveAttribute('href', '/guida/immobili.html');
  });

  it('ManualHint_InEnglish_TheLinkIsInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderHint('stampare-il-codice-qr');
    fireEvent.click(screen.getByRole('button', { name: 'About: QR di benvenuto' }));

    expect(screen.getByRole('link', { name: 'Open in the manual' })).toBeInTheDocument();
  });
});
