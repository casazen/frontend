import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { ServicePreviewCard, type ServicePreviewCardProps } from '../service-preview-card';

const PROPS: ServicePreviewCardProps = {
  name: 'Pulizia cambio ospiti',
  summary: 'La casa pronta per il prossimo ospite.',
  categoryLabel: 'Pulizie',
  priceLabel: 'da 45 € a intervento',
  durationLabel: '2 h',
  includesVat: false,
  supplementCount: 0,
  photoUrl: 'https://cdn.example/a.jpg',
};

function renderCard(props: Partial<ServicePreviewCardProps> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ServicePreviewCard {...PROPS} {...props} />
    </I18nextProvider>,
  );
}

describe('ServicePreviewCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('ServicePreviewCard_FullService_ShowsCoverNameLinePriceAndDuration', () => {
    renderCard();

    expect(screen.getByRole('article', { name: 'Anteprima: come lo vedono i clienti' })).toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/a.jpg');
    expect(screen.getByTestId('service-preview-name')).toHaveTextContent('Pulizia cambio ospiti');
    expect(screen.getByTestId('service-preview-summary')).toHaveTextContent('La casa pronta per il prossimo ospite.');
    expect(screen.getByTestId('service-preview-price')).toHaveTextContent('da 45 € a intervento');
    expect(screen.getByTestId('service-preview-price')).toHaveTextContent('2 h');
    expect(screen.getByText('Pulizie')).toBeInTheDocument();
  });

  it('ServicePreviewCard_VatNotDeclared_SaysNothingAboutVat', () => {
    renderCard({ includesVat: false, supplementCount: 0 });

    // Nothing is promised that the supplier did not declare (D4): no note at all.
    expect(screen.queryByTestId('service-preview-notes')).not.toBeInTheDocument();
    expect(screen.queryByText(/IVA/)).not.toBeInTheDocument();
  });

  it('ServicePreviewCard_VatDeclaredAndSupplements_SaysBothInOneLine', () => {
    renderCard({ includesVat: true, supplementCount: 2 });

    expect(screen.getByTestId('service-preview-notes')).toHaveTextContent('IVA inclusa · 2 supplementi');
  });

  it('ServicePreviewCard_OneSupplement_IsSingular', () => {
    renderCard({ includesVat: false, supplementCount: 1 });

    expect(screen.getByTestId('service-preview-notes')).toHaveTextContent('1 supplemento');
    expect(screen.getByTestId('service-preview-notes')).not.toHaveTextContent('supplementi');
  });

  it('ServicePreviewCard_NothingTypedYet_ShowsPlaceholdersAndNoPhoto', () => {
    renderCard({ name: '  ', summary: '', categoryLabel: undefined, photoUrl: null, priceLabel: 'Prezzo da indicare', durationLabel: 'Durata da indicare' });

    expect(screen.getByTestId('service-preview-name')).toHaveTextContent('Il nome del servizio');
    expect(screen.getByTestId('service-preview-summary')).toHaveTextContent('Una riga che spiega il servizio');
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('Nessuna foto')).toBeInTheDocument();
  });

  it('ServicePreviewCard_PhotoThatCannotBeShown_IsNotAnImage', () => {
    renderCard({ photoUrl: '/uploads/old.jpg' });

    expect(document.querySelector('img')).toBeNull();
  });

  it('ServicePreviewCard_English_IsInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderCard({ name: '', photoUrl: null, includesVat: true, supplementCount: 3 });

    expect(screen.getByRole('article', { name: 'Preview: how customers see it' })).toBeInTheDocument();
    expect(screen.getByTestId('service-preview-name')).toHaveTextContent('The name of the service');
    expect(screen.getByTestId('service-preview-notes')).toHaveTextContent('VAT included · 3 supplements');
  });

  it('ServicePreviewCard_Markup_HasNoAccessibilityViolation', async () => {
    const { container } = renderCard({ includesVat: true, supplementCount: 2 });

    await expectNoAxeViolations(container);
  });
});
