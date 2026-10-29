import type { OrgRole } from '@/types/org-team.types';
import { ACCOUNT_PEOPLE_PATH } from '../account/account-home-model';

/** The wizard of the invitation: four steps, from the page of the people. */
export const ACCOUNT_INVITE_PATH = `${ACCOUNT_PEOPLE_PATH}/invite`;

/** «Ruoli e permessi» (AM-04b-FU2): what each role can do, area by area, in one table. */
export const ACCOUNT_ROLES_PATH = `${ACCOUNT_PEOPLE_PATH}/roles`;

/**
 * «Cosa vede» (AM-04b-FU2): what one person of the page finds in CasaZen. `rowKey` is the key of its row on the page of the people
 * (`m-<id>` for a member, `i-<id>` for an invitation); `role` is the role to try instead of its own («E se fosse…», `?role=`).
 */
export function personPreviewPath(rowKey: string, role?: OrgRole): string {
  const path = `${ACCOUNT_PEOPLE_PATH}/${encodeURIComponent(rowKey)}/preview`;
  return role ? `${path}?role=${role}` : path;
}

/** The people who have been invited and have not answered yet: the page of the people with its «Invitate» chip. */
export const ACCOUNT_INVITED_PATH = `${ACCOUNT_PEOPLE_PATH}?chip=invited`;
