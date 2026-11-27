/** A visitor who comes back to a sign-in page within this time is not sent to the sign-in a second time. */
export const RESTART_WINDOW_MS = 15_000;

/** Whether the page that keeps its start under `storageKey` (`sessionStorage`, one tab) sent the visitor to the sign-in less than `RESTART_WINDOW_MS` ago. */
export function startedRecently(storageKey: string): boolean {
  try {
    const startedAt = Number(sessionStorage.getItem(storageKey));
    return Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < RESTART_WINDOW_MS;
  } catch {
    return false;
  }
}

/** Notes, under `storageKey`, that the page is sending the visitor to the sign-in now. */
export function rememberStart(storageKey: string): void {
  try {
    sessionStorage.setItem(storageKey, String(Date.now()));
  } catch {
    // No storage (private mode): the guard against a loop is lost, the redirect itself still works.
  }
}
