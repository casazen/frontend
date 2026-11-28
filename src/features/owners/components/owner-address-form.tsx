import { useState, type FormEvent, type ReactNode } from 'react';
import { Lock, MapPin, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { HelpTip } from '@/components/ui/help-tip';
import { Input } from '@/components/ui/input';
import { getHttpStatus } from '@/lib/api-errors';
import { useOwnerAddress, useSaveOwnerAddress } from '@/queries/use-owner-accounting';
import type { OwnerAddress, OwnerAddressCommand } from '@/types';
import { OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import { failureText } from '@/features/owner-accounting/owner-accounting-model';
import { OwnerCard, QuietNote } from './owner-ui';

interface OwnerAddressSectionProps {
  ownerId: string;
  /** Who may read and write the address (`agency.owner.financial.manage`): it is personal data, so the page does not even ask for it otherwise. */
  canManage: boolean;
}

function AddressCard({ action, help, children }: { action?: ReactNode; help?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <OwnerCard icon={MapPin} title={t('ownerAddress.title')} action={action} help={help} data-testid="owner-address-section">
      {children}
    </OwnerCard>
  );
}

export function OwnerAddressSection({ ownerId, canManage }: OwnerAddressSectionProps) {
  const { t } = useTranslation();
  const address = useOwnerAddress(ownerId, canManage);

  if (!canManage || address.data === null) {
    return (
      <AddressCard>
        <QuietNote icon={Lock} data-testid="owner-address-read-only">
          {t('ownerAddress.notForYou')}
        </QuietNote>
      </AddressCard>
    );
  }
  if (getHttpStatus(address.error) === 404) {
    return (
      <AddressCard>
        <p className="break-words text-sm text-foreground/70" data-testid="owner-address-not-found">{t('ownerAddress.notFound')}</p>
      </AddressCard>
    );
  }
  if (address.isPending) {
    return (
      <AddressCard>
        <p role="status" className="text-sm text-foreground/70">
          {t('ownerAddress.loading')}
        </p>
      </AddressCard>
    );
  }
  if (address.isError || !address.data) {
    return (
      <AddressCard>
        <OwnerAccountingError error={address.error} title={t('ownerAddress.loadError')} onRetry={() => void address.refetch()} />
      </AddressCard>
    );
  }
  return <AddressEditor key={ownerId} ownerId={ownerId} saved={address.data} />;
}

function AddressEditor({ ownerId, saved }: { ownerId: string; saved: OwnerAddress }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const lines = [[saved.street, saved.buildingNumber].filter(Boolean).join(' '), [saved.postalCode, saved.town, saved.province].filter(Boolean).join(' '), saved.country].filter(Boolean);
  const edit = (
    <Button type="button" variant="outline" size="sm" aria-label={`${t('ownerProfile.actions.edit')}: ${t('ownerAddress.title')}`} onClick={() => setEditing(true)} data-testid="owner-address-edit">
      <Pencil aria-hidden="true" className="size-4" />
      {t('ownerProfile.actions.edit')}
    </Button>
  );
  return (
    <AddressCard action={edit} help={<HelpTip title={t('ownerAddress.title')}>{t('ownerAddress.description')}</HelpTip>}>
      {lines.length > 0 ? (
        <address className="text-sm not-italic leading-relaxed" data-testid="owner-address-summary">
          {lines.map((line, index) => (
            <p key={index} className={index === 0 ? 'font-medium' : undefined}>{line}</p>
          ))}
        </address>
      ) : (
        <p className="text-sm text-foreground/60">{t('ownerProfile.facts.empty')}</p>
      )}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('ownerAddress.title')}</DialogTitle>
            <DialogDescription>{t('ownerAddress.description')}</DialogDescription>
          </DialogHeader>
          {editing ? <AddressForm ownerId={ownerId} saved={saved} onSaved={() => setEditing(false)} /> : null}
        </DialogContent>
      </Dialog>
    </AddressCard>
  );
}

interface FormState {
  street: string;
  buildingNumber: string;
  postalCode: string;
  town: string;
  province: string;
  country: string;
}

const fromAddress = (address: OwnerAddress): FormState => ({
  street: address.street ?? '',
  buildingNumber: address.buildingNumber ?? '',
  postalCode: address.postalCode ?? '',
  town: address.town ?? '',
  province: address.province ?? '',
  country: address.country ?? '',
});

/** The text of a part of the address, or nothing: the server stores a blank optional part as none. */
const text = (value: string): string | undefined => (value.trim() === '' ? undefined : value.trim());

function AddressForm({ ownerId, saved, onSaved }: { ownerId: string; saved: OwnerAddress; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const save = useSaveOwnerAddress(ownerId);
  const [form, setForm] = useState<FormState>(() => fromAddress(saved));
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const country = form.country.trim();
  const countryOk = /^[A-Za-z]{2}$/.test(country);
  // Italy needs the province (the two letters) on the documents: the same rule the server applies.
  const provinceOk = country.toUpperCase() !== 'IT' || form.province.trim() !== '';
  const required = form.street.trim() !== '' && form.postalCode.trim() !== '' && form.town.trim() !== '';
  const valid = required && countryOk && provinceOk;
  const before = fromAddress(saved);
  const changed = (Object.keys(form) as (keyof FormState)[]).some((key) => form[key].trim() !== before[key].trim());

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || !changed || save.isPending) return;
    setError(null);
    const command: OwnerAddressCommand = {
      street: form.street.trim(),
      buildingNumber: text(form.buildingNumber),
      postalCode: form.postalCode.trim(),
      town: form.town.trim(),
      province: text(form.province),
      country: country.toUpperCase(),
    };
    try {
      await save.mutateAsync(command);
      toast.success(t('ownerAddress.saved'));
      onSaved();
    } catch (failure) {
      setError(failureText(failure, t, i18n.exists));
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4" data-testid="owner-address-form">
      <p className="break-words text-sm text-foreground/70">{t('ownerAddress.description')}</p>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label={t('ownerAddress.fields.street')}>
          <Input value={form.street} maxLength={200} autoComplete="off" onChange={(event) => set({ street: event.target.value })} data-testid="address-street" />
        </Field>
        <Field label={t('ownerAddress.fields.buildingNumber')} optional>
          <Input value={form.buildingNumber} maxLength={20} autoComplete="off" onChange={(event) => set({ buildingNumber: event.target.value })} data-testid="address-building" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field label={t('ownerAddress.fields.postalCode')}>
          <Input value={form.postalCode} maxLength={20} autoComplete="off" onChange={(event) => set({ postalCode: event.target.value })} data-testid="address-postal-code" />
        </Field>
        <Field label={t('ownerAddress.fields.town')}>
          <Input value={form.town} maxLength={100} autoComplete="off" onChange={(event) => set({ town: event.target.value })} data-testid="address-town" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('ownerAddress.fields.province')}
          optional={country.toUpperCase() !== 'IT'}
          hint={t('ownerAddress.provinceHint')}
          error={provinceOk ? undefined : t('ownerAddress.provinceRequired')}
        >
          <Input value={form.province} maxLength={50} autoComplete="off" onChange={(event) => set({ province: event.target.value })} data-testid="address-province" />
        </Field>
        <Field label={t('ownerAddress.fields.country')} hint={t('ownerAddress.countryHint')} error={country === '' || countryOk ? undefined : t('ownerAddress.countryInvalid')}>
          <Input value={form.country} maxLength={2} autoCapitalize="characters" autoComplete="off" onChange={(event) => set({ country: event.target.value })} data-testid="address-country" />
        </Field>
      </div>
      {error ? (
        <Alert variant="danger" data-testid="owner-address-error">
          {error}
        </Alert>
      ) : null}
      <div>
        <Button type="submit" size="sm" loading={save.isPending} disabled={!valid || !changed} data-testid="address-save">
          {t('ownerAddress.save')}
        </Button>
      </div>
    </form>
  );
}
