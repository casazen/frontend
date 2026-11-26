import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiClient } from '@/api/client';
import axios from '@/lib/axios';
import type { ServiceFiles, SupplierFile } from './use-guest-supplier-files';

const labels = {
  it: { title: 'Documenti dei servizi', receipt: 'Ricevuta del pagamento Stripe', issuer: 'Il documento fiscale del servizio è di competenza di {seller}.', upload: 'Carica PDF', file: 'Documento del fornitore (PDF, massimo 8 MB)', saved: 'Documento disponibile all’ospite.', failed: 'Operazione non riuscita. Riprova.', invalid: 'Scegli un PDF fino a 8 MB.' },
  en: { title: 'Service documents', receipt: 'Stripe payment receipt', issuer: '{seller} is responsible for the tax document for this service.', upload: 'Upload PDF', file: 'Supplier document (PDF, up to 8 MB)', saved: 'The document is available to the guest.', failed: 'This action failed. Try again.', invalid: 'Choose a PDF up to 8 MB.' },
  de: { title: 'Unterlagen zu den Leistungen', receipt: 'Stripe-Zahlungsbeleg', issuer: 'Für den Steuerbeleg dieser Leistung ist {seller} zuständig.', upload: 'PDF hochladen', file: 'Anbieterdokument (PDF, bis zu 8 MB)', saved: 'Das Dokument ist für den Gast verfügbar.', failed: 'Vorgang fehlgeschlagen. Bitte erneut versuchen.', invalid: 'Wählen Sie eine PDF-Datei bis 8 MB.' },
  fr: { title: 'Documents des prestations', receipt: 'Reçu de paiement Stripe', issuer: '{seller} est responsable du document fiscal de cette prestation.', upload: 'Importer le PDF', file: 'Document du prestataire (PDF, 8 Mo maximum)', saved: 'Le document est disponible pour le voyageur.', failed: 'Échec de l’opération. Réessayez.', invalid: 'Choisissez un PDF de 8 Mo maximum.' },
  es: { title: 'Documentos de los servicios', receipt: 'Recibo de pago de Stripe', issuer: '{seller} es responsable del documento fiscal de este servicio.', upload: 'Subir PDF', file: 'Documento del proveedor (PDF, hasta 8 MB)', saved: 'El documento está disponible para el huésped.', failed: 'La operación ha fallado. Inténtalo de nuevo.', invalid: 'Elige un PDF de hasta 8 MB.' },
};
function copy(language = 'it') {
  return labels[language.toLowerCase().split('-')[0] as keyof typeof labels] ?? labels.en;
}

export function GuestSupplierFiles({ endpoint, language, orders }: { endpoint: string; language: string; orders: ServiceFiles[] }) {
  const text = copy(language);
  const download = useMutation({
    mutationFn: async (file: SupplierFile) => {
      const response = await axios.get<Blob>(`${endpoint}/supplier-services/${file.id}/pdf`, { public: true, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  const receipt = useMutation({
    mutationFn: async (orderId: string) => {
      const result = await ApiClient.get<{ url: string }>(`${endpoint}/supplier-services/${orderId}/payment-receipt`, undefined, { public: true });
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || url.hostname !== 'pay.stripe.com' || url.username || url.password) throw new Error();
      window.location.assign(url.href);
    },
  });
  if (!orders.length) return null;
  return <section>
    <h3>{text.title}</h3>
    {orders.map(order => <div key={order.id} className="stay-document">
      <span>{order.serviceName}</span>
      <span>{text.issuer.replace('{seller}', () => order.supplierName)}</span>
      <button type="button" disabled={receipt.isPending} onClick={() => receipt.mutate(order.id)}>{text.receipt}</button>
      {order.documents.map(file => <button type="button" key={file.id} disabled={download.isPending}
        onClick={() => download.mutate(file)}>{file.fileName}</button>)}
    </div>)}
    {(receipt.isError || download.isError) && <p role="alert">{text.failed}</p>}
  </section>;
}

export function SupplierOrderFiles({ orderId }: { orderId: string }) {
  const text = copy(useTranslation().i18n.language);
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const endpoint = `/supplier/guest-orders/${orderId}/documents`;
  const files = useQuery({ queryKey: ['supplier-order-documents', orderId], enabled: open,
    queryFn: ({ signal }) => ApiClient.get<SupplierFile[]>(endpoint, undefined, { signal }) });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      await axios.post(endpoint, body, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const file = input.files?.[0];
    if (!(file instanceof File) || file.size === 0 || file.size > 8 * 1024 * 1024) { setInvalid(true); return; }
    setInvalid(false);
    upload.mutate(file, { onSuccess: () => { form.reset(); void files.refetch(); } });
  }
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{text.title}</summary>
    {open && <>
      <ul>{files.data?.map(file => <li key={file.id}>{file.fileName}</li>)}</ul>
      <form onSubmit={submit}>
        <label htmlFor={inputId}>{text.file}</label>
        <input id={inputId} name="file" type="file" accept="application/pdf,.pdf" required
          onChange={() => { setInvalid(false); upload.reset(); }} />
        <button type="submit" disabled={upload.isPending}>{text.upload}</button>
      </form>
      {upload.isSuccess && <p role="status">{text.saved}</p>}
      {invalid && <p role="alert">{text.invalid}</p>}
      {(files.isError || upload.isError) && <p role="alert">{text.failed}</p>}
    </>}
  </details>;
}
