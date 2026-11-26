import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProofUploadDialog } from '@/features/compliance/components/proof-upload-dialog';
import { listedMonths } from '@/features/compliance/lib/archive-model';
import { useWorkspace } from '@/hooks/use-workspace';
import { todayInRome } from '@/lib/stay-dates';

export interface ComoMonthlyDeclaration {
  taxableGuests: number;
  taxableGuestNights: number;
  hostTax: number;
  unconfirmedStays: number;
  channelStaysToReconcile: number;
  exemptions: Record<string, { guests: number; guestNights: number }>;
}

export function ComoStayTourReport({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const [month, setMonth] = useState(() => listedMonths(todayInRome())[1]);
  const [upload, setUpload] = useState(false);
  const id = useId();
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= '2000-01' && month <= todayInRome().slice(0, 7);
  const report = useQuery({
    queryKey: ['como-staytour', propertyId, month],
    queryFn: () => ApiClient.get<ComoMonthlyDeclaration>(`/properties/${propertyId}/staytour/como/${month}`),
    enabled: validMonth && hasPermission('short-rent', 'payment.read'),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const canReadProofs = hasPermission('short-rent', 'booking.read');
  const canAttach = canReadProofs && hasPermission('short-rent', 'alloggiati.submit') && hasPermission('short-rent', 'payment.write');
  const archive = new URLSearchParams({ property: propertyId, kind: 'TouristTaxDeclaration', tab: 'proofs', period: month });
  const data = report.isSuccess ? report.data : null;
  const key = 'comoStayTour.';
  const money = new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR' });
  return (
    <section aria-labelledby={id} className="space-y-3 border-t pt-4">
      <h4 id={id} className="font-semibold">{t(key + 'title')}</h4>
      <label className="block max-w-52 text-sm">
        {t(key + 'period')}
        <Input type="month" value={month} min="2000-01" max={todayInRome().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
      </label>
      {validMonth && report.isLoading && <p role="status">{t(key + 'loading')}</p>}
      {report.isError && <div role="alert">{t(key + 'error')} <Button variant="ghost" onClick={() => void report.refetch()}>{t(key + 'retry')}</Button></div>}
      {data && <>
        <p className="text-sm text-muted-foreground">{t(key + 'basis')}</p>
        {data.unconfirmedStays > 0 && <p role="status">{t(key + 'missing', { count: data.unconfirmedStays })}</p>}
        <dl className="grid gap-3 sm:grid-cols-3">
          <div><dt>{t(key + 'taxable')}</dt><dd className="font-semibold">{data.taxableGuests}</dd></div>
          <div><dt>{t(key + 'nights')}</dt><dd className="font-semibold">{data.taxableGuestNights}</dd></div>
          <div><dt>{t(key + 'amount')}</dt><dd className="font-semibold">{money.format(data.hostTax)}</dd></div>
        </dl>
        {Object.keys(data.exemptions).length > 0 && <table className="w-full text-left text-sm">
          <thead><tr><th>{t(key + 'reason')}</th><th>{t(key + 'guests')}</th><th>{t(key + 'overnights')}</th></tr></thead>
          <tbody>{Object.entries(data.exemptions).map(([reason, count]) => <tr key={reason}>
            <th scope="row">{t(['touristTax.exemption.' + reason, key + reason], { defaultValue: reason })}</th>
            <td>{count.guests}</td><td>{count.guestNights}</td>
          </tr>)}</tbody>
        </table>}
        <p className="text-sm">{t(key + 'channel', { count: data.channelStaysToReconcile })}</p>
      </>}
      {validMonth && canReadProofs && <div className="flex flex-wrap gap-2">
        {canAttach && <Button type="button" variant="outline" onClick={() => setUpload(true)}>{t(key + 'attach')}</Button>}
        <Button asChild variant="outline"><Link to={`/app/short-rent/alloggiati/reports?${archive}`}>{t(key + 'archive')}</Link></Button>
      </div>}
      {canAttach && validMonth && upload && <ProofUploadDialog open onClose={() => setUpload(false)}
        properties={[{ id: propertyId, name: propertyName }]} kinds={['TouristTaxDeclaration']}
        prefill={{ propertyId, period: month, kind: 'TouristTaxDeclaration' }} />}
    </section>
  );
}
