import { File, FileCheck, FileMinus, FileSignature, FileText, House, Landmark, Receipt, ShieldCheck, type LucideIcon } from 'lucide-react';
import { ARCHIVE_DOCUMENT_TYPES, type ArchiveDocumentType } from '@/types';

export interface ArchiveTypeMeta {
  icon: LucideIcon;
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

const UNKNOWN: ArchiveTypeMeta = { icon: File, labelKey: 'documentArchive.types.Other' };

export function isArchiveDocumentType(type: string): type is ArchiveDocumentType {
  return (ARCHIVE_DOCUMENT_TYPES as readonly string[]).includes(type);
}

export function archiveTypeMeta(type: string): ArchiveTypeMeta {
  return isArchiveDocumentType(type) ? TYPES[type] : UNKNOWN;
}
