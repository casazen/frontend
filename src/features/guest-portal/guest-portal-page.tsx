import { ArrowLeft, BookOpen, CalendarDays, ChevronRight, Ellipsis, Globe2, House, MapPin, UsersRound, ClipboardCheck, CreditCard, FileText, Leaf, MessageCircle, ShoppingBag } from 'lucide-react';
import { GuestSupplierOrders } from './guest-supplier-orders';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ApiClient } from '@/api/client';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useGuestTouristTax } from '@/queries/use-checkin';
import { GuestCheckInFlow } from '@/features/checkin/checkin-page';
import { guestTaxAvailability, guestTaxOutlook } from '@/features/checkin/lib/tourist-tax-model';
import { getHttpStatus } from '@/lib/api-errors';
import { useSeoMeta } from '@/lib/seo-meta';
import { HostSiteNotFoundPage } from '@/features/public-site/host/host-site-pages';
import { readableTextOn } from '@/lib/public-site-colors';
import { normalizeHexColor } from '@/lib/public-site-themes';
import { LegacySupplierShowcaseRedirect } from '@/pages/supplier-showcase';
import { GuestHostExtras } from './guest-host-extras';
import { extraLabels, useGuestHostExtras } from './guest-host-extra-model';
import { GuestPortalChat } from './guest-portal-chat';
import { GuestPortalDocuments } from './guest-portal-documents';
import { GuestPortalPayments } from './guest-portal-payments';
import { GuestPortalReview } from './guest-portal-review';
import { HouseGuideSections } from './house-guide';
import type { HouseGuide } from './house-guide-fields';
import { GuestPortalCancellation } from './guest-portal-cancellation';
import { GuestPortalStayChange } from './guest-portal-stay-change';
import { useStayManifest } from './use-stay-manifest';
import { guestAccountStaysPath } from './guest-account-stays-page';
import { GuestPortalPrivacy } from './guest-portal-privacy';
import './guest-portal.css';

const poweredBy = 'Powered by CasaZen';
const languages = ['it', 'en', 'de', 'fr', 'es'] as const;
type Language = typeof languages[number];

const copy = {
  portal: ['Portale ospiti', 'Guest portal', 'Gästeportal', 'Portail voyageurs', 'Portal de huéspedes'],
  services: ['Servizi', 'Services', 'Services', 'Services', 'Servicios'],
  servicesAndExtras: ['Servizi e extra', 'Services and extras', 'Dienste und Extras', 'Services et extras', 'Servicios y extras'],
  more: ['Altro', 'More', 'Mehr', 'Plus', 'Más'],
  booking: ['Prenotazione', 'Booking', 'Buchung', 'Réservation', 'Reserva'],
  yourBooking: ['La tua prenotazione', 'Your booking', 'Deine Buchung', 'Votre réservation', 'Tu reserva'],
  viewBooking: ['Vedi la prenotazione', 'View booking', 'Buchung ansehen', 'Voir la réservation', 'Ver reserva'],
  guest: ['Ospite', 'Guest', 'Gast', 'Voyageur', 'Huésped'],
  everything: ['Tutto per il tuo soggiorno', 'Everything for your stay', 'Alles für deinen Aufenthalt', 'Tout pour votre séjour', 'Todo para tu estancia'],
  guideNote: ['Istruzioni e consigli per il soggiorno', 'Instructions and tips for your stay', 'Hinweise und Tipps zum Aufenthalt', 'Instructions et conseils pour le séjour', 'Instrucciones y consejos para tu estancia'],
  servicesNote: ['Organizza il tuo arrivo', 'Plan your arrival', 'Plane deine Anreise', 'Préparez votre arrivée', 'Organiza tu llegada'],
  chatNote: ['Scrivici se hai bisogno', 'Message us if you need help', 'Schreib uns, wenn du Hilfe brauchst', 'Écrivez-nous si besoin', 'Escríbenos si lo necesitas'],
  documentsNote: ['Scarica i PDF del soggiorno', 'Download your stay PDFs', 'Aufenthaltsdokumente herunterladen', 'Télécharger les PDF du séjour', 'Descarga los PDF de tu estancia'],
  supplierOrders: ['Servizi e ordini', 'Services and orders', 'Dienste und Bestellungen', 'Services et commandes', 'Servicios y pedidos'],
  title: ['Il tuo soggiorno', 'Your stay', 'Dein Aufenthalt', 'Votre séjour', 'Tu estancia'],
  before: ['Prima dell’arrivo', 'Before arrival', 'Vor der Anreise', 'Avant l’arrivée', 'Antes de llegar'],
  during: ['Durante il soggiorno', 'During your stay', 'Während des Aufenthalts', 'Pendant le séjour', 'Durante la estancia'],
  after: ['Dopo la partenza', 'After departure', 'Nach der Abreise', 'Après le départ', 'Después de la salida'],
  next: ['Prossimo passo', 'Next step', 'Nächster Schritt', 'Prochaine étape', 'Siguiente paso'],
  complete: ['Completa il check-in', 'Complete check-in', 'Check-in abschließen', 'Terminez le check-in', 'Completa el registro'],
  open: ['Fai il check-in', 'Start check-in', 'Check-in starten', 'Faire le check-in', 'Iniciar el registro'],
  checkInSection: ['Check-in online', 'Online check-in', 'Online-Check-in', 'Enregistrement en ligne', 'Registro en línea'],
  checkInHelp: ['Inserisci i dati degli ospiti per preparare il tuo arrivo.', 'Enter guest details to prepare for arrival.', 'Gib die Gästedaten für die Anreise ein.', 'Renseignez les données des voyageurs avant votre arrivée.', 'Introduce los datos de los huéspedes antes de llegar.'],
  checkInWait: ['L’host ti avviserà quando potrai fare il check-in.', 'Your host will let you know when check-in opens.', 'Dein Gastgeber informiert dich, sobald der Check-in öffnet.', 'Votre hôte vous indiquera quand le check-in sera ouvert.', 'Tu anfitrión te avisará cuando se abra el registro.'],
  payTax: ['Paga la tassa di soggiorno', 'Pay the tourist tax', 'Kurtaxe bezahlen', 'Payer la taxe de séjour', 'Paga la tasa turística'],
  guide: ['Guida della casa', 'House guide', 'Hausführer', 'Guide du logement', 'Guía del alojamiento'],
  stay: ['Soggiorno', 'Stay', 'Aufenthalt', 'Séjour', 'Estancia'],
  details: ['Informazioni sulla prenotazione', 'Booking details', 'Buchungsdetails', 'Détails de la réservation', 'Detalles de la reserva'],
  arrival: ['Orario di arrivo', 'Arrival time', 'Ankunftszeit', 'Heure d’arrivée', 'Hora de llegada'],
  late: ['Arrivo tardi', 'Late arrival', 'Späte Anreise', 'Arrivée tardive', 'Llegada tardía'],
  save: ['Salva', 'Save', 'Speichern', 'Enregistrer', 'Guardar'],
  saved: ['Orario salvato.', 'Arrival time saved.', 'Ankunftszeit gespeichert.', 'Heure d’arrivée enregistrée.', 'Hora guardada.'],
  address: ['Indirizzo', 'Address', 'Adresse', 'Adresse', 'Dirección'],
  addressLocked: ['L’indirizzo completo sarà visibile dopo il check-in.', 'The full address appears after check-in.', 'Die vollständige Adresse erscheint nach dem Check-in.', 'L’adresse complète s’affiche après le check-in.', 'La dirección completa se muestra tras el registro.'],
  rules: ['Regole della casa', 'House rules', 'Hausregeln', 'Règlement intérieur', 'Normas del alojamiento'],
  done: ['Check-in completato', 'Check-in completed', 'Check-in abgeschlossen', 'Check-in terminé', 'Registro completado'],
  load: ['Caricamento…', 'Loading…', 'Wird geladen…', 'Chargement…', 'Cargando…'],
  unavailable: ['Link scaduto o revocato. Chiedi all’host un link valido.', 'This link has expired or been revoked. Ask your host for a valid link.', 'Dieser Link ist abgelaufen oder wurde widerrufen. Bitte frage deinen Gastgeber nach einem gültigen Link.', 'Ce lien a expiré ou a été révoqué. Demandez un lien valide à votre hôte.', 'Este enlace ha caducado o se ha revocado. Pide un enlace válido a tu anfitrión.'],
  error: ['Non siamo riusciti a completare l’operazione.', 'We could not complete the request.', 'Die Anfrage konnte nicht abgeschlossen werden.', 'Nous n’avons pas pu terminer la demande.', 'No se pudo completar la solicitud.'],
  retry: ['Riprova', 'Try again', 'Erneut versuchen', 'Réessayer', 'Reintentar'],
  chat: ['Chat con l’host', 'Chat with your host', 'Chat mit dem Gastgeber', 'Discussion avec l’hôte', 'Chat con tu anfitrión'],
  message: ['Messaggio', 'Message', 'Nachricht', 'Message', 'Mensaje'],
  send: ['Invia', 'Send', 'Senden', 'Envoyer', 'Enviar'],
  emptyChat: ['Ancora nessun messaggio.', 'No messages yet.', 'Noch keine Nachrichten.', 'Aucun message pour le moment.', 'Todavía no hay mensajes.'],
  closedChat: ['La chat è chiusa.', 'The chat is closed.', 'Der Chat ist geschlossen.', 'La discussion est fermée.', 'El chat está cerrado.'],
  payments: ['Pagamenti', 'Payments', 'Zahlungen', 'Paiements', 'Pagos'],
  balance: ['Saldo prenotazione', 'Booking balance', 'Offener Buchungsbetrag', 'Solde de la réservation', 'Saldo de la reserva'],
  paymentTotal: ['Totale soggiorno', 'Stay total', 'Gesamtbetrag', 'Total du séjour', 'Total de la estancia'],
  paymentPaid: ['Già versato', 'Already paid', 'Bereits bezahlt', 'Déjà versé', 'Ya pagado'],
  touristTax: ['Tassa di soggiorno', 'Tourist tax', 'Kurtaxe', 'Taxe de séjour', 'Tasa turística'],
  payNow: ['Paga ora', 'Pay now', 'Jetzt bezahlen', 'Payer maintenant', 'Pagar ahora'],
  paymentSettled: ['Nessun importo da pagare.', 'Nothing left to pay.', 'Kein offener Betrag.', 'Aucun montant à payer.', 'No queda nada por pagar.'],
  paymentDeferred: ['Addebito previsto alla scadenza.', 'Payment is scheduled for the deadline.', 'Abbuchung zum Fälligkeitstermin.', 'Débit prévu à la date limite.', 'Cargo programado para la fecha límite.'],
  paymentProcessing: ['Pagamento in corso di verifica.', 'Payment is being verified.', 'Die Zahlung wird geprüft.', 'Paiement en cours de vérification.', 'El pago se está verificando.'],
  servicePayments: ['Pagamenti dei servizi', 'Service payments', 'Zahlungen für Leistungen', 'Paiements des services', 'Pagos de servicios'],
  refreshPayment: ['Aggiorna lo stato', 'Refresh status', 'Status aktualisieren', 'Actualiser le statut', 'Actualizar estado'],
  paymentUnavailable: ['Pagamento online non disponibile.', 'Online payment is unavailable.', 'Online-Zahlung nicht verfügbar.', 'Paiement en ligne indisponible.', 'Pago en línea no disponible.'],
  documents: ['Documenti e ricevute', 'Documents and receipts', 'Dokumente und Belege', 'Documents et reçus', 'Documentos y recibos'],
  emptyDocuments: ['Non ci sono documenti disponibili.', 'No documents are available.', 'Keine Dokumente verfügbar.', 'Aucun document disponible.', 'No hay documentos disponibles.'],
  download: ['Scarica PDF', 'Download PDF', 'PDF herunterladen', 'Télécharger le PDF', 'Descargar PDF'],
  reviewHeading: ['Com’è andato il soggiorno?', 'How was your stay?', 'Wie war dein Aufenthalt?', 'Comment s’est passé votre séjour ?', '¿Cómo fue tu estancia?'],
  reviewAction: ['Scrivi una recensione', 'Write a review', 'Bewertung schreiben', 'Écrire un avis', 'Escribir una reseña'],
  review: ['Recensione', 'Review', 'Bewertung', 'Avis', 'Reseña'],
  rating: ['Valutazione', 'Rating', 'Bewertung', 'Note', 'Puntuación'],
  comment: ['Commento facoltativo', 'Optional comment', 'Optionaler Kommentar', 'Commentaire facultatif', 'Comentario opcional'],
  showName: ['Mostra il mio nome', 'Show my first name', 'Meinen Vornamen anzeigen', 'Afficher mon prénom', 'Mostrar mi nombre'],
  reviewSubmitted: ['Recensione inviata.', 'Review submitted.', 'Bewertung gesendet.', 'Avis envoyé.', 'Reseña enviada.'],
  reviewUnavailable: ['Puoi recensire il soggiorno nei 14 giorni dopo la partenza.', 'You can review the stay within 14 days after departure.', 'Du kannst den Aufenthalt innerhalb von 14 Tagen nach der Abreise bewerten.', 'Vous pouvez laisser un avis dans les 14 jours suivant le départ.', 'Puedes dejar una reseña dentro de los 14 días posteriores a la salida.'],
  cancellation: ['Cancella prenotazione', 'Cancel booking', 'Buchung stornieren', 'Annuler la réservation', 'Cancelar reserva'],
  confirmCancellation: ['Conferma la cancellazione', 'Confirm cancellation', 'Stornierung bestätigen', 'Confirmer l’annulation', 'Confirmar cancelación'],
  cancelled: ['Prenotazione cancellata.', 'Booking cancelled.', 'Buchung storniert.', 'Réservation annulée.', 'Reserva cancelada.'],
  cannotCancel: ['Contatta l’host per cancellare.', 'Contact your host to cancel.', 'Wende dich für die Stornierung an deinen Gastgeber.', 'Contactez votre hôte pour annuler.', 'Contacta con tu anfitrión para cancelar.'],
  otaChanges: ['Per modificare o cancellare, usa il canale su cui hai prenotato.', 'To change or cancel, use the channel you booked with.', 'Ändere oder storniere über deinen Buchungskanal.', 'Pour modifier ou annuler, utilisez le canal de réservation.', 'Para modificar o cancelar, usa el canal en el que reservaste.'],
  refund: ['Rimborso previsto', 'Expected refund', 'Voraussichtliche Erstattung', 'Remboursement prévu', 'Reembolso previsto'],
  refundChanged: ['Controlla il rimborso aggiornato prima di confermare.', 'Review the updated refund before confirming.', 'Prüfe die neue Erstattung vor der Bestätigung.', 'Vérifiez le nouveau remboursement avant de confirmer.', 'Revisa el nuevo reembolso antes de confirmar.'],
  accessCode: ['Mostra il codice di accesso', 'Show access code', 'Zugangscode anzeigen', 'Afficher le code d’accès', 'Mostrar código de acceso'],
  account: ['I miei soggiorni', 'My stays', 'Meine Aufenthalte', 'Mes séjours', 'Mis estancias'],
  privacy: ['Privacy e dati personali', 'Privacy and personal data', 'Datenschutz und personenbezogene Daten', 'Confidentialité et données personnelles', 'Privacidad y datos personales'],
  dataCopy: ['Richiedi una copia dei dati', 'Request a copy of your data', 'Eine Kopie deiner Daten anfordern', 'Demander une copie de vos données', 'Solicitar una copia de tus datos'],
  dataErasure: ['Richiedi la cancellazione dei dati', 'Request erasure of your data', 'Die Löschung deiner Daten beantragen', 'Demander l’effacement de vos données', 'Solicitar la supresión de tus datos'],
  requestConfirm: ['Conferma richiesta', 'Confirm request', 'Anfrage bestätigen', 'Confirmer la demande', 'Confirmar solicitud'],
  requestReceived: ['Richiesta ricevuta dall’host.', 'Your host received the request.', 'Dein Gastgeber hat die Anfrage erhalten.', 'Votre hôte a reçu la demande.', 'Tu anfitrión ha recibido la solicitud.'],
  requestClosed: ['Richiesta chiusa', 'Request closed', 'Anfrage abgeschlossen', 'Demande clôturée', 'Solicitud cerrada'],
  back: ['Indietro', 'Back', 'Zurück', 'Retour', 'Atrás'],
  correction: ['Chiedi una correzione', 'Request a correction', 'Eine Korrektur anfordern', 'Demander une correction', 'Solicitar una corrección'],
  language: ['Lingua', 'Language', 'Sprache', 'Langue', 'Idioma'],
} satisfies Record<string, readonly [string, string, string, string, string]>;

interface StayOverview {
  branding: { name: string; logoUrl: string | null; primaryColor: string | null };
  stay: {
    propertyName: string;
    city: string;
    checkIn: string;
    checkOut: string;
    bookingCode: string;
    guests: number;
    status: string;
    isDirect: boolean;
    isOta: boolean;
  };
  language: string;
  checkInCompleted: boolean;
  features?: { supplierServices?: boolean };
}

interface StayDetails {
  guide: HouseGuide;
  address: string | null;
  houseRules: string;
  arrivalTime: string | null;
  checkInAvailable: boolean;
  canEditArrival: boolean;
}

function supportedLanguage(value: string | null | undefined): Language | undefined {
  return languages.find((language) => language === value?.toLowerCase().split('-')[0]);
}

export function GuestPortalEntry({ hostOnly = false }: { hostOnly?: boolean }) {
  const { slug = '' } = useParams();
  if (/^[A-Za-z0-9_-]{32}$/.test(slug)) return <GuestPortalPage key={slug} token={slug} />;
  return hostOnly ? <HostSiteNotFoundPage /> : <LegacySupplierShowcaseRedirect />;
}

function GuestPortalPage({ token }: { token: string }) {
  const [params, setParams] = useSearchParams();
  const path = `/public/guest-portal/${token}`;
  const queryKey = ['guest-portal-details', token];
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['guest-portal', token],
    queryFn: ({ signal }) => ApiClient.get<StayOverview>(path, undefined, { public: true, signal }),
    gcTime: 0,
    retry: false,
  });
  const stayQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => ApiClient.get<StayDetails>(`${path}/stay`, undefined, { public: true, signal }),
    enabled: query.isSuccess,
    gcTime: 0,
    retry: false,
  });
  const overview = query.data;
  const stay = overview && stayQuery.data ? { ...overview.stay, ...stayQuery.data } : null;
  const failed = query.isError ? query.error : stayQuery.error;
  const { flags } = useFeatureFlags();
  const accessCode = useMutation({
    mutationFn: () => ApiClient.post<{ code: string }>(`${path}/access-code`, undefined, { public: true }),
    gcTime: 0,
  });
  const taxEnabled = flags.touristTaxOnlinePayment && Boolean(overview?.checkInCompleted && stay?.checkInAvailable && !failed);
  const tax = useGuestTouristTax(`stay_${token}`, taxEnabled);
  const taxAvailable = guestTaxAvailability({ ...tax, enabled: taxEnabled, hasData: tax.data !== undefined }) === 'ready';
  const shouldPayTax = taxAvailable && tax.data && guestTaxOutlook(tax.data) === 'payable';
  const nextStep = shouldPayTax ? 'payTax' : overview?.checkInCompleted ? 'guide' : 'complete';
  const language = supportedLanguage(params.get('lang')) ?? supportedLanguage(overview?.language)
    ?? supportedLanguage(navigator.language) ?? 'it';
  const text = (key: keyof typeof copy) => copy[key][languages.indexOf(language)];
  const section = params.get('page');
  const checkingIn = section === 'checkin';
  const services = section === 'services';
  const extras = section === 'extras';
  const extraCatalog = useGuestHostExtras(path, language, Boolean(stay) && !extras);
  const hasExtras = Boolean(extraCatalog.data?.offers.length || extraCatalog.data?.orders.length);
  const guide = section === 'guide';
  const details = section === 'details';
  const chat = section === 'chat' && stay?.status !== 'cancelled';
  const documents = section === 'documents';
  const payments = section === 'payments';
  const supplierOrders = section === 'supplier-orders' && overview?.features?.supplierServices;
  const review = section === 'review';
  const privacy = section === 'privacy';
  const cancellation = section === 'cancellation' && stay?.isDirect;
  const accent = normalizeHexColor(overview?.branding.primaryColor) ?? '#1F3A3D';
  useStayManifest(token, failed ? undefined : overview?.branding.name, accent);
  const href = (page?: string) => `?${new URLSearchParams(page ? { lang: language, page } : { lang: language })}`;
  const checkIn = href('checkin');
  const date = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`);
  const range = stay && new Intl.DateTimeFormat(language, {
    dateStyle: 'medium', timeZone: 'UTC',
  }).formatRange(date(stay.checkIn), date(stay.checkOut));

  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
  const phase = stay && (stay.status === 'checkedOut' || stay.status === 'cancelled' || today >= stay.checkOut)
    ? 'after' : stay && today >= stay.checkIn ? 'during' : 'before';

  const home = !checkingIn && !services && !extras && !guide && !details && !chat && !documents && !payments
    && !supplierOrders && !review && !privacy && !cancellation;
  const nav = [
    { key: 'stay', page: undefined, icon: House, current: home || checkingIn },
    { key: 'guide', page: 'guide', icon: BookOpen, current: guide },
    { key: 'services', page: 'services', icon: ShoppingBag, current: services || extras || supplierOrders },
    { key: 'chat', page: 'chat', icon: MessageCircle, current: chat },
    { key: 'more', page: 'details', icon: Ellipsis, current: !home && !checkingIn && !guide && !services && !extras && !supplierOrders && !chat },
  ] as const;
  const hasLayout = Boolean(stay && !failed);

  useSeoMeta({ title: text('title'), noindex: true, referrer: 'no-referrer' });

  return (
    <div className="guest-portal" data-stay-layout={hasLayout ? 'booking' : undefined} lang={language} style={{
      '--stay-accent': accent,
      '--stay-on-accent': readableTextOn(accent).color,
    } as CSSProperties}>
      <header className="stay-header">
        <div className="stay-header-inner">
          <Link to={href()} className="stay-brand">
            {overview?.branding.logoUrl ? <img src={overview.branding.logoUrl} alt="" referrerPolicy="no-referrer" /> : <Leaf aria-hidden="true" />}
            {overview?.branding.name || text('title')}
          </Link>
          <span className="stay-header-title">{text('portal')}</span>
          <label className="stay-language">
            <Globe2 aria-hidden="true" />
            <select aria-label={text('language')} value={language} onChange={(event) => {
            const next = new URLSearchParams(params);
            next.set('lang', event.target.value);
            setParams(next, { replace: true });
          }}>
            {languages.map((code) => <option key={code} value={code}>{code.toUpperCase()}</option>)}
            </select>
          </label>
          {hasLayout && overview?.branding.name && (
            <span className="stay-header-guest">{overview.branding.name} · {text('guest')}</span>
          )}
        </div>
      </header>
      <main className="stay-width stay-main" data-checkin={checkingIn || undefined}>
        {!stay && !failed && <p role="status">{text('load')}</p>}
        {failed && (
          <>
            <p role="alert">{getHttpStatus(failed) === 404 ? text('unavailable') : text('error')}</p>
            {getHttpStatus(failed) !== 404 && <button onClick={() => void (query.isError ? query.refetch() : stayQuery.refetch())}>{text('retry')}</button>}
          </>
        )}
        {stay && !failed && (
          <>
            <div className={home ? 'stay-intro' : checkingIn ? 'stay-checkin-intro' : undefined}>
              {home ? <span className="stay-phase">{text(phase)}</span> : (
                <Link to={href()} className="stay-back"><ArrowLeft aria-hidden="true" />{text('back')}</Link>
              )}
              {(!checkingIn || !stay.checkInAvailable) && <h1>{checkingIn ? text('checkInSection') : extras ? extraLabels[language][0] : text(services ? 'servicesAndExtras' : supplierOrders ? 'supplierOrders' : guide ? 'guide' : details ? 'booking' : chat ? 'chat' : documents ? 'documents' : payments ? 'payments' : review ? 'review' : cancellation ? 'cancellation' : privacy ? 'privacy' : 'title')}</h1>}
              {!checkingIn && <p className="stay-meta">{home ? <>{range} · {stay.guests} {guestLabel(language, stay.guests)}</> : stay.propertyName}</p>}
              {home && (
                <p className="stay-property"><MapPin aria-hidden="true" />{stay.propertyName}
                  <small className="stay-mobile-code">· {stay.bookingCode}</small>
                </p>
              )}
            </div>
            {checkingIn ? (
              stay.checkInAvailable ? <GuestCheckInFlow token={`stay_${token}`} embedded onCompleted={() => {
                void queryClient.invalidateQueries({ queryKey: ['guest-portal', token] });
                void queryClient.invalidateQueries({ queryKey });
              }} /> : <p className="stay-card">{text(overview?.checkInCompleted ? 'done' : 'checkInWait')}</p>
            ) : services ? (
              <>
                <GuestHostExtras path={path} language={language} />
                {overview?.features?.supplierServices && <GuestSupplierOrders path={path} language={language} />}
              </>
            ) : extras ? (
              <GuestHostExtras path={path} language={language} />
            ) : guide ? (
              <div className="stay-card stay-content">
                <h2>{text('address')}</h2>
                <p>{[stay.address, stay.city].filter(Boolean).join(', ')}</p>
                {!stay.address && phase !== 'after' && <p>{text('addressLocked')}</p>}
                <HouseGuideSections guide={stay.guide} />
                {stay.address && flags.checkInIdentityVerification && (
                  <>
                    <button type="button" disabled={accessCode.isPending} onClick={() => accessCode.mutate()}>{text('accessCode')}</button>
                    {accessCode.data?.code && <p role="status">{accessCode.data.code}</p>}
                    {accessCode.isError && <p role="alert">{text('error')}</p>}
                  </>
                )}
                {stay.houseRules && <><h2>{text('rules')}</h2><p className="stay-rules">{stay.houseRules}</p></>}
              </div>
            ) : chat ? (
              <GuestPortalChat path={path} language={language} labels={{
                message: text('message'), send: text('send'), loading: text('load'), failed: text('error'),
                empty: text('emptyChat'), closed: text('closedChat'),
              }} />
            ) : documents ? (
              <GuestPortalDocuments path={path} language={language} labels={{
                loading: text('load'), failed: text('error'), empty: text('emptyDocuments'), download: text('download'),
                correction: text('correction'), requested: text('requestReceived'),
              }} />
            ) : privacy ? (
              <GuestPortalPrivacy path={path} language={language} labels={{
                copy: text('dataCopy'), erasure: text('dataErasure'), confirm: text('requestConfirm'), back: text('back'),
                requested: text('requestReceived'), closed: text('requestClosed'), failed: text('error'), loading: text('load'),
              }} />
            ) : payments ? (
              <GuestPortalPayments path={path} language={language} direct={stay.isDirect && stay.status !== 'cancelled'}
                tax={taxAvailable ? tax.data : undefined} checkIn={checkIn}
                documents={href('documents')} services={overview?.features?.supplierServices ? href('supplier-orders') : undefined} labels={{
                  balance: text('balance'), total: text('paymentTotal'), paid: text('paymentPaid'), tax: text('touristTax'),
                  payNow: text('payNow'), loading: text('load'), failed: text('error'), settled: text('paymentSettled'),
                  deferred: text('paymentDeferred'), processing: text('paymentProcessing'), unavailable: text('paymentUnavailable'),
                  documents: text('documents'), payTax: text('payTax'), services: text('servicePayments'), refresh: text('refreshPayment'),
                }} />
            ) : review ? (
              <GuestPortalReview path={path} labels={{
                rating: text('rating'), comment: text('comment'), showName: text('showName'), send: text('send'),
                loading: text('load'), failed: text('error'), submitted: text('reviewSubmitted'), unavailable: text('reviewUnavailable'),
              }} />
            ) : cancellation ? (
              <GuestPortalCancellation path={path} language={language} onCancelled={() => { void query.refetch(); }} labels={{
                loading: text('load'), failed: text('error'), unavailable: text('cannotCancel'), cancelled: text('cancelled'),
                refund: text('refund'), changed: text('refundChanged'), confirm: text('confirmCancellation'),
              }} />
            ) : supplierOrders ? (
              <GuestSupplierOrders path={path} language={language} />
            ) : details ? (
              <>
              {stay.canEditArrival ? <ArrivalForm stay={stay} path={path} text={text} onSaved={(arrivalTime) => {
                queryClient.setQueryData<StayDetails>(queryKey, (current) => current && { ...current, arrivalTime });
              }} />
                : <div className="stay-card stay-content"><h2>{text('arrival')}</h2><p>{stay.arrivalTime === 'late' ? text('late') : stay.arrivalTime ?? '—'}</p></div>}
                {stay.isDirect && overview?.stay && <GuestPortalStayChange path={path} language={language}
                  arrival={overview.stay.checkIn} departure={overview.stay.checkOut}
                  paymentsHref={href('payments')} />}
                {stay.isDirect && phase === 'before' && <Link className="stay-card" to={href('cancellation')}>{text('cancellation')}</Link>}
                <Link className="stay-card" to={href('payments')}><CreditCard aria-hidden="true" />{text('payments')}<ChevronRight aria-hidden="true" /></Link>
                <Link className="stay-card" to={href('documents')}><FileText aria-hidden="true" />{text('documents')}<ChevronRight aria-hidden="true" /></Link>
                <Link className="stay-card" to={href('privacy')}>{text('privacy')}<ChevronRight aria-hidden="true" /></Link>
                <Link className="stay-card" to={guestAccountStaysPath}>{text('account')}<ChevronRight aria-hidden="true" /></Link>
                {stay.isOta && <p className="stay-card">{text('otaChanges')}</p>}
              </>
            ) : (
              <>
                {phase !== 'after' && (
                  <section className="stay-next">
                    <div className="stay-next-symbol"><ClipboardCheck aria-hidden="true" /></div>
                    <p>{text('next')}</p>
                    <h2>{text(nextStep)}</h2>
                    {!overview?.checkInCompleted && <p>{text(stay.checkInAvailable ? 'checkInHelp' : 'checkInWait')}</p>}
                    {nextStep === 'guide' && <Link to={href('guide')}>{text('guide')}</Link>}
                    {nextStep === 'payTax' && <Link to={checkIn}>{text('payTax')}</Link>}
                    {!overview?.checkInCompleted && stay.checkInAvailable && <Link to={checkIn}>{text('open')}</Link>}
                  </section>
                )}
                {phase === 'after' && stay.status !== 'cancelled' && (
                  <section className="stay-next">
                    <div className="stay-next-symbol"><ClipboardCheck aria-hidden="true" /></div>
                    <p>{text('next')}</p>
                    <h2>{text('reviewHeading')}</h2>
                    <p>{text('reviewUnavailable')}</p>
                    <Link to={href('review')}>{text('reviewAction')}</Link>
                  </section>
                )}
                {phase !== 'after' && <h2 className="stay-sections-title">{text('everything')}</h2>}
                <div className="stay-links">
                  {phase !== 'after' && <>
                    <StaySectionLink to={href('details')} icon={CalendarDays} label={text('details')} detail={stay.propertyName} />
                    <StaySectionLink to={href('guide')} icon={BookOpen} label={text('guide')} detail={text('guideNote')} />
                    {(hasExtras || overview?.features?.supplierServices) && <StaySectionLink to={href('services')} icon={ShoppingBag} label={text('servicesAndExtras')} detail={text('servicesNote')} />}
                  </>}
                  {stay.status !== 'cancelled' && <StaySectionLink to={href('chat')} icon={MessageCircle} label={text('chat')} detail={text('chatNote')} />}
                  <StaySectionLink to={href('documents')} icon={FileText} label={text('documents')} detail={text('documentsNote')} />
                  {phase === 'after' && <StaySectionLink to={href('privacy')} icon={ClipboardCheck} label={text('privacy')} />}
                  {(phase !== 'after' || stay.checkInAvailable || overview?.checkInCompleted) && (
                    <StaySectionLink to={checkIn} icon={ClipboardCheck} label={text(overview?.checkInCompleted ? 'done' : 'checkInSection')} />
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>
      {hasLayout && stay && (
        <>
          <aside className="stay-summary" aria-label={text('yourBooking')}>
            <div className="stay-card">
              <h2>{text('yourBooking')}</h2>
              <p className="stay-summary-property">{stay.propertyName}</p>
              <p><CalendarDays aria-hidden="true" />{range}</p>
              <p><UsersRound aria-hidden="true" />{stay.guests} {guestLabel(language, stay.guests)}</p>
              <p><FileText aria-hidden="true" />{stay.bookingCode}</p>
              <Link className="stay-summary-action" to={href('details')}>{text('viewBooking')}<ChevronRight aria-hidden="true" /></Link>
            </div>
          </aside>
          <nav className="stay-nav" aria-label={text('stay')}>
            <p>{text('stay')}</p>
            {nav.map(({ key, page, icon: Icon, current }) => key !== 'chat' || stay.status !== 'cancelled' ? (
              <Link key={key} to={href(page)} aria-current={current ? 'page' : undefined}>
                <Icon aria-hidden="true" />{text(key)}
              </Link>
            ) : null)}
          </nav>
        </>
      )}
      <footer>{poweredBy}</footer>
    </div>
  );
}

function StaySectionLink({ to, icon: Icon, label, detail }: {
  to: string;
  icon: typeof CalendarDays;
  label: string;
  detail?: string;
}) {
  return (
    <Link className="stay-card stay-section-link" to={to}>
      <Icon aria-hidden="true" />
      <span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}

function guestLabel(language: Language, count: number): string {
  const labels = count === 1 ? ['ospite', 'guest', 'Gast', 'voyageur', 'huésped'] : ['ospiti', 'guests', 'Gäste', 'voyageurs', 'huéspedes'];
  return labels[languages.indexOf(language)];
}

function ArrivalForm({ stay, path, text, onSaved }: {
  stay: StayDetails;
  path: string;
  text: (key: keyof typeof copy) => string;
  onSaved: (arrivalTime: string) => void;
}) {
  const [late, setLate] = useState(stay.arrivalTime === 'late');
  const initialTime = stay.arrivalTime ?? '';
  const [time, setTime] = useState(/^\d{2}:\d{2}$/.test(initialTime) ? initialTime : '');
  const save = useMutation({
    mutationFn: (value: string) => ApiClient.put<void>(`${path}/arrival`, { time: value }, { public: true }),
    onSuccess: (_, value) => onSaved(value),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate(late ? 'late' : time);
  }
  return (
    <form className="stay-card stay-content" onSubmit={submit}>
      <label htmlFor="arrival-time">{text('arrival')}</label>
      <input id="arrival-time" type="time" value={time} disabled={late} required={!late} onChange={(event) => {
        setTime(event.target.value);
        save.reset();
      }} />
      <label className="stay-checkbox">
        <input type="checkbox" checked={late} onChange={(event) => {
          setLate(event.target.checked);
          save.reset();
        }} /> {text('late')}
      </label>
      <button disabled={save.isPending}>{text('save')}</button>
      {save.isSuccess && <p role="status">{text('saved')}</p>}
      {save.isError && <p role="alert">{text('error')}</p>}
    </form>
  );
}
