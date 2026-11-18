import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { SITE_PAGES } from '../src/site/site-pages';

interface RenderedPage {
  page: { id: string };
  head: string;
  root: string;
}

/** Mirror the public site's prerender in the demo dev server, while keeping "/" as the PMS persona entry. */
export function devPublicSite(): Plugin {
  return {
    name: 'casazen-demo-public-site',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.method !== 'GET') return next();
        const pathname = request.url?.split('?')[0];
        const page = SITE_PAGES.find((item) =>
          (item.path !== '/' && item.path === pathname) || `/_site/${item.file}` === pathname,
        );
        if (!page) return next();
        try {
          const { renderSitePages } = await server.ssrLoadModule('/src/site/entry-server.ts');
          const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Rome' }).format());
          const pages: RenderedPage[] = renderSitePages(year);
          const content = pages.find((item) => item.page.id === page.id);
          if (!content) return next();
          const template = await readFile(resolve(server.config.root, 'site.html'), 'utf8');
          const html = template.replace('<!--site-head-->', () => content.head).replace('<!--site-root-->', () => content.root);
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(await server.transformIndexHtml('/site.html', html));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
