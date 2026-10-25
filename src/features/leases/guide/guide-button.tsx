import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/** At least 44 px high on every device (the product rule); a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

type GuideButtonProps = {
  label: string;
  testId?: string;
} & (
  | { href: string; onClick?: undefined; loading?: undefined }
  | { onClick: () => void; loading?: boolean; href?: undefined }
);

/**
 * The one gesture of an advice or of a tool of the guide: a link of the router when it goes to a page or a tab of the sheet, a button
 * when it runs something or opens a window. The same look for both, and the same size for a finger.
 */
export function GuideButton(props: GuideButtonProps) {
  if (props.href !== undefined) {
    return (
      <Button asChild variant="outline" className={TOUCH_TARGET}>
        <Link to={props.href} data-testid={props.testId}>
          {props.label}
        </Link>
      </Button>
    );
  }

  const { onClick } = props;
  return (
    <Button type="button" variant="outline" className={TOUCH_TARGET} loading={props.loading} data-testid={props.testId} onClick={() => onClick()}>
      {props.label}
    </Button>
  );
}
