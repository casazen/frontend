import { registerDetail } from '@/components/shared/detail-drawer/detail-registry';
import { RequestDrawerContent, RequestDrawerTitle } from './request-drawer';
import { REQUEST_DRAWER_KIND, requestPath } from './request-model';

/**
 * Says how a request of the supplier is shown in the drawer of the shell (UI-15). Importing this module is what registers it: the
 * list of the requests imports it, so the address `?detail=supplier-request:<id>` of a shared link opens the drawer there.
 */
registerDetail(REQUEST_DRAWER_KIND, { title: RequestDrawerTitle, Content: RequestDrawerContent, pageHref: requestPath });
