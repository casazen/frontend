import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Pencil, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  COEFFICIENT_COMBINATIONS,
  DATA_COMPLETENESS_VALUES,
  ltrReferenceDataApi,
  type AdminAgreementDetail,
  type AdminRentBand,
  type AgreementRules,
  type UpdateAgreementInput,
  type UpdateRentBandInput,
} from '@/api/ltr-reference-data.api';
import { getProblemMessage } from '@/lib/api-errors';
import { formatDate } from '@/lib/utils';
import type { DataCompleteness } from '@/types';
import { LtrAuditTrail } from './ltr-audit-trail';
import { LTR_AGREEMENTS_KEY, ltrAgreementKey, ltrAuditKey } from '../lib/ltr-query-keys';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50';

type NumericRule = Exclude<keyof AgreementRules, 'coefficientCombination' | 'subFascia3QualifyingTypeDElements'>;

/** Every numeric rule of the calculation, grouped as in the agreement (labels: `ltrReferenceData.rules.*`). */
const RULE_GROUPS: { titleKey: string; fields: NumericRule[] }[] = [
  {
    titleKey: 'ltrReferenceData.rules.subFasceTitle',
    fields: [
      'requiredTypeACount',
      'subFascia2MinTypeBCount',
      'subFascia3MinTypeCCount',
      'subFascia3MinQualifyingTypeDCount',
      'subFascia3MaxMinTypeDCount',
      'stoveHeatingMinTypeBCount',
    ],
  },
  {
    titleKey: 'ltrReferenceData.rules.surfaceTitle',
    fields: [
      'smallSqmMax',
      'smallSqmUpliftPercent',
      'midSqmMin',
      'midSqmMax',
      'midSqmUpliftPercent',
      'largeSqmMin',
      'largeSqmReductionPercent',
    ],
  },
  {
    titleKey: 'ltrReferenceData.rules.coefficientsTitle',
    fields: [
      'furnishedUpliftPercent',
      'airConditioningUpliftPercent',
      'duration4UpliftPercent',
      'duration5UpliftPercent',
      'duration6UpliftPercent',
    ],
  },
  {
    titleKey: 'ltrReferenceData.rules.appurtenancesTitle',
    fields: [
      'garageAppurtenancePercent',
      'balconyAppurtenancePercent',
      'otherAppurtenancePercent',
      'greenAreaAppurtenancePercent',
    ],
  },
];

const BAND_VALUES = [
  'subFascia1MinEurSqmYear',
  'subFascia1MaxEurSqmYear',
  'subFascia2MinEurSqmYear',
  'subFascia2MaxEurSqmYear',
  'subFascia3MinEurSqmYear',
  'subFascia3MaxEurSqmYear',
] as const;

interface Props {
  agreementId: string;
  onClose: () => void;
}

/**
 * Detail and edit of a territorial agreement (LT-13): status, source, expiry, the rules of the calculation and the
 * bands. The verification date is never edited here: "Segna verificato" records it with its source.
 */
export function LtrAgreementDialog({ agreementId, onClose }: Props) {
  const { t } = useTranslation();
  const detail = useQuery({
    queryKey: ltrAgreementKey(agreementId),
    queryFn: () => ltrReferenceDataApi.getAgreement(agreementId),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {detail.data ? t('ltrReferenceData.agreement.title', { comune: detail.data.comune }) : t('ltrReferenceData.agreement.loading')}
          </DialogTitle>
          <DialogDescription>{t('ltrReferenceData.agreement.description')}</DialogDescription>
        </DialogHeader>
        {detail.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {detail.isError && (
          <div className="space-y-2" role="alert">
            <p className="text-sm text-destructive">
              {getProblemMessage(detail.error, t) ?? t('ltrReferenceData.loadError')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void detail.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('ltrReferenceData.retry')}
            </Button>
          </div>
        )}
        {detail.data && <AgreementEditor key={detail.data.updatedAt ?? 'new'} agreement={detail.data} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function toInput(agreement: AdminAgreementDetail): UpdateAgreementInput {
  const rules = Object.fromEntries(
    RULE_GROUPS.flatMap((group) => group.fields).map((field) => [field, agreement[field]]),
  ) as Record<NumericRule, number>;
  return {
    ...rules,
    coefficientCombination: agreement.coefficientCombination,
    subFascia3QualifyingTypeDElements: agreement.subFascia3QualifyingTypeDElements,
    dataCompleteness: agreement.dataCompleteness,
    sourceUrl: agreement.sourceUrl,
    expiresAt: agreement.expiresAt ? agreement.expiresAt.slice(0, 10) : null,
    expiryNote: agreement.expiryNote,
    remainsInForceUntilReplaced: agreement.remainsInForceUntilReplaced,
  };
}

function AgreementEditor({ agreement, onClose }: { agreement: AdminAgreementDetail; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UpdateAgreementInput>(() => toInput(agreement));

  const save = useMutation({
    mutationFn: (input: UpdateAgreementInput) => ltrReferenceDataApi.updateAgreement(agreement.id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(ltrAgreementKey(agreement.id), updated);
      void queryClient.invalidateQueries({ queryKey: LTR_AGREEMENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: ltrAuditKey(agreement.id) });
      toast.success(t('ltrReferenceData.toast.saved'));
    },
    onError: (error) => toast.error(getProblemMessage(error, t) ?? t('ltrReferenceData.toast.saveFailed')),
  });

  const set = <K extends keyof UpdateAgreementInput>(key: K, value: UpdateAgreementInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-6">
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({
          ...form,
          sourceUrl: form.sourceUrl?.trim() || null,
          expiresAt: form.expiresAt || null,
          expiryNote: form.expiryNote?.trim() || null,
          subFascia3QualifyingTypeDElements: form.subFascia3QualifyingTypeDElements?.trim() || null,
        });
      }}
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <p className="text-sm text-muted-foreground sm:col-span-2" data-testid="ltr-agreement-verification">
          {agreement.lastVerifiedAt
            ? t('ltrReferenceData.lastVerified', {
                date: formatDate(agreement.lastVerifiedAt),
                source: agreement.verificationSource ?? '—',
              })
            : t('ltrReferenceData.neverVerified')}
        </p>
        <div className="space-y-1">
          <Label htmlFor="ltr-completeness">{t('ltrReferenceData.fields.dataCompleteness')}</Label>
          <select
            id="ltr-completeness"
            className={SELECT_CLASS}
            value={form.dataCompleteness}
            onChange={(e) => set('dataCompleteness', e.target.value as DataCompleteness)}
          >
            {DATA_COMPLETENESS_VALUES.map((value) => (
              <option key={value} value={value}>
                {t(`ltrReferenceData.completeness.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ltr-source-url">{t('ltrReferenceData.fields.sourceUrl')}</Label>
          <Input
            id="ltr-source-url"
            type="url"
            value={form.sourceUrl ?? ''}
            onChange={(e) => set('sourceUrl', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ltr-expires-at">{t('ltrReferenceData.fields.expiresAt')}</Label>
          <Input
            id="ltr-expires-at"
            type="date"
            value={form.expiresAt ?? ''}
            onChange={(e) => set('expiresAt', e.target.value || null)}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Checkbox
            id="ltr-remains-in-force"
            checked={form.remainsInForceUntilReplaced}
            onCheckedChange={(v) => set('remainsInForceUntilReplaced', v === true)}
          />
          <Label htmlFor="ltr-remains-in-force">{t('ltrReferenceData.fields.remainsInForceUntilReplaced')}</Label>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ltr-expiry-note">{t('ltrReferenceData.fields.expiryNote')}</Label>
          <Textarea
            id="ltr-expiry-note"
            value={form.expiryNote ?? ''}
            maxLength={500}
            onChange={(e) => set('expiryNote', e.target.value)}
          />
        </div>
      </section>

      {RULE_GROUPS.map((group) => (
        <section key={group.titleKey} className="space-y-2">
          <h3 className="text-sm font-medium">{t(group.titleKey)}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {group.fields.map((field) => (
              <div key={field} className="space-y-1">
                <Label htmlFor={`ltr-rule-${field}`}>{t(`ltrReferenceData.rules.${field}`)}</Label>
                <Input
                  id={`ltr-rule-${field}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={String(form[field])}
                  onChange={(e) => set(field, Number(e.target.value))}
                />
              </div>
            ))}
            {group.titleKey === 'ltrReferenceData.rules.subFasceTitle' && (
              <div className="space-y-1">
                <Label htmlFor="ltr-rule-qualifying-d">{t('ltrReferenceData.rules.subFascia3QualifyingTypeDElements')}</Label>
                <Input
                  id="ltr-rule-qualifying-d"
                  value={form.subFascia3QualifyingTypeDElements ?? ''}
                  maxLength={100}
                  onChange={(e) => set('subFascia3QualifyingTypeDElements', e.target.value)}
                />
              </div>
            )}
            {group.titleKey === 'ltrReferenceData.rules.coefficientsTitle' && (
              <div className="space-y-1">
                <Label htmlFor="ltr-rule-combination">{t('ltrReferenceData.rules.coefficientCombination')}</Label>
                <select
                  id="ltr-rule-combination"
                  className={SELECT_CLASS}
                  value={form.coefficientCombination}
                  onChange={(e) =>
                    set('coefficientCombination', e.target.value as UpdateAgreementInput['coefficientCombination'])
                  }
                >
                  {COEFFICIENT_COMBINATIONS.map((value) => (
                    <option key={value} value={value}>
                      {t(`ltrReferenceData.combination.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>
      ))}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('ltrReferenceData.close')}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('ltrReferenceData.save')}
        </Button>
      </DialogFooter>
    </form>
    <BandsTable agreement={agreement} />
    <LtrAuditTrail entityId={agreement.id} />
    </div>
  );
}

function BandsTable({ agreement }: { agreement: AdminAgreementDetail }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{t('ltrReferenceData.bands.title')}</h3>
      {agreement.bands.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('ltrReferenceData.bands.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-2 py-2">{t('ltrReferenceData.bands.zone')}</th>
                <th className="px-2 py-2">{t('ltrReferenceData.bands.surface')}</th>
                <th className="px-2 py-2">{t('ltrReferenceData.bands.subFascia', { n: 1 })}</th>
                <th className="px-2 py-2">{t('ltrReferenceData.bands.subFascia', { n: 2 })}</th>
                <th className="px-2 py-2">{t('ltrReferenceData.bands.subFascia', { n: 3 })}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {agreement.bands.map((band) =>
                editing === band.id ? (
                  <BandEditRow key={band.id} agreementId={agreement.id} band={band} onDone={() => setEditing(null)} />
                ) : (
                  <tr key={band.id} className="border-b last:border-0" data-testid="ltr-band">
                    <td className="px-2 py-2">
                      {band.zoneName}
                      {band.cadastralSheets && (
                        <span className="block text-muted-foreground">
                          {t('ltrReferenceData.bands.sheets', { sheets: band.cadastralSheets })}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {band.maxSqm == null
                        ? t('leases.canoneConcordato.bandOver', { min: band.minSqm })
                        : t('leases.canoneConcordato.bandBetween', { min: band.minSqm, max: band.maxSqm })}
                    </td>
                    <td className="px-2 py-2">{band.subFascia1MinEurSqmYear}–{band.subFascia1MaxEurSqmYear}</td>
                    <td className="px-2 py-2">{band.subFascia2MinEurSqmYear}–{band.subFascia2MaxEurSqmYear}</td>
                    <td className="px-2 py-2">{band.subFascia3MinEurSqmYear}–{band.subFascia3MaxEurSqmYear}</td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('ltrReferenceData.bands.edit')}
                        onClick={() => setEditing(band.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BandEditRow({ agreementId, band, onDone }: { agreementId: string; band: AdminRentBand; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState<UpdateRentBandInput>(() => ({
    zoneName: band.zoneName,
    cadastralSheets: band.cadastralSheets,
    minSqm: band.minSqm,
    maxSqm: band.maxSqm,
    subFascia1MinEurSqmYear: band.subFascia1MinEurSqmYear,
    subFascia1MaxEurSqmYear: band.subFascia1MaxEurSqmYear,
    subFascia2MinEurSqmYear: band.subFascia2MinEurSqmYear,
    subFascia2MaxEurSqmYear: band.subFascia2MaxEurSqmYear,
    subFascia3MinEurSqmYear: band.subFascia3MinEurSqmYear,
    subFascia3MaxEurSqmYear: band.subFascia3MaxEurSqmYear,
  }));

  const save = useMutation({
    mutationFn: (input: UpdateRentBandInput) => ltrReferenceDataApi.updateBand(agreementId, band.id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(ltrAgreementKey(agreementId), updated);
      void queryClient.invalidateQueries({ queryKey: LTR_AGREEMENTS_KEY });
      // Band changes are logged under the agreement's id (LT-13), so the agreement's own audit trail picks them up.
      void queryClient.invalidateQueries({ queryKey: ltrAuditKey(agreementId) });
      toast.success(t('ltrReferenceData.toast.saved'));
      onDone();
    },
    onError: (error) => toast.error(getProblemMessage(error, t) ?? t('ltrReferenceData.toast.saveFailed')),
  });

  const numberInput = (key: keyof UpdateRentBandInput, label: string, nullable = false) => (
    <Input
      aria-label={label}
      type="number"
      min={0}
      step="0.01"
      className="h-8 w-20"
      value={value[key] == null ? '' : String(value[key])}
      onChange={(e) =>
        setValue((current) => ({
          ...current,
          [key]: e.target.value === '' && nullable ? null : Number(e.target.value),
        }))
      }
    />
  );

  return (
    <tr className="border-b bg-muted/20" data-testid="ltr-band-edit">
      <td className="space-y-1 px-2 py-2">
        <Input
          aria-label={t('ltrReferenceData.bands.zone')}
          className="h-8"
          value={value.zoneName}
          maxLength={100}
          onChange={(e) => setValue((current) => ({ ...current, zoneName: e.target.value }))}
        />
        <Textarea
          aria-label={t('ltrReferenceData.bands.sheetsLabel')}
          className="min-h-8 text-xs"
          value={value.cadastralSheets ?? ''}
          maxLength={200}
          onChange={(e) => setValue((current) => ({ ...current, cadastralSheets: e.target.value || null }))}
        />
      </td>
      <td className="space-y-1 px-2 py-2">
        {numberInput('minSqm', t('ltrReferenceData.bands.minSqm'))}
        {numberInput('maxSqm', t('ltrReferenceData.bands.maxSqm'), true)}
      </td>
      {[1, 2, 3].map((n) => (
        <td key={n} className="space-y-1 px-2 py-2">
          {numberInput(BAND_VALUES[(n - 1) * 2], t('ltrReferenceData.bands.min', { n }))}
          {numberInput(BAND_VALUES[(n - 1) * 2 + 1], t('ltrReferenceData.bands.max', { n }))}
        </td>
      ))}
      <td className="space-y-1 px-2 py-2 text-right">
        <Button type="button" size="sm" disabled={save.isPending} onClick={() => save.mutate(value)}>
          {t('ltrReferenceData.save')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t('ltrReferenceData.cancel')}
        </Button>
      </td>
    </tr>
  );
}
