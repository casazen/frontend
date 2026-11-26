import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CRM_GUESTS_KEY } from '@/queries/crm';
import { marketingStudioApi } from '@/api/marketing-studio.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { MarketingError, PropertyPicker } from './MarketingInputs';

const fields = ['name', 'email', 'phone', 'language', 'country', 'firstStay', 'lastStay', 'tags'] as const;

export function GuestImport() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [file, setFile] = useState<File>();
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [propertyId, setPropertyId] = useState('');
  const [basis, setBasis] = useState('');
  const [source, setSource] = useState('');
  const preview = useMutation({
    mutationFn: marketingStudioApi.previewImport,
    onSuccess: (data) => {
      const suggested: Record<string, number> = {};
      fields.forEach((field) => {
        const index = data.headers.findIndex((h) => h.trim().toLowerCase() === field.toLowerCase());
        if (index >= 0) suggested[field] = index;
      });
      setMapping(suggested);
    },
  });
  const submit = useMutation({
    mutationFn: (f: File) => marketingStudioApi.importGuests(f, mapping, propertyId, basis, source.trim()),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['segments'] });
      void client.invalidateQueries({ queryKey: CRM_GUESTS_KEY });
    },
  });
  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (file) submit.mutate(file);
      }}
    >
      <h2 className="text-xl font-semibold">{t('marketingStudio.importTitle')}</h2>
      <label className="block">
        {t('marketingStudio.file')}
        <Input
          type="file"
          accept=".csv,.xlsx"
          disabled={preview.isPending || submit.isPending}
          onChange={(e) => {
            const next = e.target.files?.[0];
            setFile(next);
            preview.reset();
            submit.reset();
            setMapping({});
            if (next) preview.mutate(next);
          }}
        />
      </label>
      <MarketingError error={preview.error} />
      {preview.data && (
        <>
          <p>{t('marketingStudio.rows', { count: preview.data.totalRows })}</p>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {preview.data.headers.map((h, i) => (
                    <th key={i} className="p-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.sample.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="border-t p-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="font-semibold">{t('marketingStudio.mapColumns')}</legend>
            {fields.map((field) => (
              <label key={field}>
                {t('marketingStudio.importFields.' + field)}
                <Select
                  value={mapping[field] ?? ''}
                  onChange={(e) => {
                    const next = { ...mapping };
                    if (e.target.value === '') delete next[field];
                    else next[field] = Number(e.target.value);
                    setMapping(next);
                  }}
                >
                  <option value="">{t('marketingStudio.skip')}</option>
                  {preview.data.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </fieldset>
          <PropertyPicker required value={propertyId} onChange={setPropertyId} />
          <label className="block">
            {t('marketingStudio.basis')}
            <Select required value={basis} onChange={(e) => setBasis(e.target.value)}>
              <option value="">—</option>
              {['consent', 'softOptIn', 'serviceOnly'].map((b) => (
                <option key={b} value={b}>
                  {t('marketingStudio.' + b)}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            {t('marketingStudio.source')}
            <Input required maxLength={100} value={source} onChange={(e) => setSource(e.target.value)} />
          </label>
          {basis==='softOptIn' && mapping.lastStay===undefined && <p role="status">{t('marketingStudio.softOptInStay')}</p>}
      <MarketingError error={submit.error} />
          {submit.data && (
            <div role="status">
              <p>{t('marketingStudio.importResult', submit.data)}</p>
              <ul>
                {submit.data.errors.map((err) => (
                  <li key={err.row}>{t('marketingStudio.rowError', err)}</li>
                ))}
              </ul>
            </div>
          )}
          <Button type="submit" disabled={submit.isPending || submit.isSuccess || !Object.keys(mapping).length || (basis === 'softOptIn' && mapping.lastStay === undefined)}>
            {t('marketingStudio.importTitle')}
          </Button>
        </>
      )}
    </form>
  );
}
