/**
 * Prerender of the public site (SEO-VETRINA), the last step of `npm run build`.
 *
 * Input: `dist/site.html` (the template, with the hashed script and stylesheet of the browser bundle, built by `vite build`)
 * and `dist-ssr/entry-server.js` (the same pages for Node, built by `vite build --ssr`). Output: one static page per entry of
 * `SITE_PAGES` in `dist/_site/`, the sitemap `dist/sitemap-site.xml` when the build has a public origin, and no template
 * left in `dist/`. The Routing Middleware (`middleware.ts`) serves the pages at their public paths.
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

const { renderSitePages, renderSiteSitemap, SITE_ASSET_DIR } = await import(
  pathToFileURL(resolve(ssrDir, 'entry-server.js')).href
);

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

const sitemap = renderSiteSitemap();
if (sitemap) {
  await writeFile(resolve(dist, 'sitemap-site.xml'), sitemap, 'utf8');
  console.log('prerender-site: dist/sitemap-site.xml');
} else {
  console.log('prerender-site: no public origin (VITE_PUBLIC_SITE_URL), no sitemap');
}

await rm(templatePath);
await rm(ssrDir, { recursive: true, force: true });
