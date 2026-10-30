/**
 * Puts the SVG text made by the map engine into a page element as real SVG nodes (DB-19a). The text is parsed as XML and
 * imported node by node, so nothing in it can run: the engine writes only shapes, gradients, patterns and the escaped text of
 * the labels. If the text is not valid XML the element is left empty (the page still has the same information as text).
 */
export function mountMapSvg(host: Element, svg: string): void {
  if (!svg) {
    host.replaceChildren();
    return;
  }
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.nodeName !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) {
    host.replaceChildren();
    return;
  }
  host.replaceChildren(host.ownerDocument.importNode(root, true));
}
