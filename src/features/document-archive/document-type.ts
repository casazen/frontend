import { File, FileCheck, FileMinus, FileSignature, FileText, House, Landmark, Receipt, ShieldCheck, type LucideIcon } from 'lucide-react';
import { ARCHIVE_DOCUMENT_TYPES, type ArchiveDocumentType } from '@/types';

/** How a kind of document looks on the page: an icon (it only helps the eye, the word says it) and the key of its name. */
export interface ArchiveTypeMeta {
  icon: LucideIcon;
  /** `documentArchive.types.<Type>`, the type written as the enum of the backend is (`PropertyDocument`), not as the API sends it. */
  labelKey: string;
}

const TYPES: Record<ArchiveDocumentType, ArchiveTypeMeta> = {
  invoice: { icon: FileText, labelKey: 'documentArchive.types.Invoice' },
  receipt: { icon: Receipt, labelKey: 'documentArchive.types.Receipt' },
  creditNote: { icon: FileMinus, labelKey: 'documentArchive.types.CreditNote' },
  alloggiatiReceipt: { icon: ShieldCheck, labelKey: 'documentArchive.types.AlloggiatiReceipt' },
  istatProof: { icon: FileCheck, labelKey: 'documentArchive.types.IstatProof' },
  touristTax: { icon: Landmark, labelKey: 'documentArchive.types.TouristTax' },
  contract: { icon: FileSignature, labelKey: 'documentArchive.types.Contract' },
  propertyDocument: { icon: House, labelKey: 'documentArchive.types.PropertyDocument' },
};

/** A kind the page does not know (the server may learn one before the page does): it is shown, with a plain name, never hidden. */
const UNKNOWN: ArchiveTypeMeta = { icon: File, labelKey: 'documentArchive.types.Other' };

export function isArchiveDocumentType(type: string): type is ArchiveDocumentType {
  return (ARCHIVE_DOCUMENT_TYPES as readonly string[]).includes(type);
}

/** The icon and the name of a kind of document, by the key the API sends it under. */
export function archiveTypeMeta(type: string): ArchiveTypeMeta {
  return isArchiveDocumentType(type) ? TYPES[type] : UNKNOWN;
}
