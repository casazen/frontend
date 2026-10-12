import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAiSettings, useUpdateAiSettings } from '@/queries/use-admin-seo';
import type { AiProviderName } from '@/types/seo.types';

const PROVIDERS: AiProviderName[] = ['Stub', 'DeepSeek', 'OpenAI', 'Anthropic', 'OpenAiCompatible'];

const PRESETS: Record<AiProviderName, { model: string; baseUrl: string }> = {
  Stub: { model: '', baseUrl: '' },
  DeepSeek: { model: 'deepseek-v4-flash', baseUrl: 'https://api.deepseek.com' },
  OpenAI: { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
  Anthropic: { model: 'claude-3-5-haiku-latest', baseUrl: 'https://api.anthropic.com' },
  OpenAiCompatible: { model: '', baseUrl: '' },
};

/**
 * Platform AI provider. The key is write-only. Stub calls nobody; the others write drafts (SEO and the other AI
 * callers) and are listed among the subprocessors once a key is saved.
 */
export function AdminAiPage() {
  const { t } = useTranslation();
  const settings = useAiSettings();
  const update = useUpdateAiSettings();
  const [provider, setProvider] = useState<AiProviderName>('Stub');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    const next = PROVIDERS.includes(settings.data.provider) ? settings.data.provider : 'Stub';
    setProvider(next);
    setModel(settings.data.model ?? '');
    setBaseUrl(settings.data.baseUrl ?? '');
    setApiKey('');
    setClearApiKey(false);
  }, [settings.data]);

  function handleProvider(next: AiProviderName) {
    setProvider(next);
    const preset = PRESETS[next];
    setModel(preset.model);
    setBaseUrl(preset.baseUrl);
  }

  function handleSave() {
    const trimmedKey = apiKey.trim();
    update.mutate(
      {
        provider,
        model: model.trim(),
        baseUrl: baseUrl.trim(),
        clearApiKey,
        ...(trimmedKey ? { apiKey: trimmedKey } : {}),
      },
      { onSuccess: () => setApiKey('') },
    );
  }

  const external = provider !== 'Stub';

  return (
    <div className="space-y-6" data-testid="admin-ai-page">
      <PageHeader title={t('admin.ai.title')} description={t('admin.ai.description')} />
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.ai.formTitle')}</CardTitle>
          <CardDescription>{t('admin.ai.formDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('admin.ai.loading')}</p>
          ) : settings.isError || !settings.data ? (
            <p className="text-sm text-destructive" data-testid="admin-ai-error">
              {t('admin.ai.loadError')}
            </p>
          ) : (
            <>
              <p className="text-sm" data-testid="admin-ai-status">
                {settings.data.externalActive
                  ? t('admin.ai.statusActive', { provider: settings.data.provider })
                  : t('admin.ai.statusInactive')}
                {settings.data.apiKeyHint ? ` · ${t('admin.ai.keyHint', { hint: settings.data.apiKeyHint })}` : ''}
                {` · ${t(settings.data.source === 'admin' ? 'admin.ai.sourceAdmin' : 'admin.ai.sourceEnvironment')}`}
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="admin-ai-provider">{t('admin.ai.providerLabel')}</Label>
                  <select
                    id="admin-ai-provider"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={provider}
                    onChange={(event) => handleProvider(event.target.value as AiProviderName)}
                    data-testid="admin-ai-provider"
                  >
                    {PROVIDERS.map((item) => (
                      <option key={item} value={item}>
                        {t(`admin.ai.providers.${item}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="admin-ai-model">{t('admin.ai.modelLabel')}</Label>
                  <Input
                    id="admin-ai-model"
                    value={model}
                    maxLength={100}
                    disabled={!external}
                    placeholder={t('admin.ai.modelPlaceholder')}
                    onChange={(event) => setModel(event.target.value)}
                    data-testid="admin-ai-model"
                  />
                </div>
                {external && (
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="admin-ai-base-url">{t('admin.ai.baseUrlLabel')}</Label>
                    <Input
                      id="admin-ai-base-url"
                      value={baseUrl}
                      maxLength={300}
                      placeholder={
                        provider === 'OpenAiCompatible'
                          ? t('admin.ai.baseUrlRequired')
                          : t('admin.ai.baseUrlPlaceholder')
                      }
                      onChange={(event) => setBaseUrl(event.target.value)}
                      data-testid="admin-ai-base-url"
                    />
                  </div>
                )}
                {external && (
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="admin-ai-key">{t('admin.ai.keyLabel')}</Label>
                    <Input
                      id="admin-ai-key"
                      type="password"
                      autoComplete="off"
                      value={apiKey}
                      maxLength={500}
                      placeholder={
                        settings.data.apiKeyConfigured
                          ? t('admin.ai.keyKeepPlaceholder')
                          : t('admin.ai.keyPlaceholder')
                      }
                      onChange={(event) => setApiKey(event.target.value)}
                      data-testid="admin-ai-key"
                    />
                    <p className="text-xs text-muted-foreground">{t('admin.ai.keyHelp')}</p>
                  </div>
                )}
              </div>

              {external && (
                <p className="text-sm text-muted-foreground" data-testid="admin-ai-transfer-warning">
                  {provider === 'DeepSeek' ? t('admin.ai.deepSeekWarning') : t('admin.ai.transferWarning')}
                </p>
              )}

              {settings.data.hasStoredKey && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={clearApiKey}
                    onChange={(event) => setClearApiKey(event.target.checked)}
                    data-testid="admin-ai-clear-key"
                  />
                  {t('admin.ai.clearKey')}
                </label>
              )}

              <Button onClick={handleSave} disabled={update.isPending} data-testid="admin-ai-save">
                {t('admin.ai.save')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
