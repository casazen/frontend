import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SeoPagePublic } from '@/types/seo.types';
import { ComplianceGuidePage } from './compliance-guide-page';
import { TouristTaxCalculatorPage } from './tourist-tax-calculator-page';

// A8-08: a body that slipped past the backend must still be neutralised before dangerouslySetInnerHTML.
const { page } = vi.hoisted(() => {
  const bodyHtml =
    '<h2>Guida Como</h2><img src=x onerror=alert(1)><svg/onload=alert(1)>' +
    '<ul><li ONCLICK="alert(1)">CIN</li></ul>' +
    '<p><a href="&#106;avascript:alert(1)">trappola</a> <a href="https://www.example.com/cin">fonte</a></p>' +
    '<iframe src="https://evil.example"></iframe><style>body{display:none}</style>';

  const page: SeoPagePublic = {
    id: 'page-1',
    pageType: 'ComplianceGuide',
    title: 'Affitti brevi a Como',
    metaDescription: 'Guida',
    bodyHtml,
    comuneName: 'Como',
    comuneCode: '013075',
    regionCode: 'LOM',
    regionSlug: 'lombardia',
    comuneSlug: 'como',
    canonicalUrl: 'https://example.test/p/affitti-brevi/lombardia/como',
    lastRefreshedAt: null,
    disclaimers: { lastUpdated: 'u', notLegalAdvice: 'n', aiGenerated: 'a' },
    cta: { complianceCheckerUrl: '/tools/verifica-conformita', signupUrl: '/signup' },
    touristTaxRate: null,
  };
  return { page };
});

vi.mock('@/queries/use-public-seo', () => ({
  useComplianceGuide: () => ({ data: page, isLoading: false, isError: false }),
  useTouristTaxPage: () => ({ data: page, isLoading: false, isError: false }),
  useCalculateTouristTax: () => ({ mutateAsync: vi.fn(), data: undefined, isPending: false }),
}));

afterEach(() => {
  cleanup();
});

function expectSanitizedBody(body: HTMLElement) {
  expect(body.querySelector('img, svg, iframe, style, script')).toBeNull();
  for (const el of Array.from(body.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
    }
  }

  // Legitimate editorial content survives.
  expect(body.querySelector('h2')).toHaveTextContent('Guida Como');
  expect(body.querySelector('ul > li')).toHaveTextContent('CIN');
  const links = Array.from(body.querySelectorAll('a'));
  expect(links).toHaveLength(2);
  expect(links[0]).not.toHaveAttribute('href');
  expect(links[0]).toHaveTextContent('trappola');
  expect(links[1]).toHaveAttribute('href', 'https://www.example.com/cin');
  expect(links[1]).toHaveAttribute('rel', 'noopener noreferrer');
}

describe('public SEO pages render the body through the allowlist sanitizer', () => {
  it('ComplianceGuidePage_MaliciousBodyHtml_RendersOnlyAllowlistedMarkup', () => {
    render(
      <MemoryRouter initialEntries={['/p/affitti-brevi/lombardia/como']}>
        <Routes>
          <Route path="/p/affitti-brevi/:region/:comune" element={<ComplianceGuidePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expectSanitizedBody(screen.getByTestId('compliance-guide-body'));
  });

  it('TouristTaxCalculatorPage_MaliciousBodyHtml_RendersOnlyAllowlistedMarkup', () => {
    render(
      <MemoryRouter initialEntries={['/p/tassa-soggiorno/como']}>
        <Routes>
          <Route path="/p/tassa-soggiorno/:comune" element={<TouristTaxCalculatorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expectSanitizedBody(screen.getByTestId('tourist-tax-page-body'));
  });
});
