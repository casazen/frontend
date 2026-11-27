const CHUNK_LOAD_ERROR = /dynamically imported module|importing a module script failed|loading chunk|chunkloaderror/i;

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_LOAD_ERROR.test(`${error.name} ${error.message}`);
}
