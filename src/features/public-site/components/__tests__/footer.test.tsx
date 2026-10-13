import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { Footer } from '../Footer';

function renderFooter(props: Parameters<typeof Footer>[0]) {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Footer {...props} />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('Footer legal links (BK-14, A3-21)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(cleanup);

  it('Footer_OperatorSite_LinksToTheOperatorsOwnPagesInANewTab', () => {
    renderFooter({ displayName: 'Villa Parco', orgSlug: 'villa-parco' });

    const privacy = screen.getByTestId('footer-privacy');
    const terms = screen.getByTestId('footer-terms');
    expect(privacy).toHaveAttribute('href', '/book/villa-parco/privacy');
    expect(terms).toHaveAttribute('href', '/book/villa-parco/termini');
    expect(privacy).toHaveTextContent(i18n.t('publicSite.operatorPrivacy'));
    expect(terms).toHaveTextContent(i18n.t('publicSite.operatorTerms'));
    expect(privacy).toHaveAttribute('target', '_blank');
    expect(privacy).toHaveAttribute('rel', 'noopener noreferrer');
    // The CasaZen documents are not offered on the host's brand.
    expect(screen.queryByTestId('footer-legal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('footer-subprocessors')).not.toBeInTheDocument();
  });

  it('Footer_OperatorSiteWithSpecialCharactersInTheSlug_EncodesThePath', () => {
    renderFooter({ displayName: 'x', orgSlug: 'a b/c' });

    expect(screen.getByTestId('footer-privacy')).toHaveAttribute('href', '/book/a%20b%2Fc/privacy');
  });

  it('Footer_CasazenPublicPages_KeepTheCasazenLegalDocuments', () => {
    renderFooter({ displayName: 'CasaZen', showSeoHubLink: true });

    expect(screen.getByTestId('footer-privacy')).toHaveAttribute('href', '/legale/privacy');
    expect(screen.getByTestId('footer-terms')).toHaveAttribute('href', '/legale/termini');
    expect(screen.getByTestId('footer-privacy')).toHaveTextContent(i18n.t('publicSite.privacy'));
    expect(screen.getByTestId('footer-legal')).toBeInTheDocument();
  });

  it('Footer_SeoHubWithAnOrgSlug_StillShowsTheCasazenDocuments', () => {
    renderFooter({ displayName: 'CasaZen', showSeoHubLink: true, orgSlug: 'villa-parco' });

    expect(screen.getByTestId('footer-privacy')).toHaveAttribute('href', '/legale/privacy');
  });
});
