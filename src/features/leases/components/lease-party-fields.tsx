import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MAX_PARTIES_PER_ROLE, type LeasePartyFormValues } from '../schemas/lease.schema';
import type { LeaseFormValues } from '../schemas/lease.schema';
import { Plus, Trash2 } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { emptyParty } from './lease-party-model';
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;


/**
 * Landlords or tenants of the lease (LT-14, A7-28): one or more, up to {@link MAX_PARTIES_PER_ROLE}. Co-owners and
 * co-tenants (e.g. spouses) are each a party of the contract and of the RLI registration.
 */
export function PartyListCard({
  role,
  control,
  register,
  errors,
  t,
}: {
  role: 'Landlord' | 'Tenant';
  control: Control<LeaseFormValues>;
  register: UseFormRegister<LeaseFormValues>;
  errors?: FieldErrors<LeaseFormValues>['landlords'];
  t: TranslateFn;
}) {
  const name = role === 'Landlord' ? 'landlords' : 'tenants';
  const keys = role === 'Landlord'
    ? { title: 'leases.form.landlordsTitle', description: 'leases.form.landlordsDescription', item: 'leases.form.landlordNumber', add: 'leases.form.addLandlord', remove: 'leases.form.removeLandlord' }
    : { title: 'leases.form.tenantsTitle', description: 'leases.form.tenantsDescription', item: 'leases.form.tenantNumber', add: 'leases.form.addTenant', remove: 'leases.form.removeTenant' };
  const { fields, append, remove } = useFieldArray({ control, name });
  const atMax = fields.length >= MAX_PARTIES_PER_ROLE;

  return (
    <Card data-testid={`lease-${name}`}>
      <CardHeader>
        <CardTitle>{t(keys.title)}</CardTitle>
        <CardDescription>{t(keys.description)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {fields.map((field, index) => (
          <fieldset
            key={field.id}
            className="space-y-4 rounded-md border p-4"
            aria-label={t(keys.item, { n: index + 1 })}
            data-testid={`lease-${name}-${index}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{t(keys.item, { n: index + 1 })}</p>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  aria-label={t(keys.remove, { n: index + 1 })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <PartyFields
                prefix={`${name}.${index}`}
                showCitizenshipHint={role === 'Tenant'}
                register={register}
                errors={errors?.[index]}
                t={t}
              />
            </div>
          </fieldset>
        ))}
        <FormFieldError error={errors?.root ?? errors} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyParty(role))} disabled={atMax}>
            <Plus className="mr-1 h-4 w-4" />
            {t(keys.add)}
          </Button>
          {atMax && (
            <p className="text-sm text-muted-foreground" data-testid={`lease-${name}-max`}>
              {t('leases.form.partiesMax', { max: MAX_PARTIES_PER_ROLE })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


function PartyFields({
  prefix,
  showCitizenshipHint,
  register,
  errors,
  t,
}: {
  prefix: `landlords.${number}` | `tenants.${number}`;
  showCitizenshipHint: boolean;
  register: UseFormRegister<LeaseFormValues>;
  errors?: FieldErrors<LeasePartyFormValues>;
  t: TranslateFn;
}) {
  const hintId = `${prefix}.citizenship-hint`;
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.firstName`}>{t('leases.form.firstNameLabel')}</Label>
        <Input id={`${prefix}.firstName`} {...register(`${prefix}.firstName`)} />
        <FormFieldError error={errors?.firstName} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.lastName`}>{t('leases.form.lastNameLabel')}</Label>
        <Input id={`${prefix}.lastName`} {...register(`${prefix}.lastName`)} />
        <FormFieldError error={errors?.lastName} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.fiscalCode`}>{t('leases.form.fiscalCodeLabel')}</Label>
        <Input
          id={`${prefix}.fiscalCode`}
          autoCapitalize="characters"
          aria-describedby={`${prefix}.fiscalCode-hint`}
          {...register(`${prefix}.fiscalCode`)}
        />
        <p id={`${prefix}.fiscalCode-hint`} className="text-xs text-muted-foreground">
          {t('leases.form.fiscalCodeHint')}
        </p>
        <FormFieldError error={errors?.fiscalCode} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}.citizenship`}>{t('leases.form.citizenshipLabel')}</Label>
        <Input
          id={`${prefix}.citizenship`}
          maxLength={2}
          placeholder="IT"
          aria-describedby={showCitizenshipHint ? hintId : undefined}
          {...register(`${prefix}.citizenship`)}
        />
        {showCitizenshipHint && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {t('leases.form.citizenshipHint')}
          </p>
        )}
        <FormFieldError error={errors?.citizenship} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${prefix}.contactEmail`}>{t('leases.form.contactEmailLabel')}</Label>
        <Input id={`${prefix}.contactEmail`} type="email" {...register(`${prefix}.contactEmail`)} />
        <FormFieldError error={errors?.contactEmail} />
      </div>
    </>
  );
}
