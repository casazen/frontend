import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PlainSection } from '@/components/shared/calm';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ServiceCategoryPicker } from '@/features/service-requests/components/service-category-picker';
import { getProblemMessage } from '@/lib/api-errors';
import { keepKnownCategories } from '@/lib/service-categories';
import { useComuneDatasetStatus } from '@/queries/use-comuni';
import { useServiceCategories } from '@/queries/use-service-categories';
import { useUpdateSupplierProfile } from '@/queries/supplier/use-profile';
import type { AdminSupplierStatus } from '@/types/admin-suppliers';
import type { SupplierProfile } from '@/types/supplier';
import { SupplierComuniField, type SupplierComuniValue } from '../components/supplier-comuni-field';

/** Longest values the API takes (`UpdateSupplierProfileRequest`): the fields stop there instead of the save being refused. */
const LIMITS = { legalName: 300, vatNumber: 20, phone: 50, bio: 2000 } as const;

interface FormValues {
  legalName: string;
  vatNumber: string;
  phone: string;
  categories: string[];
  comuni: SupplierComuniValue;
  bio: string;
}

/** The comuni of a profile as the form edits them: the ISTAT ones chosen from the list, and the text not covered by them. */
function comuniValueOf(profile: SupplierProfile): SupplierComuniValue {
  const istatCodes = profile.comuneIstatCodes ?? [];
  return { istatCodes, legacy: (profile.comuni ?? []).filter((entry) => !istatCodes.includes(entry)) };
}

function valuesOf(profile: SupplierProfile): FormValues {
  return {
    legalName: profile.legalName ?? '',
    vatNumber: profile.vatNumber ?? '',
    phone: profile.phone ?? '',
    categories: profile.categories ?? [],
    comuni: comuniValueOf(profile),
    bio: profile.bio ?? '',
  };
}

const sameValues = (a: FormValues, b: FormValues) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What the supplier says about itself: the data of the business, what it does and where, how it presents itself. One form, one save
 * (`PUT profile`, the same fields and the same rules as ever); the photos and the hours have their own sections and their own saves.
 * The server profile only replaces what is on screen while nothing was typed: a photo added elsewhere on the page, or a refetch,
 * never wipes a text half written.
 */
export function ProfileForm({ profile }: { profile: SupplierProfile }) {
  const { t } = useTranslation();
  const updateProfile = useUpdateSupplierProfile();
  const { data: categoryCodes } = useServiceCategories();
  const comuneStatus = useComuneDatasetStatus();
  const comuneListAvailable = comuneStatus.data?.datasetAvailable === true;

  const [values, setValues] = useState<FormValues>(() => valuesOf(profile));
  const [baseline, setBaseline] = useState<FormValues>(() => valuesOf(profile));
  const [seen, setSeen] = useState(profile);
  const [problem, setProblem] = useState<string | null>(null);
  const saving = updateProfile.isPending;

  // A profile that arrives while nothing was typed takes the place of the form (adjusting state during render); one that arrives
  // mid-edit does not wipe it.
  if (profile !== seen) {
    setSeen(profile);
    if (sameValues(values, baseline)) {
      const next = valuesOf(profile);
      setValues(next);
      setBaseline(next);
    }
  }

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    try {
      const saved = await updateProfile.mutateAsync({
        legalName: values.legalName.trim() || undefined,
        vatNumber: values.vatNumber.trim(),
        phone: values.phone.trim() || undefined,
        categories: keepKnownCategories(values.categories, categoryCodes),
        comuni: values.comuni.legacy,
        // Only while the official list is imported: the API refuses ISTAT codes otherwise and leaves the stored ones as they are.
        ...(comuneListAvailable ? { comuneIstatCodes: values.comuni.istatCodes } : {}),
        bio: values.bio.trim(),
      });
      const next = valuesOf(saved);
      setValues(next);
      setBaseline(next);
      toast.success(t('supplier.profile.saved'));
    } catch (error) {
      setProblem(getProblemMessage(error, t) ?? t('supplier.profile.saveError'));
    }
  };

  return (
    <form onSubmit={(event) => void save(event)} noValidate className="min-w-0 space-y-8" data-testid="supplier-profile-form">
      <PlainSection title={t('supplier.profile.business.title')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('supplier.companyName')} className="sm:col-span-2">
            <Input
              value={values.legalName}
              maxLength={LIMITS.legalName}
              autoComplete="organization"
              placeholder={t('supplier.placeholders.companyName')}
              onChange={(event) => set('legalName', event.target.value)}
              data-testid="supplier-profile-legal-name"
            />
          </Field>
          <Field label={t('supplier.vatNumber')} optional>
            <Input
              value={values.vatNumber}
              maxLength={LIMITS.vatNumber}
              autoComplete="off"
              placeholder={t('supplier.placeholders.vatNumber')}
              onChange={(event) => set('vatNumber', event.target.value)}
              data-testid="supplier-profile-vat"
            />
          </Field>
          <Field label={t('supplier.phone')} hint={t('supplier.profile.phoneHint')}>
            <Input
              type="tel"
              value={values.phone}
              maxLength={LIMITS.phone}
              autoComplete="tel"
              placeholder={t('supplier.placeholders.phone')}
              onChange={(event) => set('phone', event.target.value)}
              data-testid="supplier-profile-phone"
            />
          </Field>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="font-medium text-foreground/70">{t('supplier.profile.accountEmail')}</dt>
            <dd className="mt-1 break-words font-medium" data-testid="supplier-profile-email">
              {profile.email || '—'}
            </dd>
            <dd className="mt-0.5 break-words text-foreground/70">{t('supplier.profile.accountEmailHint')}</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-medium text-foreground/70">{t('supplier.status')}</dt>
            <dd className="mt-1">
              {/* A status this version does not know is shown as it came. */}
              <StatusBadge kind="supplier" status={profile.status as AdminSupplierStatus} data-testid="supplier-profile-status" />
            </dd>
          </div>
        </dl>
      </PlainSection>

      <PlainSection title={t('supplier.profile.services.title')}>
        <div role="group" aria-labelledby="supplier-categories-label" className="space-y-2">
          <p id="supplier-categories-label" className="text-sm font-medium">
            {t('supplier.serviceCategories')}
          </p>
          <p className="text-sm text-foreground/70">{t('supplier.categoriesHint')}</p>
          <ServiceCategoryPicker value={values.categories} onChange={(next) => set('categories', next)} disabled={saving} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-comuni">{t('supplier.operatingMunicipalities')}</Label>
          <SupplierComuniField
            id="supplier-comuni"
            value={values.comuni}
            known={profile.operatingComuni}
            onChange={(next) => set('comuni', next)}
            disabled={saving}
          />
        </div>
      </PlainSection>

      <PlainSection title={t('supplier.profile.presentation.title')}>
        <Field
          label={t('supplier.profile.presentation.label')}
          hint={t('supplier.profile.presentation.hint')}
          counter={`${values.bio.length}/${LIMITS.bio}`}
        >
          <Textarea
            rows={5}
            value={values.bio}
            maxLength={LIMITS.bio}
            placeholder={t('supplier.describeServicesPlaceholder')}
            onChange={(event) => set('bio', event.target.value)}
            data-testid="supplier-profile-bio"
          />
        </Field>
      </PlainSection>

      {problem ? (
        <Alert variant="danger" data-testid="supplier-profile-problem">
          {problem}
        </Alert>
      ) : null}
      <div>
        <Button type="submit" loading={saving} className="w-full sm:w-auto" data-testid="supplier-profile-save">
          {t('supplier.profile.save')}
        </Button>
      </div>
    </form>
  );
}
