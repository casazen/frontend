import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReorderableList } from '@/components/shared/reorderable-list';
import type { PublicShowcaseCertification, PublicShowcaseFaq, PublicShowcaseTeamMember } from '@/api/public-supplier.api';
import { SHOWCASE_LIMITS } from '../showcase-limits';
import { CountedField } from './counted-field';
import { isRefused, type PanelProps } from './panel-types';

const L = SHOWCASE_LIMITS;

/** `list` with the item at `index` replaced. */
const replaceAt = <T,>(list: readonly T[], index: number, item: T): T[] => list.map((current, position) => (position === index ? item : current));

/** A block of the panel: a heading, what it is for, and its fields. */
function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint ? <p className="text-sm text-foreground/70">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * "Testi" (SP-13d): the sentence in large type, the introduction and "chi siamo" with their counters; the guarantee, the people, the
 * strengths, the certifications and the questions **the supplier writes** — CasaZen precompiles none of them and never adds an
 * insurance or a certification: what is not written is not on the page. Lists are edited row by row (move, remove with an "Annulla").
 */
export function TextsPanel({ doc, change, invalid }: PanelProps) {
  const { t } = useTranslation();
  const team = doc.team ?? [];
  const values = doc.values ?? [];
  const certs = doc.certs ?? [];
  const faq = doc.faq ?? [];
  const prep = doc.prep ?? [];
  const guarantee = doc.guarantee ?? {};

  const setGuarantee = (next: { title?: string | null; text?: string | null }) => {
    const title = next.title ?? '';
    const text = next.text ?? '';
    change({ guarantee: title === '' && text === '' ? null : { title, text } });
  };

  return (
    <div className="space-y-8" data-testid="supplier-showcase-panel-texts">
      <Block title={t('supplier.showcase.editor.texts.presentation')} hint={t('supplier.showcase.editor.texts.presentationHint')}>
        <CountedField
          label={t('supplier.showcase.editor.texts.tagline')}
          value={doc.tagline ?? ''}
          max={L.tagline}
          invalid={isRefused(invalid, 'tagline')}
          onChange={(value) => change({ tagline: value === '' ? null : value })}
        />
        <CountedField
          label={t('supplier.showcase.editor.texts.intro')}
          value={doc.intro ?? ''}
          max={L.intro}
          multiline
          rows={3}
          invalid={isRefused(invalid, 'intro')}
          onChange={(value) => change({ intro: value === '' ? null : value })}
        />
        <CountedField
          label={t('supplier.showcase.editor.texts.bio')}
          hint={t('supplier.showcase.editor.texts.bioHint')}
          value={doc.bio ?? ''}
          max={L.bio}
          multiline
          rows={6}
          invalid={isRefused(invalid, 'bio')}
          onChange={(value) => change({ bio: value === '' ? null : value })}
        />
      </Block>

      <Block title={t('supplier.showcase.editor.texts.guaranteeTitle')} hint={t('supplier.showcase.editor.texts.guaranteeHint')}>
        <CountedField
          label={t('supplier.showcase.editor.texts.guaranteeName')}
          value={guarantee.title ?? ''}
          max={L.guarantee.title}
          optional
          invalid={isRefused(invalid, 'guarantee')}
          onChange={(value) => setGuarantee({ ...guarantee, title: value })}
        />
        <CountedField
          label={t('supplier.showcase.editor.texts.guaranteeText')}
          value={guarantee.text ?? ''}
          max={L.guarantee.text}
          multiline
          rows={2}
          optional
          invalid={isRefused(invalid, 'guarantee')}
          onChange={(value) => setGuarantee({ ...guarantee, text: value })}
        />
      </Block>

      <Block title={t('supplier.showcase.editor.texts.teamTitle')} hint={t('supplier.showcase.editor.texts.teamHint')}>
        <ReorderableList<PublicShowcaseTeamMember>
          items={team}
          onChange={(next) => change({ team: next })}
          label={t('supplier.showcase.editor.texts.teamTitle')}
          itemLabel={(index) => t('supplier.showcase.editor.texts.person', { n: index + 1 })}
          newItem={() => ({ name: '', role: '' })}
          addLabel={t('supplier.showcase.editor.texts.addPerson')}
          removedMessage={t('supplier.showcase.editor.texts.personRemoved')}
          max={L.team.items}
          renderItem={(person, index) => (
            <>
              <CountedField
                label={t('supplier.showcase.editor.texts.personName')}
                value={person.name ?? ''}
                max={L.team.name}
                invalid={isRefused(invalid, `team[${index}].name`)}
                onChange={(value) => change({ team: replaceAt(team, index, { ...person, name: value }) })}
              />
              <CountedField
                label={t('supplier.showcase.editor.texts.personRole')}
                value={person.role ?? ''}
                max={L.team.role}
                optional
                invalid={isRefused(invalid, `team[${index}].role`)}
                onChange={(value) => change({ team: replaceAt(team, index, { ...person, role: value }) })}
              />
            </>
          )}
        />
      </Block>

      <Block title={t('supplier.showcase.editor.texts.valuesTitle')} hint={t('supplier.showcase.editor.texts.valuesHint')}>
        <ReorderableList<string>
          items={values}
          onChange={(next) => change({ values: next })}
          label={t('supplier.showcase.editor.texts.valuesTitle')}
          itemLabel={(index) => t('supplier.showcase.editor.texts.value', { n: index + 1 })}
          newItem={() => ''}
          addLabel={t('supplier.showcase.editor.texts.addValue')}
          removedMessage={t('supplier.showcase.editor.texts.valueRemoved')}
          max={L.values.items}
          renderItem={(value, index) => (
            <CountedField
              label={t('supplier.showcase.editor.texts.valueLabel')}
              value={value}
              max={L.values.text}
              invalid={isRefused(invalid, `values[${index}]`)}
              onChange={(next) => change({ values: replaceAt(values, index, next) })}
            />
          )}
        />
      </Block>

      <Block title={t('supplier.showcase.editor.texts.certsTitle')} hint={t('supplier.showcase.editor.texts.certsHint')}>
        <ReorderableList<PublicShowcaseCertification>
          items={certs}
          onChange={(next) => change({ certs: next })}
          label={t('supplier.showcase.editor.texts.certsTitle')}
          itemLabel={(index) => t('supplier.showcase.editor.texts.cert', { n: index + 1 })}
          newItem={() => ({ label: '', detail: '' })}
          addLabel={t('supplier.showcase.editor.texts.addCert')}
          removedMessage={t('supplier.showcase.editor.texts.certRemoved')}
          max={L.certs.items}
          renderItem={(cert, index) => (
            <>
              <CountedField
                label={t('supplier.showcase.editor.texts.certLabel')}
                value={cert.label ?? ''}
                max={L.certs.label}
                invalid={isRefused(invalid, `certs[${index}].label`)}
                onChange={(value) => change({ certs: replaceAt(certs, index, { ...cert, label: value }) })}
              />
              <CountedField
                label={t('supplier.showcase.editor.texts.certDetail')}
                value={cert.detail ?? ''}
                max={L.certs.detail}
                optional
                invalid={isRefused(invalid, `certs[${index}].detail`)}
                onChange={(value) => change({ certs: replaceAt(certs, index, { ...cert, detail: value }) })}
              />
            </>
          )}
        />
      </Block>

      <Block title={t('supplier.showcase.editor.texts.faqTitle')} hint={t('supplier.showcase.editor.texts.faqHint')}>
        <ReorderableList<PublicShowcaseFaq>
          items={faq}
          onChange={(next) => change({ faq: next })}
          label={t('supplier.showcase.editor.texts.faqTitle')}
          itemLabel={(index) => t('supplier.showcase.editor.texts.question', { n: index + 1 })}
          newItem={() => ({ q: '', a: '' })}
          addLabel={t('supplier.showcase.editor.texts.addQuestion')}
          removedMessage={t('supplier.showcase.editor.texts.questionRemoved')}
          max={L.faq.items}
          renderItem={(row, index) => (
            <>
              <CountedField
                label={t('supplier.showcase.editor.texts.questionLabel')}
                value={row.q ?? ''}
                max={L.faq.question}
                invalid={isRefused(invalid, `faq[${index}].q`)}
                onChange={(value) => change({ faq: replaceAt(faq, index, { ...row, q: value }) })}
              />
              <CountedField
                label={t('supplier.showcase.editor.texts.answerLabel')}
                value={row.a ?? ''}
                max={L.faq.answer}
                multiline
                rows={3}
                invalid={isRefused(invalid, `faq[${index}].a`)}
                onChange={(value) => change({ faq: replaceAt(faq, index, { ...row, a: value }) })}
              />
            </>
          )}
        />
      </Block>

      <Block title={t('supplier.showcase.editor.texts.prepTitle')} hint={t('supplier.showcase.editor.texts.prepHint')}>
        <ReorderableList<string>
          items={prep}
          onChange={(next) => change({ prep: next })}
          label={t('supplier.showcase.editor.texts.prepTitle')}
          itemLabel={(index) => t('supplier.showcase.editor.texts.prepItem', { n: index + 1 })}
          newItem={() => ''}
          addLabel={t('supplier.showcase.editor.texts.addPrep')}
          removedMessage={t('supplier.showcase.editor.texts.prepRemoved')}
          max={L.prep.items}
          renderItem={(text, index) => (
            <CountedField
              label={t('supplier.showcase.editor.texts.prepLabel')}
              value={text}
              max={L.prep.text}
              invalid={isRefused(invalid, `prep[${index}]`)}
              onChange={(next) => change({ prep: replaceAt(prep, index, next) })}
            />
          )}
        />
      </Block>
    </div>
  );
}
