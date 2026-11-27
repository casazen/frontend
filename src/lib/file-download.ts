import { isAxiosError } from 'axios';

export function saveBlobAs(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function withJsonErrorBody(error: unknown): Promise<unknown> {
  if (!isAxiosError(error) || !(error.response?.data instanceof Blob)) return error;
  try {
    error.response.data = JSON.parse(await error.response.data.text()) as unknown;
  } catch {
    // Not JSON: keep the original body.
  }
  return error;
}
