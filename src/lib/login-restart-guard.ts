export const RESTART_WINDOW_MS = 15_000;

export function startedRecently(storageKey: string): boolean {
  try {
    const startedAt = Number(sessionStorage.getItem(storageKey));
    return Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < RESTART_WINDOW_MS;
  } catch {
    return false;
  }
}

export function rememberStart(storageKey: string): void {
  try {
    sessionStorage.setItem(storageKey, String(Date.now()));
  } catch {
    // No storage (private mode): the guard against a loop is lost, the redirect itself still works.
  }
}
