import type { ImageCandidate, ExtractedRecord } from '../../types';
import { webUrl } from '../../security/policy';
export function imageUrl(value: string, base: string): string | undefined {
  value = value.trim();
  if (!value) return;
  if (
    /^data:image\/(png|apng|jpe?g|webp|avif|gif|bmp|tiff?|heic|heif|jxl|x-icon|vnd.microsoft.icon|svg\+xml)[;,]/i.test(
      value,
    ) &&
    value.length < 2_000_000
  )
    return value;
  return webUrl(value, base);
}
export function srcsetCandidates(value: string): { url: string; size: number }[] {
  return value
    .split(/,\s*(?![^()]*\))/)
    .flatMap((part) => {
      const m = part.trim().match(/^(\S+)\s*(?:(\d+(?:\.\d+)?)(w|x))?$/);
      return m ? [{ url: m[1]!, size: Number(m[2]) * (m[3] === 'x' ? 1000 : 1) || 1 }] : [];
    })
    .sort((a, b) => b.size - a.size);
}
export function discoverImages(
  document: Document,
  url: string,
  records: ExtractedRecord[],
  structured: unknown[],
): ImageCandidate[] {
  const map = new Map<string, ImageCandidate>();
  const add = (raw: string, source: string, el?: Element, alternatives: string[] = []) => {
    const u = imageUrl(raw, url);
    if (!u) return;
    const img = el?.tagName === 'IMG' ? (el as HTMLImageElement) : undefined;
    const width = img?.naturalWidth || Number(el?.getAttribute('width')) || 0,
      height = img?.naturalHeight || Number(el?.getAttribute('height')) || 0;
    const info = [el?.getAttribute('alt'), el?.id, el?.getAttribute('class'), source]
      .filter(Boolean)
      .join(' ');
    const related = records
      .filter(
        (r) =>
          r.imageUrls.includes(u) ||
          (r.detailUrl &&
            el?.closest('a[href]')?.getAttribute('href') &&
            webUrl(el.closest('a[href]')!.getAttribute('href')!, url) === r.detailUrl),
      )
      .map((r) => r.id);
    let role: ImageCandidate['role'] = 'unknown',
      confidence = 0.45;
    if (/logo/i.test(info) || /^https?:.*[/_.-]logo[_.-]/i.test(u)) {
      role = 'logo';
      confidence = 0.85;
    } else if (/icon|sprite/i.test(info) || (width > 0 && width <= 48 && height <= 48)) {
      role = 'icon';
      confidence = 0.8;
    } else if (related.length || /product|gallery|محصول/i.test(info)) {
      role = 'product';
      confidence = 0.85;
    } else if (el?.closest('header,nav,footer,[role=banner],[role=navigation]')) {
      role = 'decorative';
      confidence = 0.8;
    } else if (width > 0 && height > 0 && width / height > 4) {
      role = 'banner';
      confidence = 0.7;
    } else if (width > 0 && width <= 180) {
      role = 'thumbnail';
      confidence = 0.6;
    } else if (source === 'css') {
      role = 'decorative';
      confidence = 0.55;
    }
    const existing = map.get(u);
    if (existing) {
      existing.sources = [...new Set([...existing.sources, source])];
      existing.recordIds = [...new Set([...existing.recordIds, ...related])];
      existing.alternatives = [...new Set([...existing.alternatives, ...alternatives])];
      return;
    }
    map.set(u, {
      url: u,
      sources: [source],
      width,
      height,
      role,
      confidence,
      recordIds: related,
      alternatives: alternatives.flatMap((a) => {
        const x = imageUrl(a, url);
        return x ? [x] : [];
      }),
    });
  };
  for (const img of [...document.querySelectorAll('img')].slice(0, 10000)) {
    const candidates = [
      ...srcsetCandidates(img.getAttribute('srcset') || ''),
      ...[...(img.closest('picture')?.querySelectorAll('source') || [])].flatMap((s) =>
        srcsetCandidates(s.getAttribute('srcset') || ''),
      ),
    ].sort((a, b) => b.size - a.size);
    const fallback = [
      img.currentSrc,
      img.getAttribute('src'),
      ...[
        'data-src',
        'data-original',
        'data-lazy-src',
        'data-original-src',
        'data-image',
        'data-full',
        'data-zoom-image',
        'data-large_image',
      ].map((a) => img.getAttribute(a)),
    ].filter((v): v is string => !!v);
    for (const raw of [...candidates.map((c) => c.url), ...fallback])
      add(raw, 'img', img, [...candidates.map((c) => c.url), ...fallback]);
  }
  for (const el of [
    ...document.querySelectorAll('a[href],meta[property="og:image"],meta[name="twitter:image"]'),
  ].slice(0, 10000)) {
    const raw = el.getAttribute('href') || el.getAttribute('content') || '';
    if (
      el.tagName === 'META' ||
      /\.(jpe?g|png|apng|webp|avif|gif|bmp|svg|tiff?|heic|heif|jxl|ico)(?:\?|$)/i.test(raw)
    )
      add(raw, 'gallery', el);
  }
  const walker = document.createTreeWalker(
    document.body || document.documentElement,
    NodeFilter.SHOW_ELEMENT,
  );
  let count = 0;
  let node = walker.nextNode();
  while (node && count++ < 20000) {
    const el = node as Element;
    if (!el.closest('[data-hashira-overlay]')) {
      const css = el.getAttribute('style') || '';
      const computed = document.defaultView?.getComputedStyle(el).backgroundImage || '';
      for (const match of (css + ' ' + computed).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))
        add(match[1]!, 'css', el);
      for (const match of css.matchAll(
        /["']([^"']+\.(?:png|jpe?g|webp|avif|gif)[^"']*)["']\s+\d+x/g,
      ))
        add(match[1]!, 'css', el);
    }
    node = walker.nextNode();
  }
  const visit = (data: unknown, depth = 0) => {
    if (depth > 10 || !data || typeof data !== 'object') return;
    if (Array.isArray(data)) {
      data.slice(0, 1000).forEach((x) => visit(x, depth + 1));
      return;
    }
    for (const [key, value] of Object.entries(data)) {
      if (['image', 'images', 'thumbnailUrl', 'contentUrl'].includes(key)) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (typeof v === 'string') add(v, 'json-ld');
          else if (v && typeof v === 'object' && 'url' in v && typeof v.url === 'string')
            add(v.url, 'json-ld');
        }
      } else visit(value, depth + 1);
    }
  };
  structured.forEach((v) => visit(v));
  return [...map.values()];
}
