import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertyImagesApi } from '@/api/property-images.api';
import type { PropertyPhotosDto } from '@/types';
import { PropertyPhotoManager } from '../property-photo-manager';
import { validatePhotoSelection } from '../../photo-selection';

vi.mock('@/api/property-images.api');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PROPERTY_ID = 'prop-1';
const STORAGE = 'https://ref.supabase.co/storage/v1/object/public/casazen-prod-public/properties/prop-1/photos';
const A = `${STORAGE}/a.jpg`;
const B = `${STORAGE}/b.png`;
const C = `${STORAGE}/c.webp`;
const LEGACY = '/uploads/properties/prop-1/old.jpg';

const rules = {
  maxPhotos: 20,
  maxFilesPerRequest: 10,
  maxFileSizeBytes: 10 * 1024 * 1024,
  allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
};

const gallery = (...photoUrls: string[]): PropertyPhotosDto => ({ photoUrls, ...rules });

/** Failed API call as the axios client rejects it: ProblemDetails body with the stable `code` (FD-05). */
function problem(status: number, code?: string): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: code ? { status, title: 'Error', code } : {},
  } as AxiosResponse);
}

let queryClient: QueryClient;

function renderManager(canEdit = true) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PropertyPhotoManager propertyId={PROPERTY_ID} propertyName="Villa Mare" canEdit={canEdit} />
    </QueryClientProvider>,
  );
}

const tiles = () => screen.findAllByTestId('property-photo');

function chooseFiles(files: File[]) {
  fireEvent.change(screen.getByTestId('property-photo-input'), { target: { files } });
}

const png = (name = 'foto.png', size = 1024) => new File([new Uint8Array(size)], name, { type: 'image/png' });

describe('PropertyPhotoManager (PC-04, A2-26)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(propertyImagesApi.getAll).mockResolvedValue(gallery(A, B, C));
  });

  afterEach(() => {
    queryClient?.clear();
  });

  describe('states', () => {
    it('loading_ShowsAPlaceholderGridNotAnEmptyState', async () => {
      vi.mocked(propertyImagesApi.getAll).mockReturnValue(new Promise(() => undefined));

      renderManager();

      expect(await screen.findByTestId('property-photos-loading')).toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByTestId('property-photos-empty')).not.toBeInTheDocument();
    });

    it('loadError_ShowsTheErrorWithRetryAndNeverAnEmptyGallery', async () => {
      vi.mocked(propertyImagesApi.getAll).mockRejectedValueOnce(problem(500));

      renderManager();

      const alert = await screen.findByTestId('property-photos-error');
      expect(alert).toHaveTextContent('Non è stato possibile caricare le foto.');
      expect(screen.queryByTestId('property-photos-empty')).not.toBeInTheDocument();

      vi.mocked(propertyImagesApi.getAll).mockResolvedValueOnce(gallery(A));
      fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));
      expect(await tiles()).toHaveLength(1);
    });

    it('emptyGallery_ShowsTheEmptyStateWithTheFirstUploadAction', async () => {
      vi.mocked(propertyImagesApi.getAll).mockResolvedValue(gallery());

      renderManager();

      const empty = await screen.findByTestId('property-photos-empty');
      expect(within(empty).getByText('Nessuna foto')).toBeInTheDocument();
      expect(within(empty).getByRole('button', { name: 'Carica la prima foto' })).toBeInTheDocument();
    });

    it('emptyGalleryWithoutEditPermission_ShowsNoUploadAction', async () => {
      vi.mocked(propertyImagesApi.getAll).mockResolvedValue(gallery());

      renderManager(false);

      const empty = await screen.findByTestId('property-photos-empty');
      expect(within(empty).getByText('Per questa proprietà non sono state caricate foto.')).toBeInTheDocument();
      expect(within(empty).queryByRole('button')).not.toBeInTheDocument();
    });

    it('photos_ShowsTheGalleryInOrderWithTheCoverBadgeOnTheFirstAndTheLimits', async () => {
      renderManager();

      const items = await tiles();
      expect(items).toHaveLength(3);
      expect(within(items[0]).getByRole('img', { name: 'Villa Mare - foto 1' })).toHaveAttribute('src', A);
      expect(within(items[1]).getByRole('img', { name: 'Villa Mare - foto 2' })).toHaveAttribute('src', B);
      expect(within(items[0]).getByTestId('property-photo-cover-badge')).toHaveTextContent('Copertina');
      expect(screen.getAllByTestId('property-photo-cover-badge')).toHaveLength(1);
      expect(screen.getByTestId('property-photo-counter')).toHaveTextContent('3 di 20 foto');
      expect(screen.getByText('Fino a 20 foto in formato JPEG, PNG o WebP, massimo 10 MB ciascuna.')).toBeInTheDocument();
    });

    it('readOnly_ShowsThePhotosWithoutAnyAction', async () => {
      renderManager(false);

      await tiles();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('legacyRelativeUrl_IsAPlaceholderThatCanBeDeletedAndNeverTheCover', async () => {
      vi.mocked(propertyImagesApi.getAll).mockResolvedValue(gallery(LEGACY, A));

      renderManager();

      const [legacy, current] = await tiles();
      expect(within(legacy).queryByRole('img')).not.toBeInTheDocument();
      expect(within(legacy).getByText('Foto non più disponibile: eliminala e caricala di nuovo.')).toBeInTheDocument();
      expect(within(legacy).queryByTestId('property-photo-cover-badge')).not.toBeInTheDocument();
      expect(within(legacy).queryByRole('button', { name: 'Imposta come copertina' })).not.toBeInTheDocument();
      expect(within(legacy).getByRole('button', { name: 'Elimina la foto 1' })).toBeEnabled();
      // What the public pages show first: the first photo that can be displayed.
      expect(within(current).getByTestId('property-photo-cover-badge')).toBeInTheDocument();
    });

    it('imageThatFailsToLoad_ShowsTheUnavailablePlaceholderButStaysDeletable', async () => {
      renderManager();

      const [first] = await tiles();
      fireEvent.error(within(first).getByRole('img'));

      expect(within(first).getByText('Foto non disponibile')).toBeInTheDocument();
      expect(within(first).getByRole('button', { name: 'Elimina la foto 1' })).toBeEnabled();
    });
  });

  describe('upload', () => {
    it('chosenFiles_AreUploadedTogetherAndTheGalleryIsRefreshed', async () => {
      vi.mocked(propertyImagesApi.getAll).mockResolvedValue(gallery(A));
      vi.mocked(propertyImagesApi.upload).mockResolvedValue(gallery(A, B, C));
      renderManager();
      await tiles();
      const files = [png('uno.png'), png('due.png')];

      chooseFiles(files);

      await waitFor(() => expect(propertyImagesApi.upload).toHaveBeenCalledWith(PROPERTY_ID, files));
      expect(await screen.findByTestId('property-photo-counter')).toHaveTextContent('3 di 20 foto');
      expect(toast.success).toHaveBeenCalledWith('2 foto caricate.');
    });

    it('uploadInProgress_DisablesTheActionsAndSaysSo', async () => {
      let finish: (value: PropertyPhotosDto) => void = () => undefined;
      vi.mocked(propertyImagesApi.upload).mockReturnValue(new Promise((resolve) => (finish = resolve)));
      renderManager();
      await tiles();

      chooseFiles([png()]);

      const button = await screen.findByRole('button', { name: 'Caricamento in corso…' });
      expect(button).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Elimina la foto 1' })).toBeDisabled();
      finish(gallery(A, B, C, `${STORAGE}/d.png`));
      expect(await screen.findByRole('button', { name: 'Carica foto' })).toBeEnabled();
    });

    it('wrongType_IsRefusedBeforeAnyRequestNamingTheFile', async () => {
      renderManager();
      await tiles();

      chooseFiles([new File(['x'], 'scheda.pdf', { type: 'application/pdf' })]);

      expect(await screen.findByTestId('property-photo-selection-error')).toHaveTextContent(
        '«scheda.pdf» non è un\'immagine JPEG, PNG o WebP.',
      );
      expect(propertyImagesApi.upload).not.toHaveBeenCalled();
    });

    it('tooLargeFile_IsRefusedBeforeAnyRequest', async () => {
      renderManager();
      await tiles();

      chooseFiles([png('enorme.png', 10 * 1024 * 1024 + 1)]);

      expect(await screen.findByTestId('property-photo-selection-error')).toHaveTextContent(
        '«enorme.png» è vuota o supera il limite di 10 MB.',
      );
      expect(propertyImagesApi.upload).not.toHaveBeenCalled();
    });

    it('moreFilesThanTheGalleryCanHold_AreRefusedWithTheRemainingRoom', async () => {
      const nineteen = Array.from({ length: 19 }, (_, i) => `${STORAGE}/${i}.jpg`);
      vi.mocked(propertyImagesApi.getAll).mockResolvedValue(gallery(...nineteen));
      renderManager();
      await tiles();

      chooseFiles([png('a.png'), png('b.png')]);

      expect(await screen.findByTestId('property-photo-selection-error')).toHaveTextContent(
        'Puoi aggiungere ancora 1 foto (massimo 20 per proprietà).',
      );
      expect(propertyImagesApi.upload).not.toHaveBeenCalled();
    });

    it('fullGallery_DisablesTheUploadButtonAndExplainsWhy', async () => {
      const twenty = Array.from({ length: 20 }, (_, i) => `${STORAGE}/${i}.jpg`);
      vi.mocked(propertyImagesApi.getAll).mockResolvedValue(gallery(...twenty));

      renderManager();

      expect(await screen.findByRole('button', { name: 'Carica foto' })).toBeDisabled();
      expect(screen.getByTestId('property-photo-counter')).toHaveTextContent(
        'Hai raggiunto il massimo di 20 foto: elimina una foto per caricarne altre.',
      );
    });

    it('serverRefusal_ShowsTheTranslatedMessageInlineAndInAToast', async () => {
      vi.mocked(propertyImagesApi.upload).mockRejectedValue(problem(422, 'property_photo_invalid_type'));
      renderManager();
      await tiles();

      chooseFiles([png()]);

      const message = 'Uno dei file non è una foto valida: sono ammesse solo immagini JPEG, PNG o WebP.';
      expect(await screen.findByTestId('property-photo-action-error')).toHaveTextContent(message);
      expect(toast.error).toHaveBeenCalledWith(message);
      // The gallery stays on screen: an error never turns it into an empty list.
      expect(screen.getAllByTestId('property-photo')).toHaveLength(3);
    });
  });

  describe('order and cover', () => {
    it('moveLater_SendsTheWholeGalleryWithTheTwoPhotosSwapped', async () => {
      vi.mocked(propertyImagesApi.reorder).mockResolvedValue(gallery(B, A, C));
      renderManager();
      await tiles();

      fireEvent.click(screen.getByRole('button', { name: 'Sposta la foto 1 dopo' }));

      await waitFor(() => expect(propertyImagesApi.reorder).toHaveBeenCalledWith(PROPERTY_ID, [B, A, C]));
      await waitFor(async () => {
        const [first] = await tiles();
        expect(within(first).getByRole('img')).toHaveAttribute('src', B);
        expect(within(first).getByTestId('property-photo-cover-badge')).toBeInTheDocument();
      });
    });

    it('firstPhotoCannotMoveEarlierAndTheLastCannotMoveLater', async () => {
      renderManager();
      await tiles();

      expect(screen.getByRole('button', { name: 'Sposta la foto 1 prima' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Sposta la foto 3 dopo' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Sposta la foto 2 prima' })).toBeEnabled();
    });

    it('setCover_SendsThePhotoUrlAndShowsItFirstWithTheBadge', async () => {
      vi.mocked(propertyImagesApi.setCover).mockResolvedValue(gallery(C, A, B));
      renderManager();
      const items = await tiles();

      fireEvent.click(within(items[2]).getByRole('button', { name: 'Imposta come copertina' }));

      await waitFor(() => expect(propertyImagesApi.setCover).toHaveBeenCalledWith(PROPERTY_ID, C));
      await waitFor(async () => {
        const [first] = await tiles();
        expect(within(first).getByRole('img')).toHaveAttribute('src', C);
      });
      expect(toast.success).toHaveBeenCalledWith('Foto di copertina aggiornata.');
    });

    it('theCoverHasNoSetCoverButton', async () => {
      renderManager();
      const [first] = await tiles();

      expect(within(first).queryByRole('button', { name: 'Imposta come copertina' })).not.toBeInTheDocument();
    });

    it('staleOrderRefusedWithConflict_ReloadsTheGalleryAndExplainsIt', async () => {
      vi.mocked(propertyImagesApi.reorder).mockRejectedValue(problem(409, 'property_photos_changed'));
      renderManager();
      await tiles();
      vi.mocked(propertyImagesApi.getAll).mockClear();

      fireEvent.click(screen.getByRole('button', { name: 'Sposta la foto 2 prima' }));

      expect(await screen.findByTestId('property-photo-action-error')).toHaveTextContent(
        'La galleria è stata modificata da un altro utente o da un\'altra scheda',
      );
      await waitFor(() => expect(propertyImagesApi.getAll).toHaveBeenCalledTimes(1));
    });
  });

  describe('deletion', () => {
    it('confirmedDeletion_RemovesThePhotoByUrlAndUpdatesTheGallery', async () => {
      vi.mocked(propertyImagesApi.remove).mockResolvedValue(gallery(A, C));
      renderManager();
      const items = await tiles();

      fireEvent.click(within(items[1]).getByRole('button', { name: 'Elimina la foto 2' }));
      expect(propertyImagesApi.remove).not.toHaveBeenCalled();
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Eliminare questa foto?')).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina foto' }));

      await waitFor(() => expect(propertyImagesApi.remove).toHaveBeenCalledWith(PROPERTY_ID, B));
      await waitFor(() => expect(screen.getAllByTestId('property-photo')).toHaveLength(2));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith('Foto eliminata.');
    });

    it('cancelledDeletion_DeletesNothing', async () => {
      renderManager();
      const items = await tiles();

      fireEvent.click(within(items[0]).getByRole('button', { name: 'Elimina la foto 1' }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annulla' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(propertyImagesApi.remove).not.toHaveBeenCalled();
    });

    it('failedDeletion_KeepsTheDialogOpenWithTheReasonAndThePhotoListed', async () => {
      vi.mocked(propertyImagesApi.remove).mockRejectedValue(problem(500));
      renderManager();
      const items = await tiles();

      fireEvent.click(within(items[0]).getByRole('button', { name: 'Elimina la foto 1' }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Elimina foto' }));

      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Non è stato possibile eliminare la foto. Riprova.');
      expect(screen.getAllByTestId('property-photo')).toHaveLength(3);
    });
  });
});

describe('validatePhotoSelection', () => {
  const t = (key: string, options?: Record<string, unknown>) => `${key}:${JSON.stringify(options ?? {})}`;

  it('acceptedFiles_ReturnsNull', () => {
    expect(
      validatePhotoSelection(
        [png('a.png'), new File(['x'], 'b.JPG', { type: 'image/jpeg' }), new File(['x'], 'c.webp', { type: 'image/webp' })],
        0,
        rules,
        t,
      ),
    ).toBeNull();
  });

  it('extensionThatDoesNotMatchTheType_IsRefused', () => {
    expect(validatePhotoSelection([new File(['x'], 'a.png', { type: 'image/jpeg' })], 0, rules, t)).toContain(
      'selectionInvalidType',
    );
  });

  it('emptyFile_IsRefused', () => {
    expect(validatePhotoSelection([png('a.png', 0)], 0, rules, t)).toContain('selectionTooLarge');
  });

  it('moreFilesThanOneRequestAccepts_IsRefused', () => {
    const files = Array.from({ length: 11 }, (_, i) => png(`${i}.png`));

    expect(validatePhotoSelection(files, 0, rules, t)).toContain('selectionTooMany');
  });
});
