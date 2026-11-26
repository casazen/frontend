import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { useProperties } from '@/queries/use-properties';
import { useSegments } from '@/queries/campaigns';
import { getProblemMessage } from '@/lib/api-errors';

export function MarketingError({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <Alert variant="danger" icon={AlertCircle} title={t('shared.error')}>
      {getProblemMessage(error, t) ?? t('campaigns.loadError')}
    </Alert>
  );
}

interface PickerProps {
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}

export function PropertyPicker({ value, onChange, required }: PickerProps) {
  const { t } = useTranslation();
  const properties = useProperties({ mode: 'short' });
  return (
    <div>
      <label>
        {t('marketingStudio.property')}
        <Select required={required} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t('marketingStudio.chooseProperty')}</option>
          {properties.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </label>
      <MarketingError error={properties.error} />
    </div>
  );
}

export function AudiencePicker({ value, onChange, required }: PickerProps) {
  const { t } = useTranslation();
  const segments = useSegments();
  return (
    <div>
      <label>
        {t('campaigns.editor.segment')}
        <Select required={required} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t('campaigns.editor.selectSegment')}</option>
          {segments.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </label>
      <MarketingError error={segments.error} />
    </div>
  );
}
