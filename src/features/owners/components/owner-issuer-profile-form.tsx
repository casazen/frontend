import { useState, type FormEvent } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { isFeatureEnabled } from '@/config/feature-flags';
import { OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { useOwnerIssuerProfile, useSaveOwnerIssuerProfile } from '@/queries/use-owner-issuer-profile';
import { OWNER_ISSUER_REGIMES, type OwnerIssuerProfile, type OwnerIssuerRegime } from '@/types';
import {
  followedForm,
  formOf,
  isChanged,
  isItalianProfile,
  issuesInvoices,
  missingFieldsOf,
  refusedFieldsOf,
  requestOf,
  type OwnerIssuerField,
  type OwnerIssuerForm,
} from '../owner-issuer-model';

function OwnerIssuerState({ profile }: { profile: Pick<OwnerIssuerProfile, 'exists' | 'canIssue' | 'missingFields'> }) {
  const { t } = useTranslation();
  if (!profile.exists) {
    return (
      <Alert variant="info" data-testid="owner-issuer-state" data-state="none">
        {t('ownerIssuer.state.none')}
      </Alert>
    );
  }
  if (profile.canIssue) {
    return (
      <Alert variant="success" data-testid="owner-issuer-state" data-state="ready">
        {t('ownerIssuer.state.ready')}
      </Alert>
    );
  }
  const fields = missingFieldsOf(profile).map((field) => t(`ownerIssuer.fields.${field}.label`));
  return (
    <Alert variant="warning" title={t('ownerIssuer.state.incomplete')} data-testid="owner-issuer-state" data-state="incomplete">
      {fields.length > 0 ? t('ownerIssuer.state.missing', { fields: fields.join(', ') }) : t('ownerIssuer.state.missingUnknown')}
    </Alert>
  );
}

interface OwnerIssuerProfileFormProps {
  ownerId: string;
  profile: OwnerIssuerProfile;
  onSaved?: () => void;
  onCancel?: () => void;
}

/**
 * The form of the issuer profile of an Italian owner (E17/F03/US01/T01, NF-116, NF-118): who issues the documents of the stays of the owner, a private person (a receipt, with the stamp duty when it is due: the
 * threshold and the amount are the rule in force, never a figure written in the form) or a company or a professional (a FatturaPA), with its data, its sezionale (the series of its numbers), the VAT of the stay (⚖ I1) and the reference of the stamp duty (⚖ I4). The choices marked ⚖
 * are prudent defaults that the accountant confirms: the form says so next to them and writes nothing the person did not choose. It saves the profile as a whole (the server clears what is left out), a
 * profile that misses something is saved and says what (the state above the form), and a value the server refuses is shown on its field with the sentence of the code. The caller who may not change the
 * profile never gets this form: the server masks the data for them (`OwnerIssuerProfileFacts`).
 */
export function OwnerIssuerProfileForm({ ownerId, profile, onSaved, onCancel }: OwnerIssuerProfileFormProps) {
  const { t } = useTranslation();
  const save = useSaveOwnerIssuerProfile(ownerId);
  const stored = formOf(profile);
  const [form, setForm] = useState<OwnerIssuerForm>(stored);
  const [base, setBase] = useState<OwnerIssuerForm>(stored);
  if (isChanged(stored, base)) {
    setBase(stored);
    setForm(followedForm(form, base, stored));
  }
  const [refused, setRefused] = useState<readonly OwnerIssuerField[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const changed = isChanged(form, stored);
  const invoice = issuesInvoices(form.regime);

  const set = (patch: Partial<OwnerIssuerForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    const touched = Object.keys(patch) as OwnerIssuerField[];
    setRefused((current) => (current.some((field) => touched.includes(field)) ? current.filter((field) => !touched.includes(field)) : current));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (save.isPending || (!changed && profile.exists)) return;
    setProblem(null);
    setRefused([]);
    try {
      const saved = await save.mutateAsync(requestOf(form));
      setForm(formOf(saved));
      toast.success(saved.canIssue ? t('ownerIssuer.saved.ready') : t('ownerIssuer.saved.incomplete'));
      onSaved?.();
    } catch (error) {
      setRefused(refusedFieldsOf(error));
      setProblem(getProblemMessage(error, t) ?? t('ownerIssuer.saveFailed'));
    }
  };

  const errorOf = (field: OwnerIssuerField) => (refused.includes(field) ? t('ownerIssuer.refused') : undefined);

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-5" data-testid="owner-issuer-form">
      <OwnerIssuerState profile={profile} />

      <ChoiceGroup legend={t('ownerIssuer.regime.legend')} legendVisible minCardWidth={14}>
        {OWNER_ISSUER_REGIMES.map((regime: OwnerIssuerRegime) => (
          <ChoiceCard
            key={regime}
            type="radio"
            name="owner-issuer-regime"
            checked={form.regime === regime}
            onChange={() => set({ regime })}
            title={t(`ownerIssuer.regime.${regime}.title`)}
            description={t(`ownerIssuer.regime.${regime}.description`)}
            data-testid={`owner-issuer-regime-${regime}`}
          />
        ))}
      </ChoiceGroup>
      {refused.includes('regime') ? (
        <p role="alert" className="text-sm text-destructive">
          {t('ownerIssuer.refused')}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(invoice ? 'ownerIssuer.fields.legalName.labelCompany' : 'ownerIssuer.fields.legalName.label')} error={errorOf('legalName')} className="sm:col-span-2">
          <Input value={form.legalName} maxLength={200} autoComplete="off" onChange={(event) => set({ legalName: event.target.value })} data-testid="owner-issuer-legal-name" />
        </Field>
        <Field label={t('ownerIssuer.fields.fiscalCode.label')} hint={t('ownerIssuer.fields.fiscalCode.hint')} error={errorOf('fiscalCode')}>
          <Input value={form.fiscalCode} maxLength={16} autoCapitalize="characters" autoComplete="off" onChange={(event) => set({ fiscalCode: event.target.value })} data-testid="owner-issuer-fiscal-code" />
        </Field>
        {invoice ? (
          <Field label={t('ownerIssuer.fields.vatNumber.label')} hint={t('ownerIssuer.fields.vatNumber.hint')} error={errorOf('vatNumber')}>
            <Input value={form.vatNumber} maxLength={14} inputMode="numeric" autoComplete="off" onChange={(event) => set({ vatNumber: event.target.value })} data-testid="owner-issuer-vat-number" />
          </Field>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label={t('ownerIssuer.fields.addressStreet.label')} error={errorOf('addressStreet')}>
          <Input value={form.addressStreet} maxLength={200} autoComplete="off" onChange={(event) => set({ addressStreet: event.target.value })} data-testid="owner-issuer-street" />
        </Field>
        <Field label={t('ownerIssuer.fields.addressCivic.label')} optional error={errorOf('addressCivic')}>
          <Input value={form.addressCivic} maxLength={20} autoComplete="off" onChange={(event) => set({ addressCivic: event.target.value })} data-testid="owner-issuer-civic" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr_1fr]">
        <Field label={t('ownerIssuer.fields.postalCode.label')} error={errorOf('postalCode')}>
          <Input value={form.postalCode} maxLength={5} inputMode="numeric" autoComplete="off" onChange={(event) => set({ postalCode: event.target.value })} data-testid="owner-issuer-postal-code" />
        </Field>
        <Field label={t('ownerIssuer.fields.city.label')} error={errorOf('city')}>
          <Input value={form.city} maxLength={100} autoComplete="off" onChange={(event) => set({ city: event.target.value })} data-testid="owner-issuer-city" />
        </Field>
        <Field label={t('ownerIssuer.fields.province.label')} hint={t('ownerIssuer.fields.province.hint')} error={errorOf('province')}>
          <Input value={form.province} maxLength={2} autoCapitalize="characters" autoComplete="off" onChange={(event) => set({ province: event.target.value })} data-testid="owner-issuer-province" />
        </Field>
      </div>

      {invoice ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('ownerIssuer.fields.stayVatTreatment.label')} hint={stayVatHint(profile, t)} error={errorOf('stayVatTreatment')} className="sm:col-span-2">
            <Select
              value={form.stayVatTreatment}
              onChange={(event) => set({ stayVatTreatment: event.target.value === 'ExemptArt10' ? 'ExemptArt10' : 'Standard' })}
              data-testid="owner-issuer-stay-vat"
            >
              <option value="Standard">{t('ownerIssuer.fields.stayVatTreatment.Standard')}</option>
              <option value="ExemptArt10">{t('ownerIssuer.fields.stayVatTreatment.ExemptArt10')}</option>
            </Select>
          </Field>
          <Field label={t('ownerIssuer.fields.fatturaPaRegimeCode.label')} hint={regimeCodeHint(profile, t)} optional error={errorOf('fatturaPaRegimeCode')}>
            <Input value={form.fatturaPaRegimeCode} maxLength={4} autoCapitalize="characters" autoComplete="off" onChange={(event) => set({ fatturaPaRegimeCode: event.target.value })} data-testid="owner-issuer-regime-code" />
          </Field>
          <Field label={t('ownerIssuer.fields.issuerSdiRecipientCode.label')} hint={t('ownerIssuer.fields.issuerSdiRecipientCode.hint')} optional error={errorOf('issuerSdiRecipientCode')}>
            <Input value={form.issuerSdiRecipientCode} maxLength={7} autoCapitalize="characters" autoComplete="off" onChange={(event) => set({ issuerSdiRecipientCode: event.target.value })} data-testid="owner-issuer-sdi-code" />
          </Field>
          <Field label={t('ownerIssuer.fields.issuerPec.label')} optional error={errorOf('issuerPec')} className="sm:col-span-2">
            <Input type="email" value={form.issuerPec} maxLength={200} autoComplete="off" onChange={(event) => set({ issuerPec: event.target.value })} data-testid="owner-issuer-pec" />
          </Field>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('ownerIssuer.fields.guestDocumentSeries.label')}
          hint={t('ownerIssuer.fields.guestDocumentSeries.hint', { default: profile.defaultGuestDocumentSeries })}
          optional
          error={errorOf('guestDocumentSeries')}
        >
          <Input value={form.guestDocumentSeries} maxLength={20} autoComplete="off" onChange={(event) => set({ guestDocumentSeries: event.target.value })} data-testid="owner-issuer-series" />
        </Field>
        <Field label={t('ownerIssuer.fields.stampDutyReference.label')} hint={t('ownerIssuer.fields.stampDutyReference.hint')} optional error={errorOf('stampDutyReference')}>
          <Input value={form.stampDutyReference} maxLength={60} autoComplete="off" onChange={(event) => set({ stampDutyReference: event.target.value })} data-testid="owner-issuer-stamp" />
        </Field>
      </div>

      <p className="text-sm text-foreground/70" data-testid="owner-issuer-confirm-note">
        {t('ownerIssuer.confirmNote')}
      </p>

      {problem ? (
        <Alert variant="danger" data-testid="owner-issuer-error">
          {problem}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" loading={save.isPending} disabled={profile.exists && !changed} data-testid="owner-issuer-save">
          {t('ownerIssuer.save')}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={save.isPending} data-testid="owner-issuer-cancel">
            {t('shared.cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** What the VAT of the stay is today under the rule in force, when the server says it, so that the choice is made knowing it (⚖ I1: to be confirmed by the accountant). */
function stayVatHint(profile: Pick<OwnerIssuerProfile, 'stayRatePercent'>, t: TFunction): string {
  return profile.stayRatePercent === null ? t('ownerIssuer.fields.stayVatTreatment.hint') : t('ownerIssuer.fields.stayVatTreatment.hintRate', { percent: profile.stayRatePercent });
}

/** The regime code of FatturaPA the document will carry when the field is left empty: the one of the rule in force, when the server says it. */
function regimeCodeHint(profile: Pick<OwnerIssuerProfile, 'effectiveRegimeCode'>, t: TFunction): string {
  return profile.effectiveRegimeCode === null ? t('ownerIssuer.fields.fatturaPaRegimeCode.hint') : t('ownerIssuer.fields.fatturaPaRegimeCode.hintCode', { code: profile.effectiveRegimeCode });
}

export function OwnerIssuerProfileFacts({ profile }: { profile: OwnerIssuerProfile }) {
  const { t } = useTranslation();
  const address = [[profile.addressStreet, profile.addressCivic].filter(Boolean).join(' '), [profile.postalCode, profile.city].filter(Boolean).join(' '), profile.province ?? ''].filter(Boolean).join(', ');
  const rows: [string, string | null][] = [
    ['regime', profile.regime === null ? null : (OWNER_ISSUER_REGIMES as readonly string[]).includes(profile.regime) ? t(`ownerIssuer.regime.${profile.regime}.title`) : profile.regime],
    ['legalName', profile.legalName],
    ['fiscalCode', profile.fiscalCode],
    ['vatNumber', profile.vatNumber],
    ['address', address === '' ? null : address],
    ['guestDocumentSeries', profile.guestDocumentSeries ?? profile.defaultGuestDocumentSeries],
    ['stampDutyReference', profile.stampDutyReference],
  ];

  return (
    <div className="space-y-4" data-testid="owner-issuer-facts">
      <OwnerIssuerState profile={profile} />
      {profile.exists ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(([field, value]) => (
            <div key={field} className="min-w-0">
              <dt className="text-sm text-foreground/70">{t(`ownerIssuer.facts.${field}`)}</dt>
              <dd className="break-words" data-testid={`owner-issuer-fact-${field}`}>
                {value === null || value === '' ? <span className="text-foreground/60">{t('ownerIssuer.facts.empty')}</span> : value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/**
 * «Emittente dei documenti dei soggiorni» of the financial page of an owner (E17/F03/US01/T01): the issuer profile with which CasaZen issues the documents of the owner's stays in its name. It exists only while the
 * issuance of fiscal documents is on (the server answers 404 to the profile while it is off: nothing is drawn and nothing is asked). The server decides who may change it: for a caller who may not, it masks the
 * personal data and the page shows them read-only, for a caller it refuses outright (403) the page says that the profile is not for them, and a read that failed is a failed read with a retry, never an
 * empty form; a 404 is «not found» whatever the query still holds. The answer is dropped as soon as the page is left.
 */
export function OwnerIssuerProfileSection({ ownerId }: { ownerId: string }) {
  const { flags } = useFeatureFlags();
  if (!isFeatureEnabled(flags, 'fiscalDocumentIssuance')) return null;
  return <SectionBody ownerId={ownerId} />;
}

function SectionBody({ ownerId }: { ownerId: string }) {
  const { t } = useTranslation();
  const profile = useOwnerIssuerProfile(ownerId);
  const data = profile.data;

  let content;
  if (getHttpStatus(profile.error) === 404) {
    content = (
      <p className="break-words text-sm text-foreground/70" data-testid="owner-issuer-not-found">
        {t('ownerIssuer.notFound')}
      </p>
    );
  } else if (profile.isPending) {
    content = (
      <p role="status" className="text-sm text-foreground/70">
        {t('ownerIssuer.loading')}
      </p>
    );
  } else if (profile.isError || data === undefined) {
    content = <OwnerAccountingError error={profile.error} title={t('ownerIssuer.loadError')} onRetry={() => void profile.refetch()} />;
  } else if (data === null) {
    content = (
      <p className="break-words text-sm text-foreground/70" data-testid="owner-issuer-not-for-you">
        {t('ownerIssuer.notForYou')}
      </p>
    );
  } else if (data.masked) {
    content = (
      <div className="space-y-4">
        <Alert variant="info" data-testid="owner-issuer-masked-notice">
          {t('ownerIssuer.maskedNotice')}
        </Alert>
        <OwnerIssuerProfileFacts profile={data} />
      </div>
    );
  } else if (!isItalianProfile(data)) {
    content = (
      <div className="space-y-4">
        <Alert variant="info" data-testid="owner-issuer-foreign">
          {t('ownerIssuer.foreign')}
        </Alert>
        <OwnerIssuerProfileFacts profile={data} />
      </div>
    );
  } else {
    content = <IssuerEditor key={ownerId} ownerId={ownerId} profile={data} />;
  }

  return (
    <PlainSection title={t('ownerIssuer.title')} data-testid="owner-issuer-section">
      <p className="break-words text-sm text-foreground/70">{t('ownerIssuer.description')}</p>
      {content}
    </PlainSection>
  );
}

function IssuerEditor({ ownerId, profile }: { ownerId: string; profile: OwnerIssuerProfile }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  return <div className="space-y-3">
    {!editing ? <OwnerIssuerProfileFacts profile={profile} /> : null}
    <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="owner-issuer-edit">{t('ownerProfile.wizard.edit')}</Button>
    <Dialog open={editing} onOpenChange={setEditing}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('ownerIssuer.title')}</DialogTitle><DialogDescription>{t('ownerIssuer.description')}</DialogDescription></DialogHeader>
        {editing ? <OwnerIssuerProfileForm ownerId={ownerId} profile={profile} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} /> : null}
      </DialogContent>
    </Dialog>
  </div>;
}
