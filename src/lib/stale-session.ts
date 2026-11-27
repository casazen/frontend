import { parseRolesFromAccessToken } from '@/lib/auth-roles';

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
