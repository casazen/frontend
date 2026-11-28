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
import { isRentalArea, type PickerProperty, type RentalArea } from '../team-properties';

export const INVITE_ROLES = ['Admin', 'PropertyManager', 'Collaborator', 'Accountant'] as const;

export type InviteRole = (typeof INVITE_ROLES)[number];

export interface InviteValues {
  name: string;
  email: string;
  language: OrgInvitationLanguage;
  role: InviteRole;
  areas: string[];
  scope: OrgPropertyScope;
  propertyIds: string[];
}

export const INVITE_WIZARD_ID = 'account-invite';

export const INVITE_DRAFT_EXCLUDE: readonly string[] = ['name', 'email'];

const NAME_PATTERN = /^[^<>@/\\\p{C}]*$/u;
const NAME_MAX = 200;
const EMAIL_MAX = 255;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StepSchema = ZodType<unknown, FieldValues>;

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

export function inviteStepSchemas(known: KnownEmails, availableAreas: readonly RentalArea[], assignable?: readonly OrgRole[]): { who: StepSchema; role: StepSchema; where: StepSchema } {
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
    where: z
      .object({ role: z.string(), areas: z.array(z.string()) })
      .refine((values) => availableAreas.some((area) => values.role === 'Admin' || values.areas.includes(area)), { path: ['areas'], error: 'team.invite.errors.areaRequired' }),
  };
}

const ROLE_FROM_ADDRESS: Record<string, InviteRole> = {
  admin: 'Admin',
  manager: 'PropertyManager',
  collaborator: 'Collaborator',
  accountant: 'Accountant',
};

export interface InviteDefaults {
  values: InviteValues;
  prefilled: boolean;
}

/**
 * Where the wizard starts: the collaborator in Affitti brevi with every property (the role that can do the least), unless the address
 * says otherwise: `?role=accountant`, `?area=long-rent`, `?property=<id>` (a collaborator limited to that property). `properties` is
 * what the org has, to know the area of `?property`; without it that part of the address is left out.
 */
export function inviteDefaults(search: URLSearchParams, language: OrgInvitationLanguage, properties: readonly PickerProperty[] | undefined, availableAreas: readonly RentalArea[]): InviteDefaults {
  const values: InviteValues = { name: '', email: '', language, role: 'Collaborator', areas: availableAreas.slice(0, 1), scope: 'All', propertyIds: [] };
  let prefilled = false;

  const roleParam = search.get('role');
  if (roleParam && Object.hasOwn(ROLE_FROM_ADDRESS, roleParam)) {
    values.role = ROLE_FROM_ADDRESS[roleParam];
    if (values.role !== 'Collaborator') values.areas = [...availableAreas];
    prefilled = true;
  }

  const areaParam = search.get('area');
  if (areaParam && isRentalArea(areaParam) && availableAreas.includes(areaParam)) {
    values.areas = [areaParam];
    prefilled = true;
  }

  const propertyParam = search.get('property');
  const property = propertyParam ? properties?.find((candidate) => candidate.id === propertyParam) : undefined;
  if (property && availableAreas.includes(property.area)) {
    values.role = 'Collaborator';
    values.areas = [property.area];
    values.scope = 'Selected';
    values.propertyIds = [property.id];
    prefilled = true;
  }

  return { values, prefilled };
}

export function hasFullAccess(role: OrgRole): boolean {
  return role === 'Owner' || role === 'Admin';
}

export interface InviteScope {
  areas: RentalArea[];
  scope: OrgPropertyScope;
  propertyIds: string[];
}

export function inviteScopeOf(values: InviteValues, properties: readonly PickerProperty[] | undefined, availableAreas: readonly RentalArea[]): InviteScope {
  const areas = hasFullAccess(values.role) ? [...availableAreas] : availableAreas.filter((area) => values.areas.includes(area));
  const limited = values.role === 'Collaborator' && values.scope === 'Selected';
  const propertyIds = limited
    ? values.propertyIds.filter((id) => {
        const property = properties?.find((candidate) => candidate.id === id);
        return property !== undefined && areas.includes(property.area);
      })
    : [];
  return { areas, scope: limited ? 'Selected' : 'All', propertyIds };
}

export function toInvitationRequest(values: InviteValues, properties: readonly PickerProperty[] | undefined, availableAreas: readonly RentalArea[]): CreateOrgInvitationRequest {
  const { areas, scope, propertyIds } = inviteScopeOf(values, properties, availableAreas);
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
