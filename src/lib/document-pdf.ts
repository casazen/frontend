export interface DocumentPage { id: string; file: File; rotation: number }
export interface DocumentSelection { pages: DocumentPage[]; confirmed: boolean }
export const EMPTY_DOCUMENT: DocumentSelection = { pages: [], confirmed: false };
export const isDocumentPhoto = (file: File) => /\.(jpe?g|png)$/i.test(file.name);
export const documentReady = (selection: DocumentSelection) => selection.pages.length > 0 && (!selection.pages.some(page => isDocumentPhoto(page.file)) || selection.confirmed);

export async function prepareDocument(selection: DocumentSelection, maxBytes: number): Promise<File> {
  try { return await buildDocument(selection, maxBytes); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith('documentPages.')) throw error;
    throw new Error('documentPages.conversionFailed');
  }
}

async function buildDocument(selection: DocumentSelection, maxBytes: number): Promise<File> {
  if (!documentReady(selection)) throw new Error('documentPages.incomplete');
  if (!isDocumentPhoto(selection.pages[0].file)) {
    if (selection.pages[0].file.size > maxBytes) throw new Error('documentPages.tooLarge');
    return selection.pages[0].file;
  }
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const page of selection.pages) {
    const bitmap = await createImageBitmap(page.file, { imageOrientation: 'from-image' });
    try {
      const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      const sideways = page.rotation % 180 !== 0;
      canvas.width = sideways ? height : width; canvas.height = sideways ? width : height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('documentPages.conversionFailed');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.translate(canvas.width / 2, canvas.height / 2); context.rotate(page.rotation * Math.PI / 180);
      context.drawImage(bitmap, -width / 2, -height / 2, width, height);
      const jpeg = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('documentPages.conversionFailed')), 'image/jpeg', 0.9));
      const embedded = await pdf.embedJpg(await jpeg.arrayBuffer());
      const pdfPage = pdf.addPage([canvas.width * 0.3, canvas.height * 0.3]);
      pdfPage.drawImage(embedded, { x: 0, y: 0, width: pdfPage.getWidth(), height: pdfPage.getHeight() });
      canvas.width = 0; canvas.height = 0;
    } finally { bitmap.close(); }
  }
  const bytes = await pdf.save();
  if (bytes.byteLength > maxBytes) throw new Error('documentPages.tooLarge');
  const name = selection.pages[0].file.name.replace(/\.[^.]+$/, '') + '.pdf';
  return new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });
}
