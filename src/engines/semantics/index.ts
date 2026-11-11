import { imageUrl } from '../images/discover';
import type {
  CategoryNode,
  TypedField,
  SemanticAnalysis,
  ExtractedRecord,
  ImageCandidate,
  ImageLink,
} from '../../types';
import { normalizeText, latinDigits, parsePrice } from '../normalization';
import { hashText } from '../../utils/core';
import { webUrl } from '../../security/policy';
export function classifyValue(
  raw: unknown,
  label = '',
  context = '',
): Pick<TypedField, 'kind' | 'value' | 'confidence' | 'evidence'> {
  const text = normalizeText(String(raw ?? ''));
  const digits = latinDigits(text);
  const hint = normalizeText(label + ' ' + context).toLowerCase();
  if (
    /(?:sku|mpn|part.?number|product.?code|barcode|serial|شناسه|کد|شماره.?فنی|بارکد)/iu.test(
      hint,
    ) ||
    /(?:^|[. _-])(?:id|code|ean|upc|isbn|reference)(?:$|[. _-])/i.test(hint)
  )
    return {
      kind: 'code',
      value: text,
      confidence: 0.96,
      evidence: 'Code/identifier label; leading zeroes preserved',
    };
  if (
    /(?:price|cost|amount|قیمت|مبلغ|ریال|تومان|[$€£])/iu.test(hint + ' ' + text) &&
    parsePrice(text) !== undefined
  )
    return {
      kind: 'price',
      value: parsePrice(text)!,
      confidence: 0.94,
      evidence: 'Currency or price label',
    };
  if (
    /(?:quantity|qty|stock|count|تعداد|موجودی)/iu.test(hint) &&
    /^[+\-]?[\d٬,٫.\s]+$/.test(digits)
  )
    return {
      kind: 'quantity',
      value: parsePrice(text) ?? text,
      confidence: 0.94,
      evidence: 'Quantity/count label',
    };
  if (/^https?:\/\//i.test(text) && webUrl(text))
    return { kind: 'link', value: text, confidence: 0.98, evidence: 'HTTP(S) URL' };
  if (/^0\d{2,}$/.test(digits))
    return {
      kind: 'code',
      value: text,
      confidence: 0.62,
      evidence: 'Leading zeroes suggest an identifier; retained as text, review recommended',
    };
  if (/^(?=.*\d)(?=.*[a-z])[a-z\d]+(?:[-_/][a-z\d]+)*$/i.test(digits))
    return {
      kind: 'code',
      value: text,
      confidence: 0.7,
      evidence: 'Compact mixed letter/digit identifier pattern',
    };
  if (/^[+\-]?\d[\d,٬.٫\s]*$/.test(digits))
    return {
      kind: 'number',
      value: parsePrice(text) ?? text,
      confidence: 0.76,
      evidence: 'Numeric literal without a more specific semantic label',
    };
  return {
    kind: 'text',
    value: text,
    confidence: 0.72,
    evidence: 'Readable text; no stronger supported type signal',
  };
}
function ownLabel(element: Element) {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('ul,ol,[role="group"],[role="tree"],button').forEach((e) => e.remove());
  return normalizeText(element.getAttribute('aria-label') || clone.textContent || '').slice(0, 200);
}
export function analyzeSemantics(
  document: Document,
  url: string,
  records: ExtractedRecord[],
  images: ImageCandidate[],
): SemanticAnalysis {
  const categories: CategoryNode[] = [];
  const fields: TypedField[] = [];
  const fieldIds = new Set<string>();
  const imageLinks: ImageLink[] = [];
  const warnings: string[] = [];
  const elementNodes = new Map<Element, CategoryNode>();
  const addCategory = (el: Element, source: CategoryNode['source'], parentId?: string) => {
    const link = el.matches('a[href]')
      ? el
      : el.querySelector(':scope > a[href],:scope > span > a[href]');
    const label = ownLabel(link || el);
    if (!label) return;
    const href = link ? webUrl(link.getAttribute('href') || '', url) : undefined;
    const code =
      el.getAttribute('data-id') ||
      el.getAttribute('data-category-id') ||
      label.match(/^(?:کد\s*)?([۰-۹٠-٩\d]+)\s*[-–:.)]/u)?.[1];
    const parent = categories.find((c) => c.id === parentId);
    const path = [...(parent?.path || []), label];
    const id =
      'category_' +
      hashText(new URL(url).origin + '|' + source + '|' + path.join('/') + '|' + (href || ''));
    let node = categories.find((c) => c.id === id);
    if (!node) {
      node = {
        id,
        label,
        code: code || undefined,
        href,
        parentId,
        path,
        source,
        sourceUrl: url,
        collapsed: el.getAttribute('aria-expanded') === 'false',
        confidence: source === 'tree' ? 0.95 : source === 'breadcrumb' ? 0.92 : 0.68,
      };
      categories.push(node);
    }
    elementNodes.set(el, node);
    return node;
  };
  const treeElements = [
    ...document.querySelectorAll(
      '[role="treeitem"],.tree li,.jstree li,[data-tree] li,.k-treeview li.k-item',
    ),
  ].slice(0, 2000);
  for (const el of treeElements) {
    let ancestor = el.parentElement;
    while (ancestor && !elementNodes.has(ancestor)) ancestor = ancestor.parentElement;
    addCategory(el, 'tree', ancestor ? elementNodes.get(ancestor)?.id : undefined);
  }
  for (const root of [
    ...document.querySelectorAll('nav ul,nav ol,[role="navigation"] ul,[role="navigation"] ol'),
  ].filter(
    (el) =>
      !el.parentElement?.closest('nav ul,nav ol,[role="navigation"] ul,[role="navigation"] ol'),
  )) {
    for (const el of [...root.querySelectorAll('li')].slice(0, 1000)) {
      if (elementNodes.has(el)) continue;
      let parent = el.parentElement?.closest('li');
      while (parent && !elementNodes.has(parent))
        parent = parent.parentElement?.closest('li') || null;
      addCategory(el, 'navigation', parent ? elementNodes.get(parent)?.id : undefined);
    }
  }
  for (const el of [...document.querySelectorAll('ul:has(ul) li,ol:has(ol) li')].slice(0, 2000)) {
    if (elementNodes.has(el) || el.closest('table,footer')) continue;
    let parent = el.parentElement?.closest('li');
    while (parent && !elementNodes.has(parent))
      parent = parent.parentElement?.closest('li') || null;
    addCategory(el, 'list', parent ? elementNodes.get(parent)?.id : undefined);
  }
  const crumbs = [
    ...document.querySelectorAll(
      '[aria-label*="breadcrumb" i] a,[itemtype*="BreadcrumbList"] [itemprop="name"],.breadcrumb a,.breadcrumbs a',
    ),
  ].slice(0, 50);
  let parentId: string | undefined;
  for (const crumb of crumbs) {
    const node = addCategory(crumb, 'breadcrumb', parentId);
    if (node) parentId = node.id;
  }
  const root: CategoryNode = {
    id: 'category_' + hashText(url + '|unassigned'),
    label: document.title || new URL(url).pathname,
    sourceUrl: url,
    path: [document.title || new URL(url).pathname],
    source: 'page',
    confidence: 0.4,
  };
  categories.push(root);
  const breadcrumbIds = categories.filter((c) => c.source === 'breadcrumb');
  const activeNode = [...elementNodes]
    .filter(
      ([el, c]) =>
        el.matches('[aria-selected="true"],[aria-current="page"]') ||
        !!el.querySelector('[aria-current="page"]') ||
        c.href === url,
    )
    .at(-1)?.[1];
  const defaultCategory = breadcrumbIds.at(-1)?.id || activeNode?.id || root.id;
  const categoryFor = (el?: Element | null) => {
    let node = el || null;
    while (node) {
      const category = elementNodes.get(node);
      if (category) return category.id;
      node = node.parentElement;
    }
    return defaultCategory;
  };
  const push = (
    raw: unknown,
    label: string,
    categoryId: string,
    recordId?: string,
    context = '',
  ) => {
    if (raw == null || typeof raw === 'object') return;
    const text = String(raw);
    if (!text.trim()) return;
    const typed = classifyValue(raw, label, context);
    const id =
      'field_' +
      hashText(url + '|' + categoryId + '|' + (recordId || '') + '|' + label + '|' + text);
    if (!fieldIds.has(id)) {
      fieldIds.add(id);
      fields.push({ id, raw: text, label, ...typed, categoryId, recordId, sourceUrl: url });
    }
  };
  for (const category of categories) {
    if (category.code) push(category.code, 'category code', category.id);
  }
  const flatten = (
    value: unknown,
    label: string,
    categoryId: string,
    recordId: string,
    depth = 0,
  ) => {
    if (depth > 5) return;
    if (value && typeof value === 'object') {
      for (const [key, v] of Object.entries(value).slice(0, 200))
        flatten(v, label ? label + '.' + key : key, categoryId, recordId, depth + 1);
    } else push(value, label, categoryId, recordId);
  };
  for (const record of records) {
    const explicit = record.fields.category || record.fields.category_name || record.fields['دسته'];
    let categoryId = defaultCategory;
    if (typeof explicit === 'string' && explicit.trim()) {
      let category = categories.find((c) => c.label === normalizeText(explicit));
      if (!category) {
        category = {
          id: 'category_' + hashText(url + '|record|' + explicit),
          label: normalizeText(explicit),
          path: [normalizeText(explicit)],
          source: 'record',
          sourceUrl: url,
          confidence: 0.86,
        };
        categories.push(category);
      }
      categoryId = category.id;
    }
    record.categoryIds = [categoryId];
    for (const [key, value] of Object.entries(record.raw))
      flatten(value, key, categoryId, record.id);
  }
  for (const a of [...document.querySelectorAll('a[href]')].slice(0, 10000)) {
    const href = webUrl(a.getAttribute('href') || '', url);
    if (href) push(href, 'href', categoryFor(a));
  }
  const docWalker = document.createTreeWalker(
    document.body || document.documentElement,
    NodeFilter.SHOW_TEXT,
  );
  let node = docWalker.nextNode(),
    walked = 0;
  while (node && walked++ < 20000 && fields.length < 10000) {
    const el = node.parentElement;
    const text = normalizeText(node.textContent || '');
    if (
      el &&
      text &&
      !el.closest('script,style,noscript,input,textarea,select,[data-hashira-overlay]') &&
      el.getAttribute('aria-hidden') !== 'true'
    ) {
      const cell = el.closest('td,th') as HTMLTableCellElement | null;
      const table = cell?.closest('table');
      const headerRow =
        table?.tHead?.rows.item((table.tHead.rows.length || 1) - 1) || table?.rows.item(0);
      const columnLabel =
        headerRow && headerRow !== cell?.parentElement
          ? [...headerRow.cells].filter((c) => c.tagName === 'TH')[cell?.cellIndex || 0]
              ?.textContent || ''
          : '';
      const label =
        el.getAttribute('itemprop') ||
        el.getAttribute('data-field') ||
        el.getAttribute('aria-label') ||
        columnLabel ||
        (el.previousElementSibling?.matches('dt,label,th') &&
          el.previousElementSibling.textContent) ||
        '';
      push(text, String(label), categoryFor(el), undefined, el.getAttribute('class') || '');
    }
    node = docWalker.nextNode();
  }
  const imageToRecords = (img: HTMLImageElement) => {
    const candidates = [
      img.currentSrc,
      img.getAttribute('src'),
      img.getAttribute('data-src'),
      img.getAttribute('data-original'),
    ].flatMap((s) => {
      const u = s ? imageUrl(s, url) : undefined;
      return u ? [u] : [];
    });
    return records
      .filter(
        (r) =>
          r.imageUrls.some((u) => candidates.includes(u)) ||
          (r.detailUrl &&
            webUrl(img.closest('a[href]')?.getAttribute('href') || '', url) === r.detailUrl),
      )
      .map((r) => r.id);
  };
  for (const img of [...document.querySelectorAll<HTMLImageElement>('img')].slice(0, 10000)) {
    const thumbnailUrl = imageUrl(
      img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src') || '',
      url,
    );
    const anchor = img.closest('a[href]');
    const opener =
      img.closest('[data-full],[data-image],[data-zoom-image],[data-lightbox]') ||
      anchor ||
      img.closest('[role="button"],button,[onclick]');
    const advertised =
      opener?.getAttribute('data-full') ||
      opener?.getAttribute('data-image') ||
      opener?.getAttribute('data-zoom-image') ||
      anchor?.getAttribute('href');
    const targetUrl = advertised ? imageUrl(advertised, url) : undefined;
    const hint =
      (anchor?.getAttribute('type') || '') +
      ' ' +
      (opener?.getAttribute('data-lightbox') || '') +
      ' ' +
      (opener?.getAttribute('class') || '');
    const direct =
      !!targetUrl &&
      (/^data:image\//i.test(targetUrl) ||
        /\.(?:jpe?g|png|webp|gif|avif|svg|bmp)(?:[?#]|$)/i.test(targetUrl));
    const candidate =
      !!targetUrl &&
      (!!opener?.hasAttribute('data-full') ||
        !!opener?.hasAttribute('data-image') ||
        !!opener?.hasAttribute('data-zoom-image') ||
        /image\/|zoom|lightbox|gallery/i.test(hint) ||
        /\/(?:image|images|media|photo|photos)(?:[/?]|$)/i.test(targetUrl) ||
        !!anchor?.hasAttribute('data-lightbox'));
    const interactive =
      !!opener || document.defaultView?.getComputedStyle(img).cursor === 'pointer';
    const relation: ImageLink['relation'] = direct
      ? 'direct-image'
      : candidate
        ? 'candidate-image'
        : targetUrl
          ? 'unverified-target'
          : interactive
            ? 'interaction-required'
            : 'inline-image';
    const recordIds = imageToRecords(img);
    const categoryId =
      records.find((r) => recordIds.includes(r.id))?.categoryIds?.[0] || categoryFor(img);
    imageLinks.push({
      id: 'image_link_' + hashText(url + '|' + thumbnailUrl + '|' + targetUrl),
      sourceUrl: url,
      thumbnailUrl,
      targetUrl,
      relation,
      recordIds,
      categoryId,
      confidence: direct ? 0.98 : candidate ? 0.78 : targetUrl ? 0.75 : 0.5,
      evidence: direct
        ? 'Image URL advertised by clickable image'
        : candidate
          ? 'Gallery/zoom data attributes; byte verification still required'
          : targetUrl
            ? 'Extensionless click target; its MIME type must be checked before treating it as an image or page'
            : interactive
              ? 'Interactive image without an accessible URL; open it in the page to capture its contents'
              : 'Inline image',
    });
    if (targetUrl && (direct || candidate) && !images.some((i) => i.url === targetUrl))
      images.push({
        url: targetUrl,
        sources: ['click-target'],
        width: 0,
        height: 0,
        role: recordIds.length ? 'product' : 'unknown',
        confidence: candidate ? 0.78 : 0.96,
        recordIds,
        alternatives: thumbnailUrl ? [thumbnailUrl] : [],
      });
  }
  if (treeElements.some((e) => e.getAttribute('aria-expanded') === 'false'))
    warnings.push(
      'Collapsed tree branches were recorded. Unloaded children need an authorized expansion; they are not invented.',
    );
  if (walked >= 20000 || fields.length >= 10000)
    warnings.push(
      'Semantic scan reached its node/field budget; narrow the scope for very large pages.',
    );
  return { categories, fields, imageLinks, warnings };
}

/** Classify scalar records returned by an explicitly configured JSON endpoint. */
export function appendFlatRecordSemantics(
  analysis: SemanticAnalysis | undefined,
  record: ExtractedRecord,
) {
  if (!analysis) return;
  let category =
    analysis.categories.filter((c) => c.source === 'breadcrumb').at(-1) ||
    analysis.categories.find((c) => c.source === 'page');
  const named = record.fields.category || record.fields.category_name;
  if (typeof named === 'string' && named.trim()) {
    category = analysis.categories.find((c) => c.label === normalizeText(named));
    if (!category) {
      category = {
        id: 'category_' + hashText(new URL(record.sourceUrl).origin + '|record|' + named),
        label: normalizeText(named),
        path: [normalizeText(named)],
        source: 'record',
        sourceUrl: record.sourceUrl,
        confidence: 0.86,
      };
      analysis.categories.push(category);
    }
  }
  if (!category) return;
  record.categoryIds = [category.id];
  for (const [label, raw] of Object.entries(record.raw)) {
    if (raw === null || typeof raw === 'object') continue;
    const text = String(raw);
    const id =
      'field_' +
      hashText(record.sourceUrl + '|' + category.id + '|' + record.id + '|' + label + '|' + text);
    if (analysis.fields.some((f) => f.id === id)) continue;
    analysis.fields.push({
      id,
      raw: text,
      label,
      ...classifyValue(raw, label),
      categoryId: category.id,
      recordId: record.id,
      sourceUrl: record.sourceUrl,
    });
  }
}
