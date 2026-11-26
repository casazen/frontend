import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';

export function SupplierInviteIdentityFields() {
  const { t } = useTranslation();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t('supplier.identity.fields')}</legend>
      <p className="text-sm text-muted-foreground">{t('supplier.identity.fieldsHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">{t('supplier.identity.vat')}
          <Input name="vatNumber" maxLength={32} autoComplete="off" />
        </label>
        <label className="grid gap-1 text-sm">{t('supplier.identity.fiscal')}
          <Input name="fiscalCode" maxLength={24} autoComplete="off" />
        </label>
        <label className="grid gap-1 text-sm">{t('supplier.identity.phone')}
          <Input name="phone" type="tel" maxLength={50} placeholder="+39" />
        </label>
      </div>
    </fieldset>
  );
}

