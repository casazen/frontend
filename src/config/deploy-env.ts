/**
 * Which deployment this bundle was built for: `production`, `preview` or `development` on Vercel (`VERCEL_ENV`), an empty text anywhere else (a local or a CI build).
 *
 * `vite.config.ts` writes the value into the bundle at build time (`define`), so nobody has to set a variable for it. The console reads it to link the plugin for WordPress of its own
 * channel (`pluginDownloadUrl`: the ZIP of the `main` channel for a Production build, the one of `develop` for every other one, PLG-FE-CONSOLE, NF-200). It is public and says nothing
 * about the data: the name of an environment.
 */
declare const __CASAZEN_DEPLOY_ENV__: string | undefined;

export const deployEnv: string = typeof __CASAZEN_DEPLOY_ENV__ === 'string' ? __CASAZEN_DEPLOY_ENV__ : '';
