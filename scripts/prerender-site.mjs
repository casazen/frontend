/**
 * Prerender of the public site (SEO-VETRINA), the last step of `npm run build`.
 *
 * Input: `dist/site.html` (the template, with the hashed script and stylesheet of the browser bundle, built by `vite build`)
 * and `dist-ssr/entry-server.js` (the same pages for Node, built by `vite build --ssr`). Output: one static page per entry of
 * `SITE_PAGES` in `dist/_site/`, the sitemap `dist/sitemap-site.xml` when the site is served on a public origin
 * (`src/site/site-gate.ts`), and no template left in `dist/`. On Vercel production without the company data nothing of the
 * site is written. The Routing Middleware (`middleware.ts`) serves the pages at their public paths.
 *
 * A missing marker or an empty page fails the build: Vercel then keeps the previous deployment.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const dist = resolve(root, 'dist');
const ssrDir = resolve(root, 'dist-ssr');
const templatePath = resolve(dist, 'site.html');

const HEAD_MARKER = '<!--site-head-->';
const ROOT_MARKER = '<!--site-root-->';

const template = await readFile(templatePath, 'utf8');
for (const marker of [HEAD_MARKER, ROOT_MARKER]) {
  if (!template.includes(marker)) throw new Error(`prerender-site: ${marker} is missing from dist/site.html`);
}

const { isSiteServed, renderSitePages, renderSiteSitemap, SITE_ASSET_DIR } = await import(
  pathToFileURL(resolve(ssrDir, 'entry-server.js')).href
);

// Production without the company data (the company does not exist yet): the site is not served, so its files are not
// published either (they would be reachable at /_site/…). `src/site/site-gate.ts`.
if (!isSiteServed(process.env.VERCEL_ENV)) {
  console.log('prerender-site: production without the company data (VITE_LEGAL_NAME, VITE_LEGAL_VAT_ID): the public site is not built');
  await rm(templatePath);
  await rm(ssrDir, { recursive: true, force: true });
  process.exit(0);
}

// The year of the copyright line, in Italy (the build may run in another time zone around New Year).
const year = Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date()));

const outDir = resolve(dist, SITE_ASSET_DIR);
await mkdir(outDir, { recursive: true });

for (const { page, head, root: pageRoot } of renderSitePages(year)) {
  if (!pageRoot.includes('<h1')) throw new Error(`prerender-site: the page ${page.id} rendered no heading`);
  const html = template.replace(HEAD_MARKER, head).replace(ROOT_MARKER, pageRoot);
  await writeFile(resolve(outDir, page.file), html, 'utf8');
  console.log(`prerender-site: ${page.path} -> dist/${SITE_ASSET_DIR}/${page.file}`);
}

const sitemap = renderSiteSitemap(process.env.VERCEL_ENV);
if (sitemap) {
  await writeFile(resolve(dist, 'sitemap-site.xml'), sitemap, 'utf8');
  console.log('prerender-site: dist/sitemap-site.xml');
} else {
  console.log('prerender-site: no sitemap (no public origin, or production without the company data: the site is not served)');
}

await rm(templatePath);
await rm(ssrDir, { recursive: true, force: true });
