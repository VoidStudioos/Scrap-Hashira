import type { DiscoveredLink, PageKind } from '../../types';
import { canonical } from '../../security/policy';
export function classifyLink(anchor: HTMLAnchorElement): PageKind {
  const label = (anchor.textContent + ' ' + anchor.href + ' ' + anchor.rel).toLowerCase();
  if (/\.(pdf|docx?|xlsx?|csv)(?:\?|$)/.test(anchor.href)) return 'document';
  if (anchor.rel.includes('next') || /page[=/]|[?&]p=|بعدی|next|صفحه/.test(label))
    return 'pagination';
  if (anchor.closest('nav,[role="navigation"]') || /categor|collection|دسته|گروه/.test(label))
    return 'category';
  if (
    /product|item|\/p\/|کالا|محصول/.test(label) ||
    anchor.closest('[itemtype*="Product"],[data-product-id]')
  )
    return 'detail';
  if (/shop|catalog|search|فروشگاه/.test(label)) return 'listing';
  return 'page';
}
export function discoverLinks(document: Document, base: string): DiscoveredLink[] {
  const seen = new Set<string>();
  return [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
    .slice(0, 10000)
    .flatMap((a) => {
      const url = canonical(a.getAttribute('href') || '', base);
      if (!url || seen.has(url) || new URL(url).origin !== new URL(base).origin) return [];
      seen.add(url);
      return [
        {
          url,
          text: (a.textContent || a.getAttribute('aria-label') || url).trim().slice(0, 160),
          kind: classifyLink(a),
          parentUrl: base,
          depth: 1,
        },
      ];
    });
}
export interface TreeNode {
  url: string;
  label: string;
  children: TreeNode[];
  kind: PageKind;
  depth: number;
}
export function buildTree(links: DiscoveredLink[], start: string): TreeNode {
  const root: TreeNode = {
    url: start,
    label: new URL(start).hostname,
    kind: 'page',
    depth: 0,
    children: [],
  };
  const nodes = new Map<string, TreeNode>([[start, root]]);
  for (const l of links) {
    if (l.url === start || new URL(l.url).origin !== new URL(start).origin) continue;
    const existing = nodes.get(l.url);
    if (!existing)
      nodes.set(l.url, {
        url: l.url,
        label: l.text || new URL(l.url).pathname,
        kind: l.kind,
        depth: l.depth,
        children: [],
      });
  }
  for (const l of links) {
    const node = nodes.get(l.url);
    if (!node || node === root) continue;
    const parent = nodes.get(l.parentUrl);
    const target = parent && parent !== node && parent.depth < node.depth ? parent : root;
    if (![...nodes.values()].some((n) => n.children.includes(node))) target.children.push(node);
  }
  return root;
}
