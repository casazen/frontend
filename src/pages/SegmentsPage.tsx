import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { PageHeader } from '@/components/layout/page-header';
import { AppShell } from '@/components/layout/app-shell';
import { MarketingError } from '@/components/campaigns/MarketingInputs';
import { GuestImport } from '@/components/campaigns/GuestImport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useCreateSegment, useFields, usePreviewCount, useSegments } from '@/queries/campaigns';
import type { ConditionDefinition, CreateSegmentDto, FieldDefinition } from '@/types/campaign.types';

interface RuleInput {
  fieldId: string;
  operator: string;
  value: string;
}

function toValue(rule: RuleInput, field: FieldDefinition) {
  const convert = (s: string) =>
    field.fieldType === 'Number' || rule.operator === 'inLast'
      ? Number(s)
      : field.fieldType === 'Boolean'
        ? s === 'true'
        : s.trim();
  return ['in', 'notIn', 'between'].includes(rule.operator) ? rule.value.split(',').map(convert) : convert(rule.value);
}

export function SegmentsPage() {
  const { t } = useTranslation();
  const [section, setSection] = useState<'list' | 'new' | 'import'>('list');
  const [selected, setSelected] = useState('');
  const segments = useSegments();
  const preview = usePreviewCount(selected);
  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title={t('nav.crmSegments')} description={t('campaigns.segment.description')} crumbs="auto" />
        <div className="flex flex-wrap gap-2">
          {(['list', 'new', 'import'] as const).map((item, i) => (
            <Button
              key={item}
              aria-pressed={section === item}
              variant={section === item ? 'default' : 'outline'}
              onClick={() => setSection(item)}
            >
              {t(['nav.crmSegments', 'campaigns.segment.create', 'marketingStudio.importTitle'][i])}
            </Button>
          ))}
        </div>
        {section === 'list' && (
          <div className="space-y-3">
            <MarketingError error={segments.error ?? preview.error} />
            {segments.isLoading && <p role="status">{t('campaigns.segment.loading')}</p>}
            {segments.data?.length === 0 && <p>{t('campaigns.segment.emptyList')}</p>}
            {segments.data?.map((segment) => (
              <article className="rounded-xl border bg-card p-4" key={segment.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold">{segment.name}</h2>
                  <Button variant="outline" onClick={() => setSelected(segment.id === selected ? '' : segment.id)}>
                    {t(selected === segment.id ? 'campaigns.segment.hidePreview' : 'campaigns.segment.preview')}
                  </Button>
                </div>
                {selected === segment.id && (
                  <p role="status">
                    {preview.data
                      ? t('campaigns.segment.previewCount', { count: preview.data.count })
                      : preview.isPending
                        ? t('campaigns.segment.loading')
                        : null}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
        {section === 'new' && <SegmentForm onSaved={() => setSection('list')} />}
        {section === 'import' && <GuestImport />}
      </div>
    </AppShell>
  );
}

function SegmentForm({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslation();
  const fields = useFields();
  const save = useCreateSegment();
  const [name, setName] = useState('');
  const [phrase, setPhrase] = useState('');
  const [rules, setRules] = useState<RuleInput[]>([]);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [suggested, setSuggested] = useState<ConditionDefinition>();
  const ai = useMutation({
    mutationFn: () => ApiClient.post<CreateSegmentDto>('/campaigns/studio/suggest-segment', { brief: phrase }),
    onSuccess: (result) => {
      setName(result.name);
      setSuggested(result.condition);
    },
  });
  function update(i: number, change: Partial<RuleInput>) {
    setRules((items) => items.map((rule, idx) => (idx === i ? { ...rule, ...change } : rule)));
  }
  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const condition: ConditionDefinition = suggested ?? {
          version: '1.0',
          groups: [
            {
              operator: logic,
              rules: rules.map((r) => ({
                ...r,
                value: toValue(
                  r,
                  fields.data!.find((f) => f.fieldId === r.fieldId)!,
                ),
              })),
            },
          ],
        };
        save.mutate({ name: name.trim(), condition }, { onSuccess: onSaved });
      }}
    >
      <h2 className="text-xl font-semibold">{t('campaigns.segment.newSegment')}</h2>
      <label className="block">
        {t('marketingStudio.audiencePhrase')}
        <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} />
      </label>
      <Button variant="outline" type="button" disabled={!phrase.trim() || ai.isPending} onClick={() => ai.mutate()}>
        {t('marketingStudio.suggestRules')}
      </Button>
      <label className="block">
        {t('campaigns.segment.name')}
        <Input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {suggested ? (
        <div>
          <ul>
            {suggested.groups.map((group, i) => (
              <li key={i}>
                {group.rules
                  .map((r) =>
                    [
                      t('marketingStudio.fields.' + r.fieldId, { defaultValue: r.fieldId }),
                      t('marketingStudio.operators.' + r.operator, { defaultValue: r.operator }),
                      String(r.value),
                    ].join(' '),
                  )
                  .join(' ' + group.operator + ' ')}
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" onClick={() => setSuggested(undefined)}>
            {t('marketingStudio.manualRules')}
          </Button>
        </div>
      ) : (
        <>
          <label className="block">
            {t('marketingStudio.match')}
            <Select value={logic} onChange={(e) => setLogic(e.target.value as typeof logic)}>
              <option value="AND">{t('marketingStudio.all')}</option>
              <option value="OR">{t('marketingStudio.any')}</option>
            </Select>
          </label>
          {rules.map((rule, i) => {
            const field = fields.data?.find((f) => f.fieldId === rule.fieldId);
            return (
              <div key={i} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label>
                  {t('marketingStudio.field')}
                  <Select
                    value={rule.fieldId}
                    onChange={(e) => {
                      const next = fields.data!.find((f) => f.fieldId === e.target.value)!;
                      update(i, { fieldId: next.fieldId, operator: next.operators[0], value: '' });
                    }}
                  >
                    {fields.data?.map((f) => (
                      <option key={f.fieldId} value={f.fieldId}>
                        {t('marketingStudio.fields.' + f.fieldId, { defaultValue: f.fieldId })}
                      </option>
                    ))}
                  </Select>
                </label>
                <label>
                  {t('marketingStudio.operator')}
                  <Select value={rule.operator} onChange={(e) => update(i, { operator: e.target.value, value: '' })}>
                    {field?.operators.map((op) => (
                      <option key={op} value={op}>
                        {t('marketingStudio.operators.' + op, { defaultValue: op })}
                      </option>
                    ))}
                  </Select>
                </label>
                <label>
                  {t('marketingStudio.value')}
                  {field?.fieldType === 'Boolean' ? (
                    <Select required value={rule.value} onChange={(e) => update(i, { value: e.target.value })}>
                      <option value="">—</option>
                      <option value="true">{t('marketingStudio.yes')}</option>
                      <option value="false">{t('marketingStudio.no')}</option>
                    </Select>
                  ) : (
                    <Input
                      required
                      type={
                        ['between', 'in', 'notIn'].includes(rule.operator)
                          ? 'text'
                          : field?.fieldType === 'Number' || rule.operator === 'inLast'
                            ? 'number'
                            : field?.fieldType === 'Date'
                              ? 'date'
                              : 'text'
                      }
                      value={rule.value}
                      onChange={(e) => update(i, { value: e.target.value })}
                      placeholder={
                        ['between', 'in', 'notIn'].includes(rule.operator)
                          ? t('marketingStudio.commaValues')
                          : undefined
                      }
                    />
                  )}
                </label>
                <Button
                  className="self-end"
                  variant="outline"
                  type="button"
                  onClick={() => setRules((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  {t('marketingStudio.remove')}
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            disabled={!fields.data?.length}
            onClick={() => {
              const f = fields.data![0];
              setRules([...rules, { fieldId: f.fieldId, operator: f.operators[0], value: '' }]);
            }}
          >
            {t('marketingStudio.addRule')}
          </Button>
          {!rules.length && <p>{t('marketingStudio.allReachable')}</p>}
        </>
      )}
      <MarketingError error={fields.error ?? ai.error ?? save.error} />
      <Button type="submit" disabled={!name.trim() || save.isPending || ai.isPending}>
        {t('shared.save')}
      </Button>
    </form>
  );
}
