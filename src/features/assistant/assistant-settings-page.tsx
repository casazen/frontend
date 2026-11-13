import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { useWorkspace } from '@/hooks/use-workspace';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { cn } from '@/lib/utils';
import { useProperties } from '@/queries/use-properties';
import { KnowledgeList } from './components/knowledge-list';
import { PropertyAssistantPanel } from './components/property-assistant-panel';
import { RulesForm } from './components/rules-form';
import { SettingsError, SettingsLoading, SettingsNoAccess, SettingsNotFound } from './components/settings-states';
import { SituationsTable } from './components/situations-table';
import { ASSISTANT_SETTINGS_PATH, ASSISTANT_TABS, type AssistantTab } from './lib/assistant-routes';

/** The tab the address names; anything else is the first one (a link of an older version, a typo). */
function tabOf(value: string | null): AssistantTab {
  return ASSISTANT_TABS.find((tab) => tab === value) ?? 'rules';
}

/** The properties of Affitti brevi, read again at every visit: the list is changed on other pages. */
function useShortProperties() {
  return useProperties({ mode: 'short' }, { fresh: true });
}

interface PermissionsProps {
  canReadRules: boolean;
  canReadProperty: boolean;
  canWriteProperty: boolean;
  isAdmin: boolean;
}

function RulesTab({ canReadRules, isAdmin }: Pick<PermissionsProps, 'canReadRules' | 'isAdmin'>) {
  return (
    <div className={cn(FOCUS_COLUMN, 'space-y-10')} data-testid="assistant-tab-rules">
      <RulesForm canRead={canReadRules} canEdit={isAdmin} />
      <KnowledgeList scope={{ kind: 'organization' }} canRead={canReadRules} canEdit={isAdmin} />
    </div>
  );
}

function PropertiesTab({ propertyId, canReadRules, canReadProperty, canWriteProperty }: Pick<PermissionsProps, 'canReadRules' | 'canReadProperty' | 'canWriteProperty'> & { propertyId: string | null }) {
  const { t } = useTranslation();
  const properties = useShortProperties();

  if (properties.isPending) return <SettingsLoading testId="assistant-properties-loading" />;
  if (!properties.data) return <SettingsError message={t('assistant.property.listError')} onRetry={() => void properties.refetch()} testId="assistant-properties-error" />;
  if (properties.data.length === 0) return <SettingsNoAccess message={t('assistant.property.empty')} testId="assistant-properties-empty" />;

  const chosen = propertyId === null ? undefined : properties.data.find((property) => property.id === propertyId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:items-start" data-testid="assistant-tab-properties">
      <nav aria-label={t('assistant.property.listLabel')} className="min-w-0">
        <ul className="space-y-1">
          {properties.data.map((property) => {
            const current = property.id === propertyId;
            return (
              <li key={property.id}>
                <Link
                  to={`${ASSISTANT_SETTINGS_PATH}?tab=properties&propertyId=${encodeURIComponent(property.id)}`}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center rounded-lg px-3 py-2 text-sm break-words hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    current ? 'bg-muted font-semibold' : 'text-foreground/80',
                  )}
                  data-testid="assistant-property-link"
                >
                  {property.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0">
        {propertyId === null ? (
          <p className="text-sm text-foreground/70" data-testid="assistant-choose-property">
            {t('assistant.property.choose')}
          </p>
        ) : chosen === undefined ? (
          // The address names a property that is not among the person's (another organization, out of its reach, or gone): never another one in its place.
          <SettingsNotFound title={t('assistant.property.notFound')} hint={t('assistant.property.notFoundHint')} testId="assistant-property-unknown" />
        ) : (
          <div className="space-y-4">
            <h2 className="break-words text-lg font-semibold" data-testid="assistant-property-name">
              {chosen.name}
            </h2>
            <PropertyAssistantPanel key={chosen.id} propertyId={chosen.id} canRead={canReadProperty} canEdit={canWriteProperty} canReadRules={canReadRules} />
          </div>
        )}
      </div>
    </div>
  );
}

/** The situations of the organization or of one property, with the choice of which. The choice needs the list of the properties: only a person who may read them has it. */
function SituationsTab({ propertyId, canReadRules, canReadProperty, canWriteProperty, isAdmin }: PermissionsProps & { propertyId: string | null }) {
  if (!canReadProperty) {
    return (
      <div className="space-y-6" data-testid="assistant-tab-situations">
        <SituationsTable propertyId={null} canRead={canReadRules} canEdit={isAdmin} />
      </div>
    );
  }
  return <SituationsOfScope propertyId={propertyId} canReadRules={canReadRules} canReadProperty={canReadProperty} canWriteProperty={canWriteProperty} isAdmin={isAdmin} />;
}

function SituationsOfScope({ propertyId, canReadRules, canReadProperty, canWriteProperty, isAdmin }: PermissionsProps & { propertyId: string | null }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const properties = useShortProperties();

  const known = propertyId === null || properties.data?.some((property) => property.id === propertyId) === true;
  const forProperty = propertyId !== null;

  const choose = (value: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', 'situations');
    if (value) next.set('propertyId', value);
    else next.delete('propertyId');
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6" data-testid="assistant-tab-situations">
      <div className="w-full sm:w-80">
        <Field label={t('assistant.situations.scope')} hint={t('assistant.situations.scopeHelp')}>
          <Select value={propertyId ?? ''} onChange={(event) => choose(event.target.value)} disabled={properties.isPending} data-testid="assistant-situations-scope">
            <option value="">{t('assistant.situations.scopeOrganization')}</option>
            {(properties.data ?? []).map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {forProperty && properties.isError && !properties.data ? (
        <SettingsError message={t('assistant.property.listError')} onRetry={() => void properties.refetch()} testId="assistant-properties-error" />
      ) : forProperty && properties.isPending ? (
        <SettingsLoading testId="assistant-properties-loading" />
      ) : !known ? (
        <SettingsNotFound title={t('assistant.property.notFound')} hint={t('assistant.property.notFoundHint')} testId="assistant-property-unknown" />
      ) : (
        <SituationsTable
          key={propertyId ?? 'organization'}
          propertyId={propertyId}
          canRead={forProperty ? canReadProperty : canReadRules}
          canEdit={forProperty ? canWriteProperty : isAdmin}
        />
      )}
    </div>
  );
}

/**
 * The settings of the assistant (E05/F05/US04/T02, NF-66): `/app/short-rent/settings/assistant`, in «Altro», only with the flag `messageAssistant`. Three tabs (the tab is in
 * the address, `?tab=`; a property in `?propertyId=`): the rules of the organization (changed by its administrator alone, the others read them), the properties (each with
 * its switch, its exceptions and what the assistant may say about it) and the situations (what the assistant does in each, for the organization or for one property).
 * The assistant only drafts in this release: nothing is sent without the host's approval.
 */
export function AssistantSettingsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const [params] = useSearchParams();
  const tab = tabOf(params.get('tab'));
  const propertyId = params.get('propertyId');

  const permissions: PermissionsProps = {
    canReadRules: hasPermission('short-rent', 'booking.read'),
    canReadProperty: hasPermission('short-rent', 'property.read'),
    canWriteProperty: hasPermission('short-rent', 'property.write'),
    isAdmin: hasPermission('short-rent', ORG_BILLING_ADMIN_PERMISSION),
  };

  const tabs: TabItem<AssistantTab>[] = [
    { value: 'rules', label: t('assistant.settings.tabs.rules'), testId: 'assistant-tab-link-rules' },
    { value: 'properties', label: t('assistant.settings.tabs.properties'), testId: 'assistant-tab-link-properties' },
    { value: 'situations', label: t('assistant.settings.tabs.situations'), testId: 'assistant-tab-link-situations' },
  ];

  return (
    <AppShell>
      <div className="min-w-0 space-y-6" data-testid="assistant-settings-page">
        <PageHeader title={t('assistant.settings.title')} description={t('assistant.settings.description')} crumbs="auto" />
        <p className="max-w-3xl break-words text-sm text-foreground/70" data-testid="assistant-settings-drafts-only">
          {t('assistant.settings.draftsOnly')}
        </p>
        <Tabs label={t('assistant.settings.tabsLabel')} items={tabs} defaultValue="rules" value={tab} selectTestId="assistant-tabs-select">
          {tab === 'rules' ? <RulesTab canReadRules={permissions.canReadRules} isAdmin={permissions.isAdmin} /> : null}
          {tab === 'properties' ? (
            permissions.canReadProperty ? (
              <PropertiesTab
                propertyId={propertyId}
                canReadRules={permissions.canReadRules}
                canReadProperty={permissions.canReadProperty}
                canWriteProperty={permissions.canWriteProperty}
              />
            ) : (
              <SettingsNoAccess message={t('assistant.noAccess.property')} testId="assistant-properties-no-access" />
            )
          ) : null}
          {tab === 'situations' ? <SituationsTab propertyId={propertyId} {...permissions} /> : null}
        </Tabs>
      </div>
    </AppShell>
  );
}
