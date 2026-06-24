import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Globe, Building2, CalendarDays, Apple, Mail } from 'lucide-react';

interface PlatformGuide {
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  stepsKey: string;
}

const PLATFORM_GUIDES: PlatformGuide[] = [
  { icon: Building2, titleKey: 'supplier.help.airbnbTitle', stepsKey: 'supplier.help.airbnbSteps' },
  { icon: Globe, titleKey: 'supplier.help.bookingTitle', stepsKey: 'supplier.help.bookingSteps' },
  { icon: Building2, titleKey: 'supplier.help.vrboTitle', stepsKey: 'supplier.help.vrboSteps' },
  { icon: CalendarDays, titleKey: 'supplier.help.googleCalendarTitle', stepsKey: 'supplier.help.googleCalendarSteps' },
  { icon: Apple, titleKey: 'supplier.help.appleCalendarTitle', stepsKey: 'supplier.help.appleCalendarSteps' },
  { icon: Mail, titleKey: 'supplier.help.outlookTitle', stepsKey: 'supplier.help.outlookSteps' },
];

export function IcalHelpPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto" data-testid="ical-help-page">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground"
        onClick={() => navigate('/app/supplier/calendar')}
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {t('supplier.help.backToSync')}
      </Button>

      <PageHeader
        title={t('supplier.help.icalPageTitle')}
        description={t('supplier.help.icalPageDescription')}
      />

      <p className="mt-4 mb-6 text-sm text-muted-foreground">
        {t('supplier.help.icalIntro')}
      </p>

      <div className="space-y-4">
        {PLATFORM_GUIDES.map((guide) => {
          const Icon = guide.icon;
          return (
            <Card key={guide.titleKey}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-5 w-5 text-primary" />
                  {t(guide.titleKey)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {(t(guide.stepsKey, { returnObjects: true }) as string[]).map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 border-blue-200 bg-blue-50">
        <CardContent className="py-4">
          <p className="text-sm text-blue-800">{t('supplier.help.syncFrequencyNote')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
