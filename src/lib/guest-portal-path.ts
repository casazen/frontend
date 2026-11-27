export function isGuestPortalToken(token: string): boolean {
  return /^stay_[A-Za-z0-9_-]{32}$/.test(token);
}
