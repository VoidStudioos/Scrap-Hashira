import { analyzeSemantics } from '../semantics';
import type { Detection, ExtractedRecord, Profile, SchemaCandidate } from '../../types';
import { adapters } from './adapters';
import { extractTables } from './tables';
import { applyProfile, matchingProfiles } from '../learning';
import { cssPath, structuralFingerprint, resolveRule } from '../learning/selectors';
import { discoverLinks } from '../explorer';
import { discoverImages, imageUrl } from '../images/discover';
import { normalizeFields, completeness, recordId, normalizeText } from '../normalization';
import { canonical, webUrl, redact, sanitizeCapture } from '../../security/policy';
import { hashText } from '../../utils/core';
function readStructured(document: Document, selector: string) {
  const out: unknown[] = [];
  for (const script of [...document.querySelectorAll(selector)].slice(0, 30)) {
    try {
      if ((script.textContent?.length || 0) < 1_000_000)
        out.push(redact(JSON.parse(script.textContent || '')));
    } catch {
      /* report non-JSON through absence, do not execute */
    }
  }
  return out;
}
function cardRecord(el: Element, url: string, group: string, confidence: number): ExtractedRecord {
  const title = el.querySelector(
    '[itemprop="name"],h1,h2,h3,h4,[class*="title"],[class*="name"],a[title]',
  );
  const link = el.closest('a[href]') || title?.closest('a[href]') || el.querySelector('a[href]');
  const price = el.querySelector(
    '[itemprop="price"],[data-price],[class*="price"],[class*="cost"]',
  );
  const code = el.querySelector('[itemprop="sku"],[data-sku],[class*="sku"],[class*="code"]');
  const raw: Record<string, unknown> = {
    name: normalizeText(
      [
        title?.textContent,
        el.getAttribute('aria-label'),
        link?.textContent,
        el.textContent,
        el.querySelector('img')?.getAttribute('alt'),
        el.getAttribute('title'),
        el.querySelector('img')?.getAttribute('title'),
      ]
        .find((label) => label?.trim())
        ?.slice(0, 250) || '',
    ),
  };
  if (price)
    raw.price =
      price.getAttribute('content') ||
      price.getAttribute('data-price') ||
      price.textContent?.trim();
  if (code)
    raw.product_code =
      code.getAttribute('content') || code.getAttribute('data-sku') || code.textContent?.trim();
  if (!raw.product_code && typeof raw.name === 'string') {
    const labeledCode = raw.name.match(/^([0-9۰-۹٠-٩]{1,20})\s*[-–:]\s*\S/u);
    if (labeledCode && el.querySelector('img')) raw.product_code = labeledCode[1];
  }
  const specs: Record<string, string> = {};
  for (const dt of el.querySelectorAll('dt'))
    if (dt.nextElementSibling)
      specs[normalizeText(dt.textContent || '')] = normalizeText(
        dt.nextElementSibling.textContent || '',
      );
  if (Object.keys(specs).length) raw.specifications = specs;
  const detail = link?.getAttribute('href')
    ? canonical(link.getAttribute('href')!, url)
    : undefined;
  const images = [
    ...new Set(
      [...el.querySelectorAll<HTMLImageElement>('img')].flatMap((image) =>
        [
          image.currentSrc,
          ...['src', 'data-src', 'data-original', 'data-lazy-src', 'data-image'].map((attribute) =>
            image.getAttribute(attribute),
          ),
        ].flatMap((value) => {
          const source = value && imageUrl(value, url);
          return source ? [source] : [];
        }),
      ),
    ),
  ];
  if (detail) raw.source_url = detail;
  const fields = normalizeFields(raw);
  return {
    id: recordId(
      url,
      group,
      raw.name || !images.length ? raw : { ...raw, image: images[0] },
      detail,
    ),
    group,
    raw,
    fields,
    sourceUrl: url,
    imageUrls: images,
    detailUrl: detail,
    confidence,
    completeness: completeness(fields),
  };
}
export function detect(
  document: Document,
  url: string,
  options: {
    profiles?: Profile[];
    profileId?: string;
    candidateId?: string;
    candidateIds?: string[];
    profileIds?: string[];
    fullCapture?: boolean;
  } = {},
): Detection {
  const warnings: string[] = [];
  const structured = readStructured(document, 'script[type="application/ld+json"]');
  const embedded = readStructured(document, 'script[type="application/json"]');
  const candidates: SchemaCandidate[] = [];
  const groups = new Map<string, Element[]>();
  const add = (selector: string, label: string, confidence: number) => {
    try {
      const nodes = [...document.querySelectorAll(selector)].slice(0, 10000);
      if (nodes.length) {
        const id = 'g_' + hashText(selector);
        if (!groups.has(id)) {
          groups.set(id, nodes);
          candidates.push({
            id,
            selector,
            label,
            count: nodes.length,
            confidence,
            fields: ['name', 'price', 'product_code', 'source_url'],
          });
        }
      }
    } catch {
      /* optional hint cannot stop generic detection */
    }
  };
  const platform = adapters.find((a) => a.matches(document));
  for (const selector of platform?.selectors || []) add(selector, platform!.id + ' records', 0.87);
  for (const selector of [
    '[itemtype*="schema.org/Product"]',
    '[data-product-id]',
    'article:has(h2,h3,img)',
    '[role="list"] > [role="listitem"]',
  ])
    add(selector, 'Semantic records', 0.82);
  const walker = document.createTreeWalker(
    document.body || document.documentElement,
    NodeFilter.SHOW_ELEMENT,
  );
  let node = walker.nextNode(),
    visited = 0;
  while (node && visited++ < 15000) {
    const parent = node as Element;
    const children = [...parent.children].filter(
      (c) =>
        !['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'NAV', 'HEADER', 'FOOTER'].includes(c.tagName),
    );
    if (
      children.length >= 2 &&
      children.length <= 500 &&
      !parent.closest('nav,header,footer,table,[data-hashira-overlay]')
    ) {
      const buckets = new Map<string, Element[]>();
      for (const child of children) {
        const key = structuralFingerprint(child);
        buckets.set(key, [...(buckets.get(key) || []), child]);
      }
      for (const similar of buckets.values()) {
        if (
          similar.length >= 2 &&
          similar.length / children.length >= 0.4 &&
          (similar[0]!.textContent!.trim().length > 2 ||
            (similar[0]!.matches('li,button,[role=button],[role=treeitem]') &&
              similar[0]!.querySelector('img'))) &&
          similar[0]!.querySelector('a,img,h2,h3,h4,dl')
        ) {
          const first = similar[0]!;
          const classes = [...first.classList]
            .filter((c) => /^[a-z_-][a-z0-9_-]*$/i.test(c))
            .slice(0, 2);
          const suffix = first.tagName.toLowerCase() + classes.map((c) => '.' + c).join('');
          const selector = cssPath(parent) + ' > ' + suffix;
          const richness = first.querySelectorAll('img,h2,h3,h4,[class*="price"],dl').length;
          add(
            selector,
            'Repeated ' + first.tagName.toLowerCase(),
            Math.min(0.88, 0.45 + Math.min(similar.length, 10) * 0.02 + richness * 0.06),
          );
        }
      }
    }
    node = walker.nextNode();
  }
  candidates.sort((a, b) => b.confidence - a.confidence || b.count - a.count);
  const selected = candidates.find((c) => c.id === options.candidateId) || candidates[0];
  const selectedGroups = options.candidateIds?.length
    ? candidates.filter((c) => options.candidateIds!.includes(c.id))
    : selected
      ? [selected]
      : [];
  let records: ExtractedRecord[] = selectedGroups.flatMap((c) =>
    (groups.get(c.id) || []).map((el) => cardRecord(el, url, c.id, c.confidence)),
  );
  const jsonRecords: ExtractedRecord[] = [];
  const visit = (data: unknown, depth = 0) => {
    if (depth > 10 || !data || typeof data !== 'object') return;
    if (Array.isArray(data)) {
      data.slice(0, 1000).forEach((x) => visit(x, depth + 1));
      return;
    }
    const o = data as Record<string, unknown>;
    if (
      String(o['@type'] || '')
        .toLowerCase()
        .split(',')
        .includes('product')
    ) {
      const offers = Array.isArray(o.offers) ? o.offers[0] : o.offers;
      const offer = offers && typeof offers === 'object' ? (offers as Record<string, unknown>) : {};
      const raw: Record<string, unknown> = {
        name: o.name || '',
        product_code: o.sku || o.mpn || '',
        price: offer.price || '',
        currency: offer.priceCurrency || '',
        description: o.description || '',
        brand:
          typeof o.brand === 'object' && o.brand
            ? (o.brand as Record<string, unknown>).name
            : o.brand || '',
      };
      const detail = webUrl(String(o.url || url), url);
      const imgs = (Array.isArray(o.image) ? o.image : [o.image]).flatMap((i) => {
        const value =
          typeof i === 'string'
            ? i
            : i && typeof i === 'object'
              ? String((i as Record<string, unknown>).url || '')
              : '';
        const u = webUrl(value, url);
        return u ? [u] : [];
      });
      const fields = normalizeFields(raw);
      jsonRecords.push({
        id: recordId(url, 'json-ld', raw, detail),
        group: 'JSON-LD',
        raw,
        fields,
        sourceUrl: url,
        imageUrls: imgs,
        detailUrl: detail,
        confidence: 0.96,
        completeness: completeness(fields),
      });
    } else for (const v of Object.values(o)) visit(v, depth + 1);
  };
  structured.forEach((s) => visit(s));
  if (jsonRecords.length) {
    const byDetail = new Map(records.map((r) => [r.detailUrl || String(r.fields.name), r]));
    for (const record of jsonRecords) {
      const key = record.detailUrl || String(record.fields.name);
      const prev = byDetail.get(key);
      byDetail.set(
        key,
        prev
          ? {
              ...record,
              raw: { ...prev.raw, ...record.raw },
              fields: { ...prev.fields, ...record.fields },
              imageUrls: [...new Set([...prev.imageUrls, ...record.imageUrls])],
            }
          : record,
      );
    }
    records = [...byDetail.values()];
  }
  if (!records.length && document.querySelector('h1')) {
    const el = document.querySelector('main,[role="main"],article') || document.body;
    if (el) records = [cardRecord(el, url, 'detail', 0.55)];
  }
  let profileId: string | undefined, profileValid: boolean | undefined;
  const profileResults: { id: string; valid: boolean; count: number }[] = [];
  const profiles = matchingProfiles(options.profiles || [], url);
  const chosenProfiles = options.profileIds?.length
    ? profiles.filter((p) => options.profileIds!.includes(p.id))
    : [
        profiles.find((p) => p.id === options.profileId) ||
          (!options.profileId ? profiles[0] : undefined),
      ].filter((p): p is Profile => !!p);
  const learned: ExtractedRecord[] = [];
  for (const current of chosenProfiles) {
    try {
      const result = applyProfile(document, url, current);
      profileResults.push({ id: current.id, valid: result.valid, count: result.records.length });
      if (result.valid) learned.push(...result.records);
      else
        warnings.push(
          `Profile ${current.name}: ${result.reason}. Generic detection remains available.`,
        );
    } catch (error) {
      profileResults.push({ id: current.id, valid: false, count: 0 });
      warnings.push(
        `Profile ${current.name}: invalid rules; generic detection used (${String(error)}).`,
      );
    }
  }
  const profile = chosenProfiles[0];
  if (profile) {
    profileId = profile.id;
    profileValid = profileResults.some((p) => p.valid);
    if (learned.length) records = learned;
  }
  records = [...new Map(records.map((r) => [r.id, r])).values()];
  const metadata: Record<string, string> = {};
  for (const meta of document.querySelectorAll('meta[name],meta[property]')) {
    const key = meta.getAttribute('name') || meta.getAttribute('property');
    if (key && !/token|csrf|auth|secret/i.test(key))
      metadata[key] = meta.getAttribute('content') || '';
  }
  const links = discoverLinks(document, url);
  const nextEl =
    document.querySelector<HTMLAnchorElement>('a[rel="next"],link[rel="next"]') ||
    [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].find(
      (a) =>
        /^(next|بعدی|صفحه بعد|›|»|→)$/i.test(a.textContent?.trim() || '') ||
        /next/i.test(a.getAttribute('aria-label') || ''),
    );
  const more = [...document.querySelectorAll<HTMLElement>('button,[role="button"]')].find(
    (e) =>
      !e.hidden &&
      !e.matches('[disabled],[aria-hidden="true"]') &&
      /^(load more|show more|بیشتر|نمایش بیشتر|بارگذاری بیشتر)$/i.test(e.textContent?.trim() || ''),
  );
  const text = (document.body?.innerText || document.body?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
  const status = (
    document.defaultView?.performance.getEntriesByType('navigation')[0] as
      (PerformanceNavigationTiming & { responseStatus?: number }) | undefined
  )?.responseStatus;
  const authWall =
    (!!document.querySelector('input[type="password"]') &&
      !records.some((r) => r.confidence >= 0.8)) ||
    (/access denied|captcha|verify you are human|دسترسی غیرمجاز|ورود به حساب/i.test(
      document.title,
    ) &&
      records.length === 0);
  if (visited >= 15000)
    warnings.push(
      'DOM analysis reached its 15,000 element budget. Use a narrower visual selector.',
    );
  if (text.length > 2_000_000) warnings.push('Text capture limited to 2 million characters.');
  const images = discoverImages(document, url, records, structured);
  if (profile && profileValid) {
    if (profile.pagination) {
      const el = resolveRule(document, profile.pagination)[0];
      const next = el?.getAttribute(profile.pagination.attribute || 'href');
      if (next && webUrl(next, url))
        links.unshift({
          url: webUrl(next, url)!,
          text: 'Profile next page',
          kind: 'pagination',
          parentUrl: url,
          depth: 1,
        });
    }
    if (profile.gallery) {
      for (const el of resolveRule(document, profile.gallery)) {
        const raw = el.getAttribute(profile.gallery.attribute || 'src');
        const src = raw ? webUrl(raw, url) : undefined;
        if (src && !images.some((i) => i.url === src))
          images.push({
            url: src,
            sources: ['profile-gallery'],
            width: 0,
            height: 0,
            role: 'product',
            confidence: 0.9,
            recordIds: records.map((r) => r.id),
            alternatives: [],
          });
      }
    }
  }
  const semantic = analyzeSemantics(document, url, records, images);
  warnings.push(...semantic.warnings);
  return {
    semantic,
    url,
    title: document.title,
    records,
    images,
    tables: extractTables(document, url),
    links,
    candidates,
    structured,
    embedded,
    metadata,
    fingerprint: hashText(
      JSON.stringify(records.map((r) => r.fields)) +
        '|' +
        JSON.stringify(images.map((i) => i.url).sort()) +
        '|' +
        text.slice(0, 100000),
    ),
    adapter: platform?.id || 'Generic DOM',
    profileId,
    profileValid,
    profileResults,
    warnings,
    html: options.fullCapture ? sanitizeCapture(document) : undefined,
    text: options.fullCapture ? text.slice(0, 2_000_000) : undefined,
    status,
    authWall,
    next: nextEl ? webUrl(nextEl.getAttribute('href') || '', url) : undefined,
    loadMore: more ? cssPath(more) : undefined,
  };
}
