import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import i18n from '@/i18n/config';
import { SeoDisclaimerFooter } from './seo-disclaimer-footer';
import { SeoContentLanguageNote } from './seo-content-language-note';

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('SeoDisclaimerFooter (#258 AC7, SE-05 A8-19 A8-27)', () => {
  it('SeoDisclaimerFooter_Italian_ShowsTheDateTheDisclaimerAndTheAiNoticeInItalian', () => {
    render(<SeoDisclaimerFooter lastRefreshedAt="2026-06-01T10:00:00Z" aiGenerated />);

    const footer = screen.getByTestId('seo-disclaimer-footer');
    expect(screen.getByTestId('seo-last-updated')).toHaveTextContent('Ultimo aggiornamento: 1 giugno 2026');
    expect(footer).toHaveTextContent('non consulenza legale');
    expect(screen.getByTestId('ai-content-notice')).toHaveTextContent(i18n.t('aiContentNotice.seo'));
    expect(screen.getByTestId('ai-content-notice')).toHaveAttribute('data-kind', 'seo');
  });

  it('SeoDisclaimerFooter_English_ShowsTheDateAndTheTextsInEnglish', async () => {
    await i18n.changeLanguage('en');

    render(<SeoDisclaimerFooter lastRefreshedAt="2026-06-01T10:00:00Z" aiGenerated />);

    expect(screen.getByTestId('seo-last-updated')).toHaveTextContent('Last updated: June 1, 2026');
    expect(screen.getByTestId('seo-disclaimer-footer')).toHaveTextContent('not legal advice');
    expect(screen.getByTestId('ai-content-notice')).toHaveTextContent('approved by a CasaZen administrator');
    expect(screen.getByTestId('seo-disclaimer-footer')).not.toHaveTextContent('Ultimo aggiornamento');
  });

  it('SeoDisclaimerFooter_DateInTheLateEveningUtc_IsTheDateInRome', () => {
    // 23:30 UTC of 24 September is already 25 September in Rome (QA-CLOCK-FE): the page says the Italian day.
    render(<SeoDisclaimerFooter lastRefreshedAt="2026-09-24T23:30:00Z" aiGenerated={false} />);

    expect(screen.getByTestId('seo-last-updated')).toHaveTextContent('25 settembre 2026');
  });

  it('SeoDisclaimerFooter_TextNotGeneratedByAi_ShowsNoAiNotice', () => {
    render(<SeoDisclaimerFooter lastRefreshedAt="2026-06-01T10:00:00Z" aiGenerated={false} />);

    expect(screen.queryByTestId('ai-content-notice')).not.toBeInTheDocument();
    expect(screen.getByTestId('seo-disclaimer-footer')).toHaveTextContent('non consulenza legale');
  });

  it('SeoDisclaimerFooter_NoRefreshDate_SaysTheDateIsNotAvailable', () => {
    render(<SeoDisclaimerFooter lastRefreshedAt={null} aiGenerated />);

    expect(screen.getByTestId('seo-last-updated')).toHaveTextContent('Data di aggiornamento non disponibile');
  });
});

describe('SeoContentLanguageNote (SE-05, A8-19)', () => {
  it('SeoContentLanguageNote_ItalianVisitor_ShowsNothing', () => {
    const { container } = render(<SeoContentLanguageNote contentLanguage="it" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('SeoContentLanguageNote_EnglishVisitorOnItalianText_SaysTheTextIsInItalian', async () => {
    await i18n.changeLanguage('en');

    render(<SeoContentLanguageNote contentLanguage="it" />);

    expect(screen.getByTestId('seo-content-language-note')).toHaveTextContent('only available in Italian');
  });

  it('SeoContentLanguageNote_TextInAnotherLanguage_ShowsNothingInsteadOfAWrongClaim', async () => {
    await i18n.changeLanguage('en');

    const { container } = render(<SeoContentLanguageNote contentLanguage="de" />);

    expect(container).toBeEmptyDOMElement();
  });
});
