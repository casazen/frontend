import { env } from './env.config';

export const authConfig = {
  domain: env.auth0.domain,
  clientId: env.auth0.clientId,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: env.auth0.audience,
  },
};
