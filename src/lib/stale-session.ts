import { parseRolesFromAccessToken } from '@/lib/auth-roles';

/** True when the access token carries no CasaZen roles (stale or incomplete Auth0 session). */
export async function hasNoWorkspaceRoles(
  getAccessToken: () => Promise<string | undefined>,
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    return parseRolesFromAccessToken(token).length === 0;
  } catch {
    return true;
  }
}
