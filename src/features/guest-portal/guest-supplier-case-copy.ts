const labels = {
  open: ['Foto e riesame', 'Photos and review', 'Fotos und Prüfung', 'Photos et réexamen', 'Fotos y revisión'],
  loading: ['Caricamento…', 'Loading…', 'Wird geladen…', 'Chargement…', 'Cargando…'],
  error: ['Operazione non riuscita. Riprova.', 'Something went wrong. Try again.', 'Vorgang fehlgeschlagen. Erneut versuchen.', 'Échec de l’opération. Réessayez.', 'La operación ha fallado. Inténtalo de nuevo.'],
  staff: ['Il caso è nella coda dello staff CasaZen.', 'The case is with the CasaZen team.', 'Der Fall liegt dem CasaZen-Team vor.', 'Le dossier est transmis à l’équipe CasaZen.', 'El caso está en manos del equipo CasaZen.'],
  claimed: ['Caso preso in carico dallo staff.', 'A staff member is handling this case.', 'Der Fall wird vom Team bearbeitet.', 'Un membre de l’équipe traite ce dossier.', 'El equipo está tramitando el caso.'],
  claim: ['Prendi in carico', 'Take ownership', 'Fall übernehmen', 'Prendre en charge', 'Asumir el caso'],
  photo: ['Foto', 'Photo', 'Foto', 'Photo', 'Foto'],
  guest: ['Ospite', 'Guest', 'Gast', 'Voyageur', 'Huésped'],
  supplier: ['Fornitore', 'Supplier', 'Anbieter', 'Prestataire', 'Proveedor'],
  add: ['Allega foto', 'Attach photo', 'Foto anhängen', 'Joindre une photo', 'Adjuntar foto'],
  help: ['Fino a 3 foto per parte, 4 MB ciascuna. JPEG, PNG o WebP.', 'Up to 3 photos per party, 4 MB each. JPEG, PNG or WebP.', 'Bis zu drei Fotos pro Partei, je 4 MB. JPEG, PNG oder WebP.', 'Jusqu’à 3 photos par partie, 4 Mo chacune. JPEG, PNG ou WebP.', 'Hasta 3 fotos por parte, 4 MB cada una. JPEG, PNG o WebP.'],
  tooLarge: ['La foto supera 4 MB.', 'The photo exceeds 4 MB.', 'Das Foto ist größer als 4 MB.', 'La photo dépasse 4 Mo.', 'La foto supera los 4 MB.'],
  upload: ['Invia foto', 'Upload photo', 'Foto hochladen', 'Envoyer la photo', 'Enviar foto'],
  review: ['Richiedi un riesame umano', 'Request human review', 'Prüfung durch das Team anfordern', 'Demander un réexamen humain', 'Solicitar revisión humana'],
  why: ['Perché chiedi il riesame?', 'Why are you requesting a review?', 'Warum beantragst du eine Prüfung?', 'Pourquoi demandez-vous un réexamen ?', '¿Por qué solicitas una revisión?'],
  pending: ['Riesame in attesa dello staff', 'Awaiting staff review', 'Prüfung durch das Team ausstehend', 'En attente de réexamen', 'Pendiente de revisión por el equipo'],
  finding: ['Esito del riesame', 'Review decision', 'Ergebnis der Prüfung', 'Décision du réexamen', 'Resultado de la revisión'],
  close: ['Comunica esito', 'Send decision', 'Ergebnis mitteilen', 'Communiquer la décision', 'Comunicar la decisión'],
} as const;

export function caseText(language: string) {
  const i = Math.max(0, ['it', 'en', 'de', 'fr', 'es'].indexOf(language.split('-')[0]));
  return (key: keyof typeof labels) => labels[key][i];
}
