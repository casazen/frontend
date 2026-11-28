import { registerDetail } from '@/components/shared/detail-drawer/detail-registry';
import { RequestDrawerContent, RequestDrawerTitle } from './request-drawer';
import { REQUEST_DRAWER_KIND, requestPath } from './request-model';

registerDetail(REQUEST_DRAWER_KIND, { title: RequestDrawerTitle, Content: RequestDrawerContent, pageHref: requestPath });
