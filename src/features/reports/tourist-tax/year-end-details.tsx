import { useTranslation } from 'react-i18next';
import type { YearEndAccountCut } from '@/api/tourist-tax-summary.api';
import { Alert } from '@/components/ui/alert';
import { isYearEndJsonUnavailable } from '@/lib/tourist-tax-summary-errors';
import { useTouristTaxYearAgentAccount, useTouristTaxYearDeclaration, useTouristTaxYearTicinoCount } from '@/queries/use-tourist-tax-year-end';
import { AgentAccountSection } from './year-end-account';
import { DeclarationSection } from './year-end-declaration';
import { TicinoSection } from './year-end-ticino-count';

interface YearEndDetailsProps {
  year: number;
  /** How the account of the agent is cut: the choice is the page's, because the file of the account is made in the same cut. */
  by: YearEndAccountCut;
  onByChange: (by: YearEndAccountCut) => void;
}

/**
 * The three results of the year on screen, read as the data of their files (E18/F01/US02/T03, NF-117): the declaration to the comuni, the account of the agent and the count of the nights in Ticino. Each section tells its own
 * wait, refusal (403) and failure (with a retry); none draws a failed read as an empty one.
 *
 * Where the server has no JSON of them yet (400 `report_invalid_format`: the backend that adds `?format=json` is not deployed in that environment) this is not an error: the files below are there, and one line says that the
 * figures are not available yet.
 */
export function YearEndDetails({ year, by, onByChange }: YearEndDetailsProps) {
  const { t } = useTranslation();
  const declaration = useTouristTaxYearDeclaration(year);
  const account = useTouristTaxYearAgentAccount(year, by);
  const ticino = useTouristTaxYearTicinoCount(year);

  if ([declaration, account, ticino].some((query) => query.isError && isYearEndJsonUnavailable(query.error))) {
    return (
      <Alert variant="info" data-testid="year-end-details-unavailable">
        {t('reports.touristTax.yearEnd.details.unavailable')}
      </Alert>
    );
  }

  return (
    <>
      <DeclarationSection year={year} query={declaration} />
      <AgentAccountSection year={year} by={by} onByChange={onByChange} query={account} />
      <TicinoSection year={year} query={ticino} />
    </>
  );
}
