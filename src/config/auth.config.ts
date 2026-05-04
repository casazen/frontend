import { env } from './env.config';

export const authConfig = {
  domain: env.auth0.domain,
  clientId: env.auth0.clientId,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: env.auth0.audience,
    scope: 'openid profile email read:properties write:properties read:bookings write:bookings',
  },
  useRefreshTokens: true,
  cacheLocation: 'localstorage' as const,
};
