import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getProblemMessage } from '@/lib/api-errors';
import { formatStayDate } from '@/lib/stay-dates';
import { useOwnerDocuments, useOwnerProperties, useOwnerStays, useStartOwnerConversation } from '@/queries/ownerPortal';
import type { OwnerConversationTopicCode, StartOwnerConversationBody } from '@/types';
import { CONVERSATION_TOPICS, currentData, visibleStatements, type NewConversationInitial } from './owner-portal-model';
import { ownerPortalPaths } from './paths';
import { TOUCH } from './portal-parts';

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

function referenceOf(topic: OwnerConversationTopicCode, ids: Pick<NewConversationInitial, 'propertyId' | 'ownerStayId' | 'documentId' | 'statementVersionId'>) {
  switch (topic) {
    case 'property':
      return { propertyId: ids.propertyId };
    case 'ownerStay':
      return { ownerStayId: ids.ownerStayId };
    case 'document':
      return { documentId: ids.documentId };
    case 'statementVersion':
      return { statementVersionId: ids.statementVersionId };
    default:
      return {};
  }
}

interface NewConversationFormProps {
  initial: NewConversationInitial;
  onCancel: () => void;
}

/**
 * A new conversation with the agency (E07/F07/US01/T03, AC-NF111-5): a topic, exactly the item it is about (a property, a stay, a document or a published statement of the
 * person's own), a subject and the first words. The subject and the words live in this form only: not in the address, not in a storage, not in a log. What is not the
 * person's own (an id from a link) is not on offer, and the server answers 404 for it anyway. A refusal stays on screen, with the words typed; a success opens the conversation.
 */
export function NewConversationForm({ initial, onCancel }: NewConversationFormProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const properties = useOwnerProperties();
  const stays = useOwnerStays();
  const documents = useOwnerDocuments();
  const start = useStartOwnerConversation();

  const [topic, setTopic] = useState<OwnerConversationTopicCode>(initial.topic);
  const [ids, setIds] = useState({
    propertyId: initial.propertyId,
    ownerStayId: initial.ownerStayId,
    documentId: initial.documentId,
    statementVersionId: initial.statementVersionId,
  });
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  // What is on offer is what the last answer of each read says: after a refusal nothing of the answer before it stays on offer (a document of an access that was withdrawn).
  const propertiesNow = currentData(properties);
  const staysNow = currentData(stays);
  const documentsNow = currentData(documents);
  const propertyChoices = useMemo(() => {
    const byId = new Map<string, string>();
    for (const property of propertiesNow ?? []) byId.set(property.propertyId, property.propertyName);
    for (const stay of staysNow ?? []) if (!byId.has(stay.propertyId)) byId.set(stay.propertyId, stay.propertyName);
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [propertiesNow, staysNow]);
  const stayChoices = staysNow ?? [];
  const documentChoices = documentsNow?.documents ?? [];
  const statementChoices = documentsNow ? visibleStatements(documentsNow.statements) : [];

  const reference = referenceOf(topic, ids);
  const referenceValue = Object.values(reference)[0] ?? '';
  const needsReference = topic !== 'general';
  const referenceKnown =
    topic === 'property'
      ? propertyChoices.some((choice) => choice.id === referenceValue)
      : topic === 'ownerStay'
        ? stayChoices.some((stay) => stay.id === referenceValue)
        : topic === 'document'
          ? documentChoices.some((document) => document.id === referenceValue)
          : topic === 'statementVersion'
            ? statementChoices.some((statement) => statement.statementVersionId === referenceValue)
            : true;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (start.isPending) return;
    if (needsReference && !referenceKnown) {
      setProblem(t('ownerPortal.inbox.new.referenceRequired'));
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setProblem(t('ownerPortal.inbox.new.wordsRequired'));
      return;
    }
    setProblem(null);
    const payload: StartOwnerConversationBody = { topic, subject: subject.trim(), body: body.trim(), ...reference };
    start.mutate(payload, {
      onSuccess: (conversation) => {
        void navigate(ownerPortalPaths.conversation(conversation.id));
      },
    });
  };

  const refusal = start.error ? (getProblemMessage(start.error, t) ?? t('ownerPortal.inbox.new.failed')) : null;

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-md border bg-card p-4" data-testid="owner-new-conversation" aria-labelledby="owner-new-conversation-title">
      <h2 id="owner-new-conversation-title" className="text-lg font-semibold">
        {t('ownerPortal.inbox.new.title')}
      </h2>

      <Field label={t('ownerPortal.inbox.new.topic')}>
        <Select value={topic} className={TOUCH} onChange={(event) => setTopic(event.target.value as OwnerConversationTopicCode)} data-testid="owner-new-topic">
          {CONVERSATION_TOPICS.map((item) => (
            <option key={item} value={item}>
              {t(`ownerPortal.inbox.new.topics.${item}`)}
            </option>
          ))}
        </Select>
      </Field>

      {topic === 'property' ? (
        <Field label={t('ownerPortal.inbox.new.property')}>
          <Select value={referenceValue} className={TOUCH} onChange={(event) => setIds((current) => ({ ...current, propertyId: event.target.value }))} data-testid="owner-new-reference">
            <option value="">{t('ownerPortal.inbox.new.choose')}</option>
            {propertyChoices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {topic === 'ownerStay' ? (
        <Field label={t('ownerPortal.inbox.new.stay')}>
          <Select value={referenceValue} className={TOUCH} onChange={(event) => setIds((current) => ({ ...current, ownerStayId: event.target.value }))} data-testid="owner-new-reference">
            <option value="">{t('ownerPortal.inbox.new.choose')}</option>
            {stayChoices.map((stay) => (
              <option key={stay.id} value={stay.id}>
                {`${stay.propertyName} · ${formatStayDate(stay.startDate, i18n.language, DATE)} - ${formatStayDate(stay.endDate, i18n.language, DATE)}`}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {topic === 'document' ? (
        <Field label={t('ownerPortal.inbox.new.document')}>
          <Select value={referenceValue} className={TOUCH} onChange={(event) => setIds((current) => ({ ...current, documentId: event.target.value }))} data-testid="owner-new-reference">
            <option value="">{t('ownerPortal.inbox.new.choose')}</option>
            {documentChoices.map((document) => (
              <option key={document.id} value={document.id}>
                {document.title}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {topic === 'statementVersion' ? (
        <Field label={t('ownerPortal.inbox.new.statement')}>
          <Select
            value={referenceValue}
            className={TOUCH}
            onChange={(event) => setIds((current) => ({ ...current, statementVersionId: event.target.value }))}
            data-testid="owner-new-reference"
          >
            <option value="">{t('ownerPortal.inbox.new.choose')}</option>
            {statementChoices.map((statement) => (
              <option key={statement.statementVersionId} value={statement.statementVersionId}>
                {t('ownerPortal.inbox.new.statementOption', {
                  month: String(statement.periodMonth).padStart(2, '0'),
                  year: statement.periodYear,
                  version: statement.versionNumber,
                })}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label={t('ownerPortal.inbox.new.subject')}>
        <Input className={TOUCH} value={subject} onChange={(event) => setSubject(event.target.value)} autoComplete="off" data-testid="owner-new-subject" />
      </Field>
      <Field label={t('ownerPortal.inbox.new.body')}>
        <Textarea className="min-h-32" value={body} onChange={(event) => setBody(event.target.value)} data-testid="owner-new-body" />
      </Field>

      <p className="text-sm text-muted-foreground">{t('ownerPortal.inbox.new.privacyNote')}</p>
      {problem ? (
        <Alert variant="danger" data-testid="owner-new-problem">
          {problem}
        </Alert>
      ) : null}
      {refusal ? (
        <Alert variant="danger" data-testid="owner-new-refused">
          {refusal}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className={TOUCH} loading={start.isPending} data-testid="owner-new-submit">
          {start.isPending ? t('ownerPortal.inbox.new.sending') : t('ownerPortal.inbox.new.send')}
        </Button>
        <Button type="button" variant="outline" className={TOUCH} disabled={start.isPending} onClick={onCancel}>
          {t('ownerPortal.inbox.new.cancel')}
        </Button>
      </div>
    </form>
  );
}
