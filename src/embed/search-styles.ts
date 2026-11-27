/**
 * The look of the search bar (NF-146): the CSS it brings, the theme the page may ask for, and how the CSS gets into the page.
 *
 * The bar lives IN the page of another website, next to the styles of a WordPress theme or of Elementor, which style `button`, `input`, `select`, `table`
 * and `td` as they please. So every rule here starts with `.czs-root.czs-root` (the prefix of the bar, written twice: two classes are more specific than a
 * theme's `.theme button:hover`) and every element of the bar has ALL the properties a theme is used to set declared by us, in each state a theme may style
 * (hover, focus, active); nothing is left to the inheritance of the page except the font, when the page asks for it (`--czs-font` is empty).
 *
 * The CSS is written with a constructable stylesheet (`adoptedStyleSheets`), which a content security policy does not block; where the browser has none, a
 * `<style>` element that carries the nonce of the script. Never a `style` attribute written as text.
 *
 * PURE TYPESCRIPT, NO IMPORT FROM THE APP.
 */

/** The theme variables: the primary color, the radius and the font, a page may set (`data-casazen-theme`). The text color on the primary is derived. */
const FONTS: Record<string, string> = {
  editoriale: "Fraunces, 'Iowan Old Style', Georgia, 'Times New Roman', serif",
  moderno: "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif",
  classico: "'Playfair Display', Didot, 'Bodoni MT', Georgia, 'Times New Roman', serif",
};

/** `#rgb` or `#rrggbb` as `#rrggbb` in lower case, or null. */
export function readHex(value: unknown): string | null {
  const match = typeof value === 'string' ? /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim()) : null;
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1];
  return `#${digits.toLowerCase()}`;
}

/** A radius from 0 to 32 px (or 2 rem), the same bounds as the frames take: `12px`, `0.5rem`. Null for anything else. */
export function readRadius(value: unknown): string | null {
  const match = typeof value === 'string' ? /^(\d{1,2}(?:\.\d{1,4})?)(px|rem)$/.exec(value.trim()) : null;
  if (!match) return null;
  return Number(match[1]) <= (match[2] === 'px' ? 32 : 2) ? `${match[1]}${match[2]}` : null;
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number];
}

/** The relative luminance of a `#rrggbb` color (WCAG 2). */
function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map((value) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The contrast ratio of two `#rrggbb` colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The color of the text on a `primary` fill: white or black, whichever reads better. Whatever the primary, the better of the two is at least 4.58:1, so the
 * 4.5:1 of WCAG AA text is always met.
 */
export function onColor(primary: string): string {
  return contrastRatio(primary, '#ffffff') >= contrastRatio(primary, '#000000') ? '#ffffff' : '#000000';
}

/** The faint tint of a color (15 % of it on white): the days between the arrival and the departure. */
function tint(hex: string): string {
  return `#${channels(hex)
    .map((value) => Math.round(value * 0.15 + 255 * 0.85).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * The custom properties a theme asks for, each only when its value is valid: `--czs-primary` (a hex color) with `--czs-on-primary` and `--czs-tint`
 * derived from it, `--czs-radius` (0 to 32 px) and `--czs-font` (one of the font stacks of the booking site). An invalid member is ignored, the others stay.
 */
export function themeVariables(theme: unknown): Record<string, string> {
  const variables: Record<string, string> = {};
  if (typeof theme !== 'object' || theme === null || Array.isArray(theme)) return variables;
  const { primary, radius, font } = theme as Record<string, unknown>;

  const color = readHex(primary);
  if (color) {
    variables['--czs-primary'] = color;
    variables['--czs-on-primary'] = onColor(color);
    variables['--czs-tint'] = tint(color);
  }
  const round = readRadius(radius);
  if (round) variables['--czs-radius'] = round;
  if (typeof font === 'string' && Object.prototype.hasOwnProperty.call(FONTS, font)) variables['--czs-font'] = FONTS[font];
  return variables;
}

/** Puts the theme on the root of the bar, through the CSSOM. */
export function applyTheme(root: HTMLElement, theme: unknown): void {
  for (const [name, value] of Object.entries(themeVariables(theme))) root.style.setProperty(name, value);
}

/** The root of the bar, written twice. */
const SCOPE = '.czs-root.czs-root';

/** What every element of the bar starts from: nothing the theme of the page may have set is left. */
const RESET =
  'box-sizing:border-box;margin:0;padding:0;border:0;background:none;box-shadow:none;outline:0;float:none;max-width:none;transition:none;' +
  'font-family:var(--czs-font,inherit);font-style:normal;font-weight:400;font-size:16px;line-height:1.4;letter-spacing:normal;text-transform:none;text-decoration:none;text-indent:0;text-shadow:none;' +
  'color:var(--czs-ink);';

const RING = 'outline:3px solid var(--czs-ink);outline-offset:2px;';

/** The rules, each a list of selectors (after the scope) and what they declare. */
const RULES: [string[], string][] = [
  [[''], `${RESET}--czs-primary:#1f3a3d;--czs-on-primary:#ffffff;--czs-tint:#e9f1f0;--czs-radius:14px;--czs-ink:#172c2e;--czs-muted:#496469;--czs-line:#798b8a;--czs-error:#b42318;display:block;position:relative;width:100%;text-align:left;`],
  [[' .czs-form'], `${RESET}display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;position:relative;padding:16px;background:#ffffff;border:1px solid var(--czs-line);border-radius:var(--czs-radius);box-shadow:0 6px 20px rgba(23,44,46,.08);`],
  [[' .czs-field'], `${RESET}display:flex;flex-direction:column;gap:4px;flex:1 1 150px;min-width:0;`],
  [[' .czs-label'], `${RESET}display:block;font-size:13px;font-weight:600;line-height:1.2;color:var(--czs-muted);`],
  [
    [' .czs-control'],
    `${RESET}display:block;width:100%;min-height:44px;padding:8px 12px;background:#ffffff;border:1px solid var(--czs-line);border-radius:var(--czs-radius);text-align:left;cursor:pointer;-webkit-appearance:none;appearance:none;`,
  ],
  [[' select.czs-control'], '-webkit-appearance:menulist;appearance:auto;'],
  [[' .czs-opener'], 'display:flex;align-items:center;overflow:hidden;white-space:nowrap;'],
  [[' .czs-opener-value'], `${RESET}display:block;overflow:hidden;text-overflow:ellipsis;`],
  [[' .czs-stepper'], `${RESET}display:flex;gap:6px;align-items:stretch;`],
  [[' .czs-guests'], 'flex:1 1 auto;min-width:48px;text-align:center;cursor:text;-moz-appearance:textfield;appearance:textfield;'],
  [[' .czs-guests::-webkit-inner-spin-button', ' .czs-guests::-webkit-outer-spin-button'], '-webkit-appearance:none;margin:0;'],
  [
    [' .czs-step', ' .czs-nav'],
    `${RESET}display:block;flex:0 0 44px;width:44px;height:44px;background:#ffffff;border:1px solid var(--czs-line);border-radius:var(--czs-radius);font-size:22px;font-weight:600;line-height:1;text-align:center;cursor:pointer;-webkit-appearance:none;appearance:none;`,
  ],
  [[' .czs-step[aria-disabled="true"]', ' .czs-nav[aria-disabled="true"]'], 'opacity:.4;cursor:default;'],
  [
    [' .czs-btn'],
    `${RESET}display:block;flex:0 0 auto;min-height:44px;padding:10px 22px;background:var(--czs-primary);color:var(--czs-on-primary);border-radius:var(--czs-radius);font-weight:600;text-align:center;cursor:pointer;-webkit-appearance:none;appearance:none;`,
  ],
  [[' .czs-btn:hover', ' .czs-btn:active'], 'background:var(--czs-primary);color:var(--czs-on-primary);border:0;filter:brightness(.92);'],
  [
    [' .czs-control:hover', ' .czs-control:active', ' .czs-step:hover', ' .czs-step:active', ' .czs-nav:hover', ' .czs-nav:active'],
    'background:#ffffff;color:var(--czs-ink);border:1px solid var(--czs-line);',
  ],
  [[' .czs-btn:focus', ' .czs-control:focus', ' .czs-step:focus', ' .czs-nav:focus'], RING],
  [
    [' .czs-cal'],
    `${RESET}display:block;position:absolute;z-index:100000;top:100%;left:0;right:0;max-width:720px;margin-top:6px;padding:16px;background:#ffffff;border:1px solid var(--czs-line);border-radius:var(--czs-radius);box-shadow:0 8px 24px rgba(0,0,0,.18);`,
  ],
  [[' .czs-cal[hidden]'], 'display:none;'],
  [[' .czs-cal-head'], `${RESET}display:flex;justify-content:space-between;margin-bottom:4px;`],
  [[' .czs-months'], `${RESET}display:flex;gap:24px;`],
  [[' .czs-month'], `${RESET}display:block;flex:1 1 0;min-width:0;`],
  [[' .czs-month-title'], `${RESET}display:block;margin-bottom:8px;font-weight:600;text-align:center;text-transform:capitalize;`],
  [[' .czs-grid'], `${RESET}display:table;width:100%;border-collapse:collapse;border-spacing:0;table-layout:fixed;`],
  [[' .czs-head'], `${RESET}display:table-header-group;`],
  [[' .czs-body'], `${RESET}display:table-row-group;`],
  [[' .czs-row'], `${RESET}display:table-row;`],
  [[' .czs-dow'], `${RESET}display:table-cell;padding-bottom:6px;font-size:12px;font-weight:600;text-align:center;color:var(--czs-muted);`],
  [[' .czs-blank'], `${RESET}display:table-cell;`],
  [
    [' .czs-day'],
    `${RESET}display:table-cell;height:44px;font-size:15px;line-height:44px;text-align:center;vertical-align:middle;border-radius:var(--czs-radius);cursor:pointer;`,
  ],
  [[' .czs-day:hover', ' .czs-day:active'], 'background:var(--czs-tint);color:var(--czs-ink);border:0;'],
  [[' .czs-day.is-today'], 'font-weight:700;text-decoration:underline;'],
  [[' .czs-day.is-range', ' .czs-day.is-range:hover'], 'background:var(--czs-tint);color:var(--czs-ink);border-radius:0;'],
  [[' .czs-day.is-start', ' .czs-day.is-end', ' .czs-day.is-start:hover', ' .czs-day.is-end:hover'], 'background:var(--czs-primary);color:var(--czs-on-primary);border-radius:var(--czs-radius);'],
  [[' .czs-day.is-past', ' .czs-day.is-past:hover'], 'background:none;color:#8a96a3;cursor:default;'],
  [[' .czs-day:focus'], 'outline:3px solid var(--czs-ink);outline-offset:-3px;box-shadow:inset 0 0 0 5px #ffffff;'],
  [[' .czs-alert'], `${RESET}display:block;margin-top:8px;font-size:14px;font-weight:600;color:var(--czs-error);`],
  [[' .czs-note'], `${RESET}display:block;margin-top:8px;font-size:14px;color:var(--czs-muted);`],
  [[' .czs-alert:empty', ' .czs-note:empty'], 'margin-top:0;'],
  [
    [' .czs-live'],
    `${RESET}position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;`,
  ],
];

/** On a narrow bar every field has a line to itself. */
const NARROW = `@media (max-width:520px){${SCOPE} .czs-field,${SCOPE} .czs-btn{flex:1 1 100%;}${SCOPE} .czs-months{display:block;}}`;

/** The CSS of the bar. Every selector starts with `.czs-root`. */
export const SEARCH_CSS =
  RULES.map(([selectors, declarations]) => `${selectors.map((selector) => `${SCOPE}${selector}`).join(',')}{${declarations}}`).join('') + NARROW;

/** The documents and shadow roots the CSS is already in. */
const installed = new WeakSet<object>();

/**
 * Puts the CSS into the page `host` is in (or into its shadow root), once. A constructable stylesheet is tried first (not subject to the content security
 * policy of the page); a browser that has none gets a `<style>` element with the nonce of the script, which a policy with nonces lets through.
 */
export function installStyles(host: HTMLElement, nonce: string): void {
  const root = host.getRootNode();
  const target: Document | ShadowRoot = root instanceof ShadowRoot ? root : document;
  if (installed.has(target)) return;
  installed.add(target);
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(SEARCH_CSS);
    target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
  } catch {
    const style = document.createElement('style');
    style.nonce = nonce;
    style.textContent = SEARCH_CSS;
    (target instanceof Document ? document.head || document.documentElement : target).appendChild(style);
  }
}
