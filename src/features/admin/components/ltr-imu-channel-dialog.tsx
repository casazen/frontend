import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
import {
  DATA_COMPLETENESS_VALUES,
  IMU_RATE_KINDS,
  ltrReferenceDataApi,
  type AdminImuChannel,
  type ImuRateKind,
  type UpdateImuChannelInput,
} from '@/api/ltr-reference-data.api';
import { getProblemMessage } from '@/lib/api-errors';
import type { DataCompleteness } from '@/types';
import { LtrAuditTrail } from './ltr-audit-trail';
import { LTR_IMU_CHANNELS_KEY, ltrAuditKey } from '../lib/ltr-query-keys';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50';

type TextField = 'recipientOffice' | 'email' | 'pec' | 'postalAddress' | 'sourceUrl' | 'rateSourceUrl';
type NumberField = 'ratePercent' | 'effectiveRatePercent' | 'rateYear';

const TEXT_FIELDS: { key: TextField; type: string }[] = [
  { key: 'recipientOffice', type: 'text' },
  { key: 'email', type: 'email' },
  { key: 'pec', type: 'email' },
  { key: 'postalAddress', type: 'text' },
  { key: 'sourceUrl', type: 'url' },
  { key: 'rateSourceUrl', type: 'url' },
];

const NUMBER_FIELDS: NumberField[] = ['ratePercent', 'effectiveRatePercent', 'rateYear'];

function toInput(channel: AdminImuChannel): UpdateImuChannelInput {
  return {
    recipientOffice: channel.recipientOffice,
    email: channel.email,
    pec: channel.pec,
    postalAddress: channel.postalAddress,
    instructions: channel.instructions,
    ratePercent: channel.ratePercent,
    effectiveRatePercent: channel.effectiveRatePercent,
    rateYear: channel.rateYear,
    rateKind: channel.rateKind,
    rateNotes: channel.rateNotes,
    rateSourceUrl: channel.rateSourceUrl,
    sourceUrl: channel.sourceUrl,
    dataCompleteness: channel.dataCompleteness,
  };
}

const blankToNull = (value: string | null) => (value == null || value.trim() === '' ? null : value.trim());

/** Edit of the comune office receiving the IMU communication and of its rate (LT-13). */
export function LtrImuChannelDialog({ channel, onClose }: { channel: AdminImuChannel; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UpdateImuChannelInput>(() => toInput(channel));

  const save = useMutation({
    mutationFn: (input: UpdateImuChannelInput) => ltrReferenceDataApi.updateImuChannel(channel.id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LTR_IMU_CHANNELS_KEY });
      void queryClient.invalidateQueries({ queryKey: ltrAuditKey(channel.id) });
      toast.success(t('ltrReferenceData.toast.saved'));
      onClose();
    },
    onError: (error) => toast.error(getProblemMessage(error, t) ?? t('ltrReferenceData.toast.saveFailed')),
  });

  const set = <K extends keyof UpdateImuChannelInput>(key: K, value: UpdateImuChannelInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    save.mutate({
      ...form,
      recipientOffice: form.recipientOffice.trim(),
      email: blankToNull(form.email),
      pec: blankToNull(form.pec),
      postalAddress: blankToNull(form.postalAddress),
      instructions: blankToNull(form.instructions),
      rateNotes: blankToNull(form.rateNotes),
      sourceUrl: blankToNull(form.sourceUrl),
      rateSourceUrl: blankToNull(form.rateSourceUrl),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('ltrReferenceData.imu.editTitle', { comune: channel.comune })}</DialogTitle>
          <DialogDescription>{t('ltrReferenceData.imu.editDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map(({ key, type }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`imu-${key}`}>{t(`ltrReferenceData.imu.fields.${key}`)}</Label>
                <Input
                  id={`imu-${key}`}
                  type={type}
                  value={form[key] ?? ''}
                  required={key === 'recipientOffice'}
                  maxLength={key === 'sourceUrl' || key === 'rateSourceUrl' ? 500 : 300}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
            {NUMBER_FIELDS.map((key) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`imu-${key}`}>{t(`ltrReferenceData.imu.fields.${key}`)}</Label>
                <Input
                  id={`imu-${key}`}
                  type="number"
                  min={0}
                  step={key === 'rateYear' ? 1 : 0.001}
                  value={form[key] == null ? '' : String(form[key])}
                  onChange={(e) => set(key, e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label htmlFor="imu-rateKind">{t('ltrReferenceData.imu.fields.rateKind')}</Label>
              <select
                id="imu-rateKind"
                className={SELECT_CLASS}
                value={form.rateKind ?? ''}
                onChange={(e) => set('rateKind', e.target.value === '' ? null : (e.target.value as ImuRateKind))}
              >
                <option value="">{t('ltrReferenceData.imu.rateKind.none')}</option>
                {IMU_RATE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`ltrReferenceData.imu.rateKind.${kind}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="imu-completeness">{t('ltrReferenceData.fields.dataCompleteness')}</Label>
              <select
                id="imu-completeness"
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
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="imu-instructions">{t('ltrReferenceData.imu.fields.instructions')}</Label>
              <Textarea
                id="imu-instructions"
                value={form.instructions ?? ''}
                maxLength={2000}
                onChange={(e) => set('instructions', e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="imu-rateNotes">{t('ltrReferenceData.imu.fields.rateNotes')}</Label>
              <Textarea
                id="imu-rateNotes"
                value={form.rateNotes ?? ''}
                maxLength={1000}
                onChange={(e) => set('rateNotes', e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('ltrReferenceData.cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending || form.recipientOffice.trim() === ''}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('ltrReferenceData.save')}
            </Button>
          </DialogFooter>
        </form>
        <LtrAuditTrail entityId={channel.id} />
      </DialogContent>
    </Dialog>
  );
}
