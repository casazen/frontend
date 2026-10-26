import { useTranslation } from 'react-i18next';
import { usePendingApprovals, useApproveItem, useRejectItem } from '@/queries/approvalQueue';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { AlertCircle, Sparkles } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { useState, useMemo } from 'react';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';
import { it, enUS } from 'date-fns/locale';

export function ApprovalQueuePage() {
  const { t, i18n: i18nInstance } = useTranslation();
  const locale = i18nInstance.language === 'it' ? it : enUS;
  const { data: items, isLoading, error } = usePendingApprovals();

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [rejectReason, setRejectReason] = useState('');

  const approveItem = useApproveItem();
  const rejectItem = useRejectItem();

  const filteredItems = useMemo(() => {
    if (!items) return [];

    let filtered = [...items];

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter((item) => item.itemType === typeFilter);
    }

    return filtered;
  }, [items, typeFilter]);

  const handleApprove = (id: string) => {
    approveItem.mutate(id);
  };

  const handleRejectClick = (id: string) => {
    setSelectedItemId(id);
    setShowRejectDialog(true);
  };

  const handleRejectConfirm = () => {
    if (!rejectReason.trim()) {
      return;
    }
    rejectItem.mutate(
      {
        id: selectedItemId,
        data: { reason: rejectReason },
      },
      {
        onSuccess: () => {
          setShowRejectDialog(false);
          setRejectReason('');
          setSelectedItemId('');
        },
      }
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'PPp', { locale });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return <LoadingScreen message={t('approval.queue.loading')} />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="danger" title={t('shared.error')} icon={AlertCircle}>
          {t('approval.queue.loadError')}
        </Alert>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t('approval.queue.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('approval.queue.description')}
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          <div className="w-full sm:w-64">
            <label htmlFor="type-filter" className="text-sm font-medium mb-2 block">
              {t('approval.filter.type')}
            </label>
            <Select id="type-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">{t('approval.filter.allTypes')}</option>
              <option value="Campaign">{t('approval.type.campaign')}</option>
              <option value="Routine">{t('approval.type.routine')}</option>
              <option value="AiText">{t('approval.type.aiText')}</option>
            </Select>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <Alert variant="info" title={t('approval.queue.emptyTitle')} icon={AlertCircle}>
            {items && items.length > 0
              ? t('approval.queue.emptyFiltered')
              : t('approval.queue.emptyQueue')}
          </Alert>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {item.itemType}
                        {item.isAiGenerated && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {t('approval.ai_generated')}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {t('approval.status.pending')} • {t('approval.expires')}: {formatDate(item.expiresAt)}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="font-medium text-sm text-muted-foreground">
                      {t('approval.content')}
                    </div>
                    <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
                      {item.contentText}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(item.id)}
                      disabled={approveItem.isPending}
                    >
                      {t('approval.action.approve')}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRejectClick(item.id)}
                      disabled={rejectItem.isPending}
                    >
                      {t('approval.action.reject')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('approval.dialog.rejectTitle')}</DialogTitle>
            <DialogDescription>
              {t('approval.dialog.rejectDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">{t('approval.dialog.reasonLabel')}</Label>
              <Textarea
                id="reject-reason"
                placeholder={t('approval.dialog.reasonPlaceholder')}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectReason('');
                setSelectedItemId('');
              }}
              disabled={rejectItem.isPending}
            >
              {t('shared.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectItem.isPending || !rejectReason.trim()}
            >
              {t('approval.action.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
