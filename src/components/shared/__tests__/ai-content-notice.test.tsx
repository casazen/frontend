import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import itLocale from '@/i18n/locales/it.json';
import enLocale from '@/i18n/locales/en.json';
import { AI_CONTENT_NOTICE_KEYS, AiContentNotice, type AiContentKind } from '../ai-content-notice';

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

describe('AiContentNotice (EU AI Act transparency, AC9, SE-05 A8-27)', () => {
  it('renders nothing by default (visible defaults to false)', () => {
    const { container } = render(<AiContentNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when visible=false', () => {
    const { container } = render(<AiContentNotice visible={false} kind="seo" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the transparency notice when visible=true', () => {
    render(<AiContentNotice visible={true} />);
    expect(screen.getByTestId('ai-content-notice')).toBeInTheDocument();
    expect(screen.getByText('Contenuto generato con AI')).toBeInTheDocument();
  });

  it('has the correct test id for E2E targeting', () => {
    render(<AiContentNotice visible={true} />);
    const notice = screen.getByTestId('ai-content-notice');
    expect(notice.tagName.toLowerCase()).toBe('p');
  });

  it.each(Object.keys(AI_CONTENT_NOTICE_KEYS) as AiContentKind[])(
    'AiContentNotice_%s_HasATextInItalianAndEnglish',
    (kind) => {
      const path = AI_CONTENT_NOTICE_KEYS[kind].split('.').slice(1).join('.');
      const itText = (itLocale.aiContentNotice as Record<string, string>)[path];
      const enText = (enLocale.aiContentNotice as Record<string, string>)[path];

      expect(itText).toEqual(expect.any(String));
      expect(enText).toEqual(expect.any(String));
      expect(itText).not.toEqual(enText);
    },
  );

  it('AiContentNotice_Draft_UsesTheDraftWording', () => {
    render(<AiContentNotice visible kind="draft" />);

    expect(screen.getByTestId('ai-content-notice')).toHaveTextContent('bozza da rivedere');
  });
});
