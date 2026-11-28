import { useTranslation } from 'react-i18next';

interface SkipLinkProps {
  targetId: string;
}

export function SkipLink({ targetId }: SkipLinkProps) {
  const { t } = useTranslation();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      data-testid="skip-link"
      className="fixed left-4 top-[-6rem] z-[60] inline-flex min-h-11 items-center rounded-md bg-background px-4 text-sm font-medium text-foreground shadow-md ring-2 ring-ring focus:top-3 focus:outline-none"
    >
      {t('appShell.skipToContent')}
    </a>
  );
}
