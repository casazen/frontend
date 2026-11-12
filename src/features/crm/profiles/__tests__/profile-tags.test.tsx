import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { CrmApi } from '@/api/crm.api';
import { ProfileTags } from '../profile-tags';

vi.mock('@/api/crm.api', () => ({
  CrmApi: { setTags: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const PROFILE = '0b8f5d6e-1111-4a22-8333-aaaaaaaaaaa1';

function renderTags(tags: string[], canWrite = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ProfileTags profileId={PROFILE} tags={tags} canWrite={canWrite} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const addBox = () => screen.getByLabelText(i18n.t('crm.tags.addLabel'));
const addButton = () => screen.getByRole('button', { name: i18n.t('crm.tags.add') });

describe('ProfileTags: the tags of a profile (E07/F01/US04/T02)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(CrmApi.setTags).mockResolvedValue(undefined);
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('ProfileTags_AddATag_SavesTheWholeListAtOnce', async () => {
    renderTags(['vip']);

    fireEvent.change(addBox(), { target: { value: '  famiglia ' } });
    fireEvent.click(addButton());

    await waitFor(() => expect(CrmApi.setTags).toHaveBeenCalledWith(PROFILE, ['vip', 'famiglia']));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('crm.tags.success')));
    // What was typed is cleared once the server has it.
    await waitFor(() => expect(addBox()).toHaveValue(''));
  });

  it('ProfileTags_RemoveATag_SavesTheListWithoutIt', async () => {
    renderTags(['vip', 'famiglia']);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('crm.tags.remove', { tag: 'vip' }) }));

    await waitFor(() => expect(CrmApi.setTags).toHaveBeenCalledWith(PROFILE, ['famiglia']));
  });

  it('ProfileTags_RemoveTheLastTag_SavesAnEmptyListWhichClearsThem', async () => {
    renderTags(['vip']);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('crm.tags.remove', { tag: 'vip' }) }));

    await waitFor(() => expect(CrmApi.setTags).toHaveBeenCalledWith(PROFILE, []));
  });

  it('ProfileTags_ATagThatIsAlreadyThere_IsRefusedWhateverTheCaseAndNothingIsSent', () => {
    renderTags(['VIP']);

    fireEvent.change(addBox(), { target: { value: 'vip' } });
    fireEvent.click(addButton());

    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('crm.tags.duplicate'));
    expect(CrmApi.setTags).not.toHaveBeenCalled();
  });

  it('ProfileTags_ATagIsAtMostFortyCharacters', () => {
    renderTags([]);

    expect(addBox()).toHaveAttribute('maxlength', '40');
  });

  it('ProfileTags_FiftyTags_ThereIsNoRoomForAnotherAndItSaysSo', () => {
    renderTags(Array.from({ length: 50 }, (_, index) => `tag-${index}`));

    expect(screen.getByTestId('crm-tags-full')).toHaveTextContent('50');
    expect(screen.queryByTestId('crm-tags-form')).not.toBeInTheDocument();
    expect(CrmApi.setTags).not.toHaveBeenCalled();
  });

  it('ProfileTags_TheServerRefuses_ItIsToldAndNothingIsClaimedSaved', async () => {
    vi.mocked(CrmApi.setTags).mockRejectedValue(new Error('boom'));
    renderTags([]);

    fireEvent.change(addBox(), { target: { value: 'nuovo' } });
    fireEvent.click(addButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('crm.tags.error')));
    expect(toast.success).not.toHaveBeenCalled();
    // What was typed stays, so nothing is lost.
    expect(addBox()).toHaveValue('nuovo');
  });

  it('ProfileTags_ACallerWhoCannotWrite_SeesTheTagsAndCannotChangeThem', () => {
    renderTags(['vip'], false);

    expect(screen.getByText('vip')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('crm.tags.addLabel'))).not.toBeInTheDocument();
  });

  it('ProfileTags_NoTags_SaysSo', () => {
    renderTags([]);

    expect(screen.getByTestId('crm-tags-empty')).toHaveTextContent(i18n.t('crm.tags.empty'));
  });
});
