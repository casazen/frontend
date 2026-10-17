import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Calculator, ClipboardList, ShieldCheck, type LucideIcon } from 'lucide-react';
import { ChoiceCard, type ChoiceCardProps } from '@/components/ui/choice-card';
import type { OrgRole, OrgRoleInfo } from '@/types/org-team.types';
import { orgRoleLabel } from '../account/account-roles';
import { buildAccessPreview } from './access-preview-model';
import { RENTAL_AREAS } from './team-properties';
import { capabilityLabel, orgRoleDescription } from './team-labels';

const ROLE_ICONS: Record<OrgRole, LucideIcon> = {
  Owner: ShieldCheck,
  Admin: ShieldCheck,
  PropertyManager: Building2,
  Collaborator: ClipboardList,
  Accountant: Calculator,
};

export type RoleCardProps = Omit<ChoiceCardProps, 'type' | 'title' | 'description' | 'icon' | 'value' | 'role'> & {
  /** The role of the matrix this card is for (not `role`: that is the ARIA attribute of every input). */
  info: OrgRoleInfo;
};

/**
 * A role to choose, in the words of the person who chooses: its name, what it is for in a sentence, and what it can and cannot do,
 * from the matrix the backend gives (`GET /api/orgs/me/roles`), for both rental areas. It is a `ChoiceCard`: a real radio input
 * underneath, so it works with the form of a wizard (`register('role')`) and with a controlled dialog (`checked`, `onChange`).
 */
export const RoleCard = forwardRef<HTMLInputElement, RoleCardProps>(function RoleCard({ info, ...input }, ref) {
  const { t } = useTranslation();
  const model = buildAccessPreview(info, RENTAL_AREAS);
  const names = (ids: string[]) => ids.map((id) => capabilityLabel(id, t)).filter((name): name is string => name !== undefined);
  const groups = [
    { id: 'can', label: t('team.preview.can'), items: names(model.can) },
    { id: 'read', label: t('team.preview.read'), items: names(model.read) },
    { id: 'cannot', label: t('team.preview.cannot'), items: names(model.cannot) },
  ].filter((group) => group.items.length > 0);

  return (
    <ChoiceCard
      ref={ref}
      {...input}
      value={info.role}
      icon={ROLE_ICONS[info.role]}
      title={orgRoleLabel(info.role, t)}
      description={
        <>
          <span className="block">{orgRoleDescription(info.role, t)}</span>
          {groups.map((group) => (
            <span key={group.id} className="mt-1.5 block text-xs">
              <span className="font-semibold">{group.label}:</span> {group.items.join(', ')}
            </span>
          ))}
        </>
      }
    />
  );
});
