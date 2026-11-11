import type { SelectorRule, SelectedElement } from '../../types';
import { hashText } from '../../utils/core';
export function structuralFingerprint(el: Element) {
  return hashText(
    [
      el.tagName,
      ...[...el.children].slice(0, 20).map(
        (c) =>
          `${c.tagName}:${[...c.children]
            .slice(0, 8)
            .map((x) => x.tagName)
            .join(',')}`,
      ),
    ].join('|'),
  );
}
export function cssPath(el: Element, root: ParentNode = el.ownerDocument): string {
  const esc = (s: string) =>
    typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(s)
      : s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
  if (el.id && !/\d{5}|:/.test(el.id)) {
    const q = `#${esc(el.id)}`;
    try {
      if (root.querySelectorAll(q).length === 1) return q;
    } catch {
      /* continue structurally */
    }
  }
  for (const attr of ['data-testid', 'itemprop', 'data-field', 'aria-label', 'name']) {
    const value = el.getAttribute(attr);
    if (value) {
      const q = `${el.tagName.toLowerCase()}[${attr}="${value.replace(/["\\]/g, '\\$&')}"]`;
      try {
        if (root.querySelectorAll(q).length === 1) return q;
      } catch {
        /* fallback */
      }
    }
  }
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== root && parts.length < 7) {
    let part = current.tagName.toLowerCase();
    const classes = [...current.classList]
      .filter((c) => /^[a-z_-][a-z0-9_-]{1,45}$/i.test(c) && !/[0-9]{3}/.test(c))
      .slice(0, 2);
    if (classes.length) part += '.' + classes.map(esc).join('.');
    const parent: Element | null = current.parentElement;
    if (parent) {
      const same = [...parent.children].filter((n) => n.matches(part));
      if (same.length > 1)
        part += `:nth-of-type(${[...parent.children].filter((n) => n.tagName === current?.tagName).indexOf(current) + 1})`;
    }
    parts.unshift(part);
    try {
      if (root.querySelectorAll(parts.join(' > ')).length === 1) return parts.join(' > ');
    } catch {
      /* next parent */
    }
    current = parent;
  }
  return parts.join(' > ');
}
export function xpathFor(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current) {
    const node: Element = current;
    const siblings = node.parentElement
      ? [...node.parentElement.children].filter((c) => c.tagName === node.tagName)
      : [node];
    parts.unshift(`${node.tagName.toLowerCase()}[${siblings.indexOf(node) + 1}]`);
    current = node.parentElement;
  }
  return '/' + parts.join('/');
}
export function resolveRule(root: ParentNode, rule: SelectorRule): Element[] {
  if (rule.css) {
    try {
      const nodes = [...root.querySelectorAll(rule.css)];
      if (nodes.length) return nodes;
    } catch {
      /* fallback */
    }
  }
  if (rule.semantic) {
    const { attribute, value } = rule.semantic;
    if (/^[\w-]+$/.test(attribute)) {
      const nodes = [...root.querySelectorAll(`[${attribute}]`)].filter(
        (n) => n.getAttribute(attribute) === value,
      );
      if (nodes.length) return nodes;
    }
  }
  if (rule.label) {
    const labels = [...root.querySelectorAll('dt,th,label,strong,b')].filter(
      (n) => n.textContent?.trim() === rule.label,
    );
    const nodes = labels.flatMap((n) => (n.nextElementSibling ? [n.nextElementSibling] : []));
    if (nodes.length) return nodes;
  }
  if (rule.xpath) {
    try {
      const doc = root instanceof Document ? root : root.ownerDocument;
      if (!doc) return [];
      const result = doc.evaluate(
        rule.xpath,
        root as Node,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      );
      return Array.from({ length: result.snapshotLength }, (_, i) => result.snapshotItem(i)).filter(
        (n): n is Element =>
          n instanceof Element && (root instanceof Document || (root as Node).contains(n)),
      );
    } catch {
      /* invalid selectors yield an empty preview */
    }
  }
  return [];
}
export function repeatedSelector(el: Element): { selector: string; count: number } {
  const parent = el.parentElement;
  if (!parent) return { selector: cssPath(el), count: 1 };
  const classes = [...el.classList].filter((c) => /^[\w-]+$/.test(c)).slice(0, 2);
  const suffix = el.tagName.toLowerCase() + classes.map((c) => '.' + c).join('');
  const same = [...parent.children].filter((n) => n.matches(suffix));
  const selector = `${cssPath(parent)} > ${suffix}`;
  return { selector, count: same.length };
}
export function selectionFor(el: Element, url: string, group: string): SelectedElement {
  const repeated = repeatedSelector(el);
  const attribute =
    el instanceof HTMLImageElement ? 'src' : el instanceof HTMLAnchorElement ? 'href' : undefined;
  const semanticAttr = ['itemprop', 'data-field', 'aria-label'].find((a) => el.hasAttribute(a));
  return {
    url,
    group,
    css: cssPath(el),
    xpath: xpathFor(el),
    text: (el.textContent || '').trim().slice(0, 500),
    attribute,
    semantic: semanticAttr
      ? { attribute: semanticAttr, value: el.getAttribute(semanticAttr)! }
      : undefined,
    fingerprint: structuralFingerprint(el),
    repeated: repeated.selector,
    count: repeated.count,
  };
}
