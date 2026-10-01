import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_CONTENT_MAX_LENGTH,
  checkDocumentText,
  checkDocumentUrl,
  checkSiteDocumentForm,
  normalizeDocumentText,
} from '../site-documents-rules';

describe('normalizeDocumentText', () => {
  it('normalizeDocumentText_MessyText_UnifiesBreaksDropsControlCharsAndCollapsesBlankLines', () => {
    expect(normalizeDocumentText('\r\n  Titolare: Mario Rossi\r\rVia Roma 1\u0007\n\n\n\n\nFine   ')).toBe(
      'Titolare: Mario Rossi\n\nVia Roma 1\n\nFine',
    );
  });
});

describe('checkDocumentText', () => {
  it.each(['', '   \n ', '\u0001'])('checkDocumentText_Empty_%j_ReturnsRequired', (text) => {
    expect(checkDocumentText(text)).toBe('siteDocuments.errors.contentRequired');
  });

  it('checkDocumentText_ExactlyTheLimit_IsAccepted', () => {
    expect(checkDocumentText('a'.repeat(DOCUMENT_CONTENT_MAX_LENGTH))).toBeNull();
  });

  it('checkDocumentText_OverTheLimit_ReturnsTooLong', () => {
    expect(checkDocumentText('a'.repeat(DOCUMENT_CONTENT_MAX_LENGTH + 1))).toBe('siteDocuments.errors.contentTooLong');
  });

  it.each([
    '<script>alert(1)</script>',
    'Testo <b>grassetto</b>',
    '<img src=x onerror=alert(1)>',
    '<br/>',
    '<!-- commento -->',
    '<div\nonclick="x()">',
  ])('checkDocumentText_RawHtml_%j_IsRefused', (text) => {
    expect(checkDocumentText(text)).toBe('siteDocuments.errors.htmlNotAllowed');
  });

  it.each(['Il prezzo è < 100 e > 50 euro', 'Scrivici a <https://example.test/privacy>', '1 < 2'])(
    'checkDocumentText_AngleBracketsThatAreNotTags_%j_AreAccepted',
    (text) => {
      expect(checkDocumentText(text)).toBeNull();
    },
  );

  it.each([
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '[x](data:text/html;base64,AAAA)',
    '[x](www.example.test)',
    '[x](/relativo)',
    '[x]()',
    '[x](ftp://example.test/file)',
    '[x](tel:+390212345678)',
  ])('checkDocumentText_LinkWithADisallowedTarget_%j_IsRefused', (text) => {
    expect(checkDocumentText(text)).toBe('siteDocuments.errors.linkInvalid');
  });

  it.each([
    '[sito](https://example.test/privacy)',
    '[sito](http://example.test)',
    '[scrivici](mailto:privacy@example.test)',
  ])('checkDocumentText_LinkWithAnAllowedTarget_%j_IsAccepted', (text) => {
    expect(checkDocumentText(text)).toBeNull();
  });
});

describe('checkDocumentUrl', () => {
  it.each(['https://example.test/privacy', '  https://www.example.test/a?b=1#c  '])(
    'checkDocumentUrl_Https_%j_IsAccepted',
    (url) => {
      expect(checkDocumentUrl(url)).toBeNull();
    },
  );

  it.each(['', '   '])('checkDocumentUrl_Empty_%j_ReturnsRequired', (url) => {
    expect(checkDocumentUrl(url)).toBe('siteDocuments.errors.urlRequired');
  });

  it.each([
    'http://example.test/privacy',
    'javascript:alert(1)',
    'data:text/html,x',
    'ftp://example.test/p.pdf',
    'example.test/privacy',
    'https://user:pass@example.test/privacy',
    'https://localhost/privacy',
    'https://intranet/privacy',
    'https://example.test/a b',
    'not a url',
  ])('checkDocumentUrl_NotHttps_%j_IsInvalid', (url) => {
    expect(checkDocumentUrl(url)).toBe('siteDocuments.errors.urlInvalid');
  });
});

describe('checkSiteDocumentForm', () => {
  it('checkSiteDocumentForm_TextSource_ChecksOnlyTheText', () => {
    expect(checkSiteDocumentForm('Text', 'Testo', 'http://not-checked')).toBeNull();
    expect(checkSiteDocumentForm('Text', '', 'https://example.test/privacy')).toBe('siteDocuments.errors.contentRequired');
  });

  it('checkSiteDocumentForm_ExternalUrlSource_ChecksOnlyTheAddress', () => {
    expect(checkSiteDocumentForm('ExternalUrl', '<script>', 'https://example.test/privacy')).toBeNull();
    expect(checkSiteDocumentForm('ExternalUrl', 'Testo', '')).toBe('siteDocuments.errors.urlRequired');
  });
});
