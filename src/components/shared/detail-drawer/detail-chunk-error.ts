const CHUNK_LOAD_ERROR = /dynamically imported module|importing a module script failed|loading chunk|chunkloaderror/i;

/**
 * A `lazy` content whose chunk did not load (offline, or a new deployment took the old file away). React keeps the failure of a
 * `lazy` component for good, so "Riprova" cannot render it again in place: the page has to be loaded again (the drawer is in the
 * address, so it comes back). The messages are the ones of Chrome, Firefox and Safari, and of the bundlers.
 */
export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_LOAD_ERROR.test(`${error.name} ${error.message}`);
}
