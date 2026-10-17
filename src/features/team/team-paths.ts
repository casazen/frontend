import { ACCOUNT_PEOPLE_PATH } from '../account/account-home-model';

/** The wizard of the invitation: four steps, from the page of the people. */
export const ACCOUNT_INVITE_PATH = `${ACCOUNT_PEOPLE_PATH}/invite`;

/** The people who have been invited and have not answered yet: the page of the people with its «Invitate» chip. */
export const ACCOUNT_INVITED_PATH = `${ACCOUNT_PEOPLE_PATH}?chip=invited`;
