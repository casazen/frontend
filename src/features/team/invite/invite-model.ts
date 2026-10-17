import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import type {
  CreateOrgInvitationRequest,
  OrgInvitation,
  OrgInvitationLanguage,
  OrgMember,
  OrgPropertyScope,
  OrgRole,
} from '@/types/org-team.types';
import { isRentalArea, RENTAL_AREAS, type PickerProperty, type RentalArea } from '../team-properties';

/** The roles an invitation can give: never the owner. Whether the caller may give each one is for the matrix of the roles to say. */
export const INVITE_ROLES = ['Admin', 'PropertyManager', 'Collaborator', 'Accountant'] as const;

export type InviteRole = (typeof INVITE_ROLES)[number];

/** What the owner answers in the wizard of the invitation; the wizard holds them as the values of its form and keeps a draft. */
export interface InviteValues {
  /** Name and surname, as the owner knows the person: it is in the team page and in the email. */
  name: string;
  email: string;
  /** The language of the emails of the invitation. */
  language: OrgInvitationLanguage;
  role: InviteRole;
  /** `short-rent`, `long-rent`: at least one (an administrator has both). */
  areas: string[];
  scope: OrgPropertyScope;
  /** The properties of a collaborator «Solo alcuni». */
  propertyIds: string[];
}

/** Name of the flow: the draft is kept under it, for the signed-in person in their own organization. */
export const INVITE_WIZARD_ID = 'account-invite';

/** Name and email are another person's data: they are never written to the draft, the owner types them again after a reload. */
export const INVITE_DRAFT_EXCLUDE: readonly string[] = ['name', 'email'];

/** Backend `CreateOrgInvitationRequest.Name`: no `<`, `>`, `@`, `/`, `\` and no control character (it goes into an email). */
const NAME_PATTERN = /^[^<>@/\\\p{C}]*$/u;
const NAME_MAX = 200;
const EMAIL_MAX = 255;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StepSchema = ZodType<unknown, FieldValues>;

/** The addresses already in the org, lowercase: who is in the team and who has an invitation that has not been answered. */
export interface KnownEmails {
  members: ReadonlySet<string>;
  pending: ReadonlySet<string>;
}

export function knownEmails(members: readonly OrgMember[] | undefined, invitations: readonly OrgInvitation[] | undefined): KnownEmails {
  return {
    members: new Set((members ?? []).map((member) => member.email.trim().toLowerCase())),
    pending: new Set((invitations ?? []).filter((invitation) => invitation.status === 'Pending').map((invitation) => invitation.email.trim().toLowerCase())),
  };
}

/**
 * The rules of the steps, checked before the next one opens (the messages are i18n keys, as in every form). The email is checked as
 * it is written: its shape, whether the person is already in the team and whether an invitation is already waiting for it. The role
 * has to be one the caller may give (`assignable`, from the matrix; unknown until it is read, and then the backend decides): an
 * administrator cannot nominate another administrator, and an address that asks for it does not get past the step.
 */
export function inviteStepSchemas(known: KnownEmails, assignable?: readonly OrgRole[]): { who: StepSchema; role: StepSchema; where: StepSchema } {
  return {
    who: z.object({
      name: z
        .string()
        .trim()
        .min(1, 'team.invite.errors.nameRequired')
        .max(NAME_MAX, 'team.invite.errors.nameTooLong')
        .refine((name) => NAME_PATTERN.test(name), 'team.invite.errors.nameInvalid'),
      email: z
        .string()
        .trim()
        .min(1, 'team.invite.errors.emailRequired')
        .max(EMAIL_MAX, 'team.invite.errors.emailTooLong')
        .refine((email) => email === '' || EMAIL_PATTERN.test(email), 'team.invite.errors.emailInvalid')
        .refine((email) => !known.members.has(email.toLowerCase()), 'team.invite.errors.emailInTeam')
        .refine((email) => !known.pending.has(email.toLowerCase()), 'team.invite.errors.emailPending'),
      language: z.enum(['it', 'en']),
    }),
    role: z.object({
      role: z
        .enum(INVITE_ROLES, 'team.invite.errors.roleRequired')
        .refine((role) => !assignable || assignable.includes(role), 'team.invite.errors.roleNotAllowed'),
    }),
    // An administrator has every area whatever was ticked (the picker does not even offer them): it needs none of its own.
    where: z
      .object({ role: z.string(), areas: z.array(z.string()) })
      .refine((values) => values.role === 'Admin' || values.areas.length > 0, { path: ['areas'], error: 'team.invite.errors.areaRequired' }),
  };
}

/** What `?role=` of the address can ask for: «Invita il commercialista» (`?role=accountant`) and the like. */
const ROLE_FROM_ADDRESS: Record<string, InviteRole> = {
  admin: 'Admin',
  manager: 'PropertyManager',
  collaborator: 'Collaborator',
  accountant: 'Accountant',
};

export interface InviteDefaults {
  values: InviteValues;
  /** The address asked for something (`?role`, `?property`, `?area`): a draft from before must not take its place. */
  prefilled: boolean;
}

/**
 * Where the wizard starts: the collaborator in Affitti brevi with every property (the role that can do the least), unless the address
 * says otherwise: `?role=accountant`, `?area=long-rent`, `?property=<id>` (a collaborator limited to that property). `properties` is
 * what the org has, to know the area of `?property`; without it that part of the address is left out.
 */
export function inviteDefaults(search: URLSearchParams, language: OrgInvitationLanguage, properties: readonly PickerProperty[] | undefined): InviteDefaults {
  const values: InviteValues = { name: '', email: '', language, role: 'Collaborator', areas: ['short-rent'], scope: 'All', propertyIds: [] };
  let prefilled = false;

  const roleParam = search.get('role');
  if (roleParam && Object.hasOwn(ROLE_FROM_ADDRESS, roleParam)) {
    values.role = ROLE_FROM_ADDRESS[roleParam];
    // Everything but the collaborator works wherever the org has something: both areas, the person can take one off.
    if (values.role !== 'Collaborator') values.areas = [...RENTAL_AREAS];
    prefilled = true;
  }

  const areaParam = search.get('area');
  if (areaParam && isRentalArea(areaParam)) {
    values.areas = [areaParam];
    prefilled = true;
  }

  const propertyParam = search.get('property');
  const property = propertyParam ? properties?.find((candidate) => candidate.id === propertyParam) : undefined;
  if (property) {
    values.role = 'Collaborator';
    values.areas = [property.area];
    values.scope = 'Selected';
    values.propertyIds = [property.id];
    prefilled = true;
  }

  return { values, prefilled };
}

/** The role sees everything: the administrator. Its areas are both, whatever was ticked, and it cannot be limited. */
export function hasFullAccess(role: OrgRole): boolean {
  return role === 'Owner' || role === 'Admin';
}

/** What the invitation will really carry: the areas and the properties that make sense for the role and for each other. */
export interface InviteScope {
  areas: RentalArea[];
  scope: OrgPropertyScope;
  /** The properties of a «Solo alcuni» collaborator, only those of the areas it works in. */
  propertyIds: string[];
}

export function inviteScopeOf(values: InviteValues, properties: readonly PickerProperty[] | undefined): InviteScope {
  const areas = hasFullAccess(values.role) ? [...RENTAL_AREAS] : RENTAL_AREAS.filter((area) => values.areas.includes(area));
  const limited = values.role === 'Collaborator' && values.scope === 'Selected';
  const propertyIds = limited
    ? values.propertyIds.filter((id) => {
        const property = properties?.find((candidate) => candidate.id === id);
        return property !== undefined && areas.includes(property.area);
      })
    : [];
  return { areas, scope: limited ? 'Selected' : 'All', propertyIds };
}

/** The body of `POST /api/orgs/me/invitations`. */
export function toInvitationRequest(values: InviteValues, properties: readonly PickerProperty[] | undefined): CreateOrgInvitationRequest {
  const { areas, scope, propertyIds } = inviteScopeOf(values, properties);
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    role: values.role,
    areas,
    propertyScope: scope,
    ...(scope === 'Selected' ? { propertyIds } : {}),
    language: values.language,
  };
}
