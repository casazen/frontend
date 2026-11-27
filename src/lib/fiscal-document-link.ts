/**
 * The address of the page of the document a guest got by e-mail (`/documents/view/:documentId?token=…`, E12/F02/US02). The id of the document is in the path and the
 * secret of the link in the query. It is a page of a guest who only opens the link, so two rules hang on this one prefix: it is a public path (Auth0 is never loaded
 * there, `isPublicUnauthenticatedPath`), and its visit takes no part in the signup attribution (`recordLandingTouch` records nothing for it and `validLandingPath` never
 * returns its address: what the browser keeps and the backend receives never names a document of a guest).
 */
export const FISCAL_DOCUMENT_VIEW_PATH_PREFIX = '/documents/view/';
