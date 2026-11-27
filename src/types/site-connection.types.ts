/**
 * The connection of a site to the agency account (backend `SiteConnectionsController`, PLG-BE-CONNECT, site integration plan §10.3, NF-201, NF-203): the plugin for WordPress asks the agency
 * to confirm the link on the console page `/app/connect/wordpress`, and the page of the domain lists the connected sites.
 */

/** Body of `POST /api/orgs/{orgId}/site-connections/authorize`: what the plugin asked for, as the page got it in its address. */
export interface SiteConnectionAuthorizeRequest {
  /** The origin of the site (`https://www.example.com`). */
  siteUrl: string;
  /** Where the browser goes back to on the site (same origin): the server adds the one-time code and the state. */
  returnUrl: string;
  /** The state of the plugin, given back unchanged. */
  state: string;
  /** The PKCE challenge: the SHA-256 of the verifier the plugin keeps, in base64url. */
  codeChallenge: string;
  /** `S256`, the only method. */
  codeChallengeMethod: 'S256';
}

/** The answer of the authorization: the address the browser is sent to (it carries the one-time code), the site the server confirmed and until when the code opens. */
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
