/**
 * Opens the partner's own site in this tab (E09/F02/US04/T04, UX-02 point 3): the address exactly as the partner's brief gave it, with nothing of the host or of the guests
 * added to it. It is one function so that the screen that leaves is the one place that does, and a test can say it was asked to.
 */
export function openPartnerSite(address: string): void {
  window.location.assign(address);
}
