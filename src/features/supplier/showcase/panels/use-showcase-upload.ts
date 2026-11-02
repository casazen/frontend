import { useCallback, useEffect, useRef, useState } from 'react';
import { isCancel } from 'axios';
import { useTranslation } from 'react-i18next';
import { supplierShowcaseApi } from '@/api/supplier-showcase.api';
import { getHttpStatus, isTransientRequestError } from '@/lib/api-errors';
import type { ShowcaseMedia, ShowcaseMediaKind } from '@/types/supplier-showcase';
import { checkShowcaseFileKind, fileProblemMessage, prepareShowcaseImage, uploadErrorMessage, validateShowcaseFile } from '../showcase-media';

/**
 * Where an upload stands: nothing (`idle`), the editor making the photo smaller (`preparing`), the file on its way (`uploading`, with how much
 * has gone) or stopped with the reason in the person's words (`failed`, `retryable` when sending the same file again can work: the network, a
 * server that failed, too many in a short time). The name of the file is the person's own text: shown back, never logged.
 */
export type ShowcaseUploadState =
  | { phase: 'idle' }
  | { phase: 'preparing'; fileName: string }
  | { phase: 'uploading'; fileName: string; percent: number }
  | { phase: 'failed'; fileName: string; message: string; retryable: boolean };

/**
 * One upload at a time for one kind of image (SP-13b): the file is checked (empty, type), made smaller when it is a heavy photo, checked
 * again for its weight, sent with its progress, and the server's answer (the stored image, with the address for the content) goes to `onStored`.
 * A failure keeps the file, so "Riprova" sends the same one again; "Annulla" stops the request; leaving the screen stops it too.
 */
export function useShowcaseUpload(kind: ShowcaseMediaKind, onStored: (media: ShowcaseMedia) => void) {
  const { t } = useTranslation();
  const [state, setState] = useState<ShowcaseUploadState>({ phase: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const last = useRef<File | null>(null);
  const mounted = useRef(true);
  // The latest `onStored`, so a long upload does not call the one of the render it started in.
  const stored = useRef(onStored);

  useEffect(() => {
    stored.current = onStored;
  }, [onStored]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  const show = useCallback((next: ShowcaseUploadState) => {
    if (mounted.current) setState(next);
  }, []);

  const start = useCallback(
    async (file: File) => {
      last.current = file;
      const fileName = file.name;

      const early = checkShowcaseFileKind(file);
      if (early) {
        show({ phase: 'failed', fileName, message: fileProblemMessage(early, kind, t), retryable: false });
        return;
      }

      const abort = new AbortController();
      controller.current = abort;
      try {
        show({ phase: 'preparing', fileName });
        const prepared = await prepareShowcaseImage(file, kind);
        if (abort.signal.aborted) return;

        // The weight that counts is the one of the file that goes.
        const heavy = validateShowcaseFile(prepared, kind);
        if (heavy) {
          show({ phase: 'failed', fileName, message: fileProblemMessage(heavy, kind, t), retryable: false });
          return;
        }

        show({ phase: 'uploading', fileName, percent: 0 });
        const media = await supplierShowcaseApi.uploadMedia(kind, prepared, {
          signal: abort.signal,
          onProgress: (percent) => show({ phase: 'uploading', fileName, percent }),
        });
        if (abort.signal.aborted) return;
        last.current = null;
        show({ phase: 'idle' });
        stored.current(media);
      } catch (error) {
        if (isCancel(error) || abort.signal.aborted) {
          show({ phase: 'idle' });
          return;
        }
        show({
          phase: 'failed',
          fileName,
          message: uploadErrorMessage(error, kind, t),
          retryable: isTransientRequestError(error) || getHttpStatus(error) === 429,
        });
      } finally {
        if (controller.current === abort) controller.current = null;
      }
    },
    [kind, show, t],
  );

  /** Stops what is on its way. */
  const cancel = useCallback(() => {
    controller.current?.abort();
    show({ phase: 'idle' });
  }, [show]);

  /** Sends the file that failed again. */
  const retry = useCallback(() => {
    if (last.current) void start(last.current);
  }, [start]);

  /** Forgets the failure. */
  const dismiss = useCallback(() => {
    last.current = null;
    show({ phase: 'idle' });
  }, [show]);

  return { state, start, cancel, retry, dismiss, busy: state.phase === 'preparing' || state.phase === 'uploading' };
}
