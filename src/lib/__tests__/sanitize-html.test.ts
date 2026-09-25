import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../sanitize-html';

// A8-08 / A9-29. Same payloads as the backend SeoHtmlSanitizerTests: keep them aligned.
const XSS_PAYLOADS = [
  '<img src=x onerror=alert(1)>',
  '<img src="x"/onerror="alert(1)">',
  '<svg/onload=alert(1)>',
  '<svg><script>alert(1)</script></svg>',
  '<script>alert(1)</script>',
  '<SCRIPT SRC=https://evil.example/x.js></SCRIPT>',
  '<iframe src="https://evil.example"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<style>body{display:none}</style>',
  '<object data="javascript:alert(1)"></object>',
  '<embed src="javascript:alert(1)">',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
  '<form action="javascript:alert(1)"><button>x</button></form>',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<base href="javascript:alert(1)//">',
  '<link rel="stylesheet" href="https://evil.example/x.css">',
];

const EXECUTABLE_MARKERS = [
  '<script',
  '<svg',
  '<img',
  '<iframe',
  '<style',
  '<object',
  '<embed',
  '<math',
  '<form',
  '<meta',
  '<base',
  '<link',
  'onerror',
  'onload',
  'javascript:',
  'alert(',
];

function expectNoExecutableMarkup(html: string) {
  const lower = html.toLowerCase();
  for (const marker of EXECUTABLE_MARKERS) {
    expect(lower).not.toContain(marker);
  }
}

/** Renders like dangerouslySetInnerHTML and checks the live DOM, not just the string. */
function renderInto(html: string): HTMLElement {
  const host = document.createElement('article');
  host.innerHTML = html;
  return host;
}

describe('sanitizeHtml (allowlist, mirror of backend SeoHtmlSanitizer)', () => {
  it.each(XSS_PAYLOADS)('sanitizeHtml_XssPayload_RemovesExecutableMarkup (%s)', (payload) => {
    const result = sanitizeHtml(payload);

    expectNoExecutableMarkup(result);
    const dom = renderInto(result);
    for (const el of Array.from(dom.querySelectorAll('*'))) {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.startsWith('on')).toBe(false);
      }
    }
  });

  it.each([
    '<a href="javascript:alert(1)">clic</a>',
    '<a href="&#106;avascript:alert(1)">clic</a>',
    '<a href="&#x6A;avascript&#x3A;alert(1)">clic</a>',
    '<a href="jav&#x09;ascript:alert(1)">clic</a>',
    '<a href=" JaVaScRiPt:alert(1)">clic</a>',
    '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">clic</a>',
    '<a href="vbscript:msgbox(1)">clic</a>',
    '<a href="/relative/path">clic</a>',
    '<a href="//evil.example/x">clic</a>',
  ])('sanitizeHtml_LinkWithDisallowedHref_DropsHrefAndKeepsText (%s)', (payload) => {
    expect(sanitizeHtml(payload)).toBe('<a rel="noopener noreferrer">clic</a>');
  });

  it.each([
    ['<P ONCLICK="alert(1)">testo</P>', '<p>testo</p>'],
    ["<p OnMouseOver=alert(1) onFocus='alert(2)'>testo</p>", '<p>testo</p>'],
    ['<h2 style="background:url(javascript:alert(1))" class="x" id="y">titolo</h2>', '<h2>titolo</h2>'],
    ['<p data-foo="bar" aria-label="x">testo</p>', '<p>testo</p>'],
  ])('sanitizeHtml_DisallowedAttributes_AreRemovedCaseInsensitively (%s)', (payload, expected) => {
    expect(sanitizeHtml(payload)).toBe(expected);
  });

  it('sanitizeHtml_LegitimateEditorialContent_IsPreserved', () => {
    const html =
      '<h2>CIN obbligatorio</h2>' +
      "<p>Il <strong>CIN</strong> va esposto <em>all'ingresso</em>.<br>Vedi la fonte.</p>" +
      '<h3>Adempimenti</h3><h4>Dettagli</h4>' +
      '<ul><li>Alloggiati Web</li><li>Tassa di soggiorno</li></ul>' +
      '<ol><li>Primo</li></ol>' +
      '<table><thead><tr><th>Notti</th></tr></thead><tbody><tr><td>5</td></tr></tbody></table>';

    expect(sanitizeHtml(html)).toBe(html);
  });

  it.each([
    'https://www.gazzettaufficiale.it/eli/id/2023/12/29/23G00159/sg',
    'http://example.com/pagina',
    'mailto:info@example.com',
  ])('sanitizeHtml_LinkWithAllowedScheme_KeepsHrefAndForcesRel (%s)', (href) => {
    const html = `<p><a href="${href}" target="_blank" rel="opener" title="t">fonte</a></p>`;

    expect(sanitizeHtml(html)).toBe(`<p><a href="${href}" rel="noopener noreferrer">fonte</a></p>`);
  });

  it('sanitizeHtml_BackendStubArticleWrapper_KeepsParagraphText', () => {
    expect(
      sanitizeHtml(
        '<article><p>Como: contenuto generato per affitti brevi, CIN e tassa di soggiorno.</p></article>',
      ),
    ).toBe('<p>Como: contenuto generato per affitti brevi, CIN e tassa di soggiorno.</p>');
  });

  it('sanitizeHtml_DisallowedWrapperAroundScript_KeepsTextButDropsScriptContent', () => {
    expect(
      sanitizeHtml('<div><h1>Titolo</h1><script>alert(1)</script><span>testo</span></div>'),
    ).toBe('Titolotesto');
  });

  it.each([null, undefined, '', '   '])('sanitizeHtml_EmptyInput_ReturnsEmptyString (%s)', (html) => {
    expect(sanitizeHtml(html)).toBe('');
  });

  it('sanitizeHtml_AlreadySanitizedHtml_IsStable', () => {
    const once = sanitizeHtml('<h2>Titolo</h2><p><a href="https://example.com">link</a> &amp; testo</p>');

    expect(sanitizeHtml(once)).toBe(once);
  });
});
