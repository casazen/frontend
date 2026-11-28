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
