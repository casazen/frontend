import { useTranslation } from 'react-i18next';
import { guideFields, type HouseGuide } from './house-guide-fields';


export function HouseGuideSections({ guide }: { guide: HouseGuide }) {
  const { t } = useTranslation();
  return guideFields.map((field) => {
    const value = guide[field]?.trim();
    return value ? (
      <section key={field}>
        <h3 className="font-semibold">{t(`guestPortal.guide.${field}`)}</h3>
        <p className="whitespace-pre-wrap break-words">{value}</p>
      </section>
    ) : null;
  });
}
