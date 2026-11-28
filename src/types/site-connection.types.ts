export interface SiteConnectionAuthorizeRequest {
  siteUrl: string;
  returnUrl: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface SiteConnectionAuthorizeResponse {
  redirectUrl: string;
  siteUrl: string;
  expiresAt: string;
}

/** An active connected site (`GET /api/orgs/{orgId}/site-connections`, the newest first). The credential of the site is never in it. */
export interface SiteConnection {
  id: string;
  siteUrl: string;
  createdAt: string;
  lastUsedAt: string | null;
}
