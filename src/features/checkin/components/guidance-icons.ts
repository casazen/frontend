import { Copy, FileX, FlipHorizontal2, Focus, LayoutTemplate, Maximize, RotateCw, ScanLine, ScanText, Sun, UserRound, type LucideIcon } from 'lucide-react';

/**
 * A picture for each of the targeted codes of the document step: what the code is about, in one drawing, next to the words (decorative: the words say it all). A code with no drawing (the older
 * ones) has none, and its line is the one it always was. The refusal of a photo (`IdentityDocumentCapture`) and the screen of a document that goes to a person (`IdentityResult`, for
 * `document_format_unsupported` and `document_unreadable`) draw from this one list, so that all eleven codes have their picture wherever their words are shown (E71/F02/US01/T02).
 */
export const GUIDANCE_ICONS: Readonly<Record<string, LucideIcon>> = {
  document_not_found: ScanLine,
  document_edges_not_visible: Maximize,
  document_layout_mismatch: LayoutTemplate,
  document_orientation: RotateCw,
  document_portrait_missing: UserRound,
  document_side_duplicate: Copy,
  document_wrong_side: FlipHorizontal2,
  document_format_unsupported: FileX,
  document_glare: Sun,
  document_blur: Focus,
  document_unreadable: ScanText,
};
