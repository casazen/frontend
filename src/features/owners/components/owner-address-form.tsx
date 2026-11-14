import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getHttpStatus } from '@/lib/api-errors';
import { useOwnerAddress, useSaveOwnerAddress } from '@/queries/use-owner-accounting';
import type { OwnerAddress, OwnerAddressCommand } from '@/types';
import { OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import { failureText } from '@/features/owner-accounting/owner-accounting-model';

interface OwnerAddressSectionProps {
  ownerId: string;
  /** Who may read and write the address (`agency.owner.financial.manage`): it is personal data, so the page does not even ask for it otherwise. */
  canManage: boolean;
}

/**
 * «Indirizzo di fatturazione» of an owner (E13/F02/US01/T01, NF-110): the structured address the invoice of the property manager, the QR-bill and the bank transfer file need (street,
 * building number, postal code, town, province, country). It is personal data: only who manages the finances of the owners reads and saves it, the answer is dropped as soon as the page
 * is left, and a refusal is told as such, never as an address that is empty. Saving replaces the whole address.
 */
export function OwnerAddressSection({ ownerId, canManage }: OwnerAddressSectionProps) {
  const { t } = useTranslation();
  const address = useOwnerAddress(ownerId, canManage);

  let content;
  if (!canManage || address.data === null) {
    content = <p className="break-words text-sm text-foreground/70" data-testid="owner-address-read-only">{t('ownerAddress.notForYou')}</p>;
  } else if (getHttpStatus(address.error) === 404) {
    // A 404 is «not found» whatever the cache still holds (a failed read keeps the old data).
    content = <p className="break-words text-sm text-foreground/70" data-testid="owner-address-not-found">{t('ownerAddress.notFound')}</p>;
  } else if (address.isPending) {
    content = (
      <p role="status" className="text-sm text-foreground/70">
        {t('ownerAddress.loading')}
      </p>
    );
  } else if (address.isError || !address.data) {
    content = <OwnerAccountingError error={address.error} title={t('ownerAddress.loadError')} onRetry={() => void address.refetch()} />;
  } else {
    // The form starts from what the server holds and starts again when that is read again (after a save): no effect copies it into the state.
    content = <AddressForm key={address.dataUpdatedAt} ownerId={ownerId} saved={address.data} />;
  }

  return (
    <PlainSection title={t('ownerAddress.title')} data-testid="owner-address-section">
      {content}
    </PlainSection>
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

function AddressForm({ ownerId, saved }: { ownerId: string; saved: OwnerAddress }) {
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
          error={provinceOk ? undefined : 'ownerAddress.provinceRequired'}
        >
          <Input value={form.province} maxLength={50} autoComplete="off" onChange={(event) => set({ province: event.target.value })} data-testid="address-province" />
        </Field>
        <Field label={t('ownerAddress.fields.country')} hint={t('ownerAddress.countryHint')} error={country === '' || countryOk ? undefined : 'ownerAddress.countryInvalid'}>
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
