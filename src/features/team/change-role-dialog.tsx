import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Minus, type LucideIcon } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceGroup } from '@/components/ui/choice-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { toastUndo } from '@/lib/toast-undo';
import { useOrgRoles, useOrgTeamActions } from '@/queries/use-org-team';
import type { OrgCapabilityLevel, OrgRole } from '@/types/org-team.types';
import { orgRoleLabel } from '../account/account-roles';
import type { PersonRow } from './people-rows';
import { RoleCard } from './role-card';
import { capabilityLabel } from './team-labels';
import { assignableRoles, roleChanges, type RoleChange } from './team-roles';

// The keys are written out (`*Key:` properties) so that the i18n test finds a missing translation.
const LEVEL_WORDS: Record<OrgCapabilityLevel, { labelKey: string }> = {
  Yes: { labelKey: 'team.actions.role.levelYes' },
  Read: { labelKey: 'team.actions.role.levelRead' },
  No: { labelKey: 'team.actions.role.levelNo' },
};

/** One side of the difference: what the person gains or loses, each thing with the level it ends at. */
function ChangeList({ icon: Icon, title, empty, items }: { icon: LucideIcon; title: string; empty: string; items: RoleChange[] }) {
  const { t } = useTranslation();
  return (
    <section className="min-w-0 space-y-1.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-foreground/70">{empty}</p>
      ) : (
        <ul role="list" className="space-y-0.5 text-sm">
          {items.map((item) => (
            <li key={item.id} className="break-words">
              {capabilityLabel(item.id, t)}
              <span className="text-foreground/70">: {t(LEVEL_WORDS[item.level].labelKey)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChangeRoleForm({ row, onClose }: { row: PersonRow; onClose: () => void }) {
  const { t } = useTranslation();
  const roles = useOrgRoles();
  const actions = useOrgTeamActions();
  const [selected, setSelected] = useState<OrgRole>(row.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignable = assignableRoles(roles.data?.roles);
  const from = roles.data?.roles.find((candidate) => candidate.role === row.role);
  const to = assignable.find((candidate) => candidate.role === selected);
  const changes = from && to && selected !== row.role ? roleChanges(from, to, row.areas) : null;

  const save = async () => {
    const previous = row.role;
    setBusy(true);
    setError(null);
    try {
      await actions.changeRole(row.id, selected);
    } catch (failure) {
      setError(getProblemMessage(failure, t) ?? t('team.actions.failed'));
      setBusy(false);
      return;
    }
    onClose();
    // «Annulla» gives the role back for real: the same call with the role of before. The change reaches the other servers within a minute.
    toastUndo(t('team.actions.role.done', { name: row.name, role: orgRoleLabel(selected, t) }), {
      description: t('team.actions.role.doneHint'),
      undo: async () => {
        await actions.changeRole(row.id, previous);
      },
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('team.actions.role.title', { name: row.name })}</DialogTitle>
        <DialogDescription>{t('team.actions.role.description')}</DialogDescription>
      </DialogHeader>

      {roles.isPending ? (
        <SkeletonLine lines={4} />
      ) : assignable.length === 0 ? (
        <Alert
          variant="danger"
          action={
            <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void roles.refetch()}>
              {t('team.retry')}
            </Button>
          }
        >
          {t('team.invite.role.loadError')}
        </Alert>
      ) : (
        <ChoiceGroup legend={t('team.invite.role.legend')} minCardWidth={14}>
          {assignable.map((role) => (
            <RoleCard
              key={role.role}
              info={role}
              name="member-role"
              checked={selected === role.role}
              onChange={() => setSelected(role.role)}
              disabled={busy}
              data-testid={`member-role-${role.role}`}
            />
          ))}
        </ChoiceGroup>
      )}

      {changes ? (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="role-changes" aria-live="polite">
          <ChangeList icon={Check} title={t('team.actions.role.more')} empty={t('team.actions.role.noMore')} items={changes.more} />
          <ChangeList icon={Minus} title={t('team.actions.role.less')} empty={t('team.actions.role.noLess')} items={changes.less} />
        </div>
      ) : null}

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          {t('shared.cancel')}
        </Button>
        <Button type="button" onClick={() => void save()} loading={busy} disabled={selected === row.role} data-testid="member-role-save">
          {t('team.actions.role.save')}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * «Cambia ruolo» (AM-04b-FU1): the roles the caller may give, as cards, and what changes for the person before anything is saved.
 * The role is saved when the button is pressed, and «Annulla» in the toast that follows gives the old one back.
 */
export function ChangeRoleDialog({ row, open, onOpenChange }: { row: PersonRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">{open ? <ChangeRoleForm row={row} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}
