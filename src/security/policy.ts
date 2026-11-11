import { DEFAULT_CONFIG, type CrawlConfig } from '../types';
import { clamp } from '../utils/core';
export function webUrl(value: string, base?: string): string | undefined {
  try {
    const u = new URL(value, base);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return;
    u.hash = '';
    return u.href;
  } catch {
    return;
  }
}
export function canonical(value: string, base?: string) {
  const url = webUrl(value, base);
  if (!url) return;
  const u = new URL(url);
  for (const key of [...u.searchParams.keys()])
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  return u.href;
}
export const originPattern = (origin: string) => `${new URL(origin).origin}/*`;
export function globMatch(value: string, pattern: string): boolean {
  if (pattern.length > 500) return false;
  let i = 0,
    j = 0,
    star = -1,
    mark = 0;
  while (i < value.length) {
    if (pattern[j] === value[i]) {
      i++;
      j++;
    } else if (pattern[j] === '*') {
      star = j++;
      mark = i;
    } else if (star >= 0) {
      j = star + 1;
      i = ++mark;
    } else return false;
  }
  while (pattern[j] === '*') j++;
  return j === pattern.length;
}
export function inScope(
  value: string,
  origin: string,
  config: Pick<CrawlConfig, 'include' | 'exclude' | 'branches'>,
): boolean {
  const u = webUrl(value);
  if (!u || new URL(u).origin !== origin) return false;
  if (
    /(?:^|\/)(?:logout|log-out|signout|delete|remove|checkout)(?:\/|$)/i.test(
      new URL(u).pathname,
    ) ||
    /[?&](?:action|do)=(?:delete|remove|logout)/i.test(u)
  )
    return false;
  if (
    /\.(?:zip|exe|dmg|pdf|docx?|xlsx?|jpe?g|png|webp|gif|svg|avif|mp[34])$/i.test(
      new URL(u).pathname,
    )
  )
    return false;
  if (config.exclude.some((p) => globMatch(u, p))) return false;
  if (config.include.length && !config.include.some((p) => globMatch(u, p))) return false;
  if (
    config.branches.length &&
    !config.branches.some((p) => {
      const branch = webUrl(p);
      if (!branch) return false;
      const selected = new URL(branch),
        target = new URL(u);
      if (selected.origin !== target.origin) return false;
      const path = selected.pathname.endsWith('/') ? selected.pathname : selected.pathname + '/';
      if (target.pathname !== selected.pathname && !target.pathname.startsWith(path)) return false;
      return [...selected.searchParams].every(([key, value]) =>
        target.searchParams.getAll(key).includes(value),
      );
    })
  )
    return false;
  return true;
}
export function safeFilename(value: string): string {
  const clean = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 90);
  return !clean || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(clean)
    ? `file_${clean || 'untitled'}`
    : clean;
}
export function safeCell(value: unknown): string {
  const s = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /^[\s\u0000-\u001f]*[=+@-]/u.test(s) ? `'${s}` : s;
}
export function sanitizeCapture(document: Document): string {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      'script,iframe,object,embed,base,link[rel="preload"],meta[http-equiv],input,textarea,select',
    )
    .forEach((n) => n.remove());
  clone.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes])
      if (
        /^on/i.test(attr.name) ||
        /^(value|nonce|integrity|srcdoc|action|formaction)$/i.test(attr.name) ||
        /javascript:/i.test(attr.value)
      )
        el.removeAttribute(attr.name);
  });
  const head = clone.querySelector('head');
  const csp = document.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content =
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'";
  head?.prepend(csp);
  return '<!doctype html>\n' + clone.outerHTML;
}
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 10) return '[depth limit]';
  if (Array.isArray(value)) return value.slice(0, 2000).map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k]) => !/password|passwd|cookie|token|secret|authorization|csrf|sessionid/i.test(k),
        )
        .map(([k, v]) => [k, redact(v, depth + 1)]),
    );
  return value;
}
export function validateConfig(input: Partial<CrawlConfig>): CrawlConfig {
  const c = { ...DEFAULT_CONFIG, ...input };
  for (const key of [
    'include',
    'exclude',
    'branches',
    'approvedResourceOrigins',
    'apiPaths',
  ] as const) {
    if (!Array.isArray(c[key]) || !c[key].every((v) => typeof v === 'string'))
      throw new Error('Invalid configuration array: ' + key);
  }
  for (const key of ['selectedImageUrls', 'profileIds', 'candidateIds'] as const) {
    if (
      c[key] !== undefined &&
      (!Array.isArray(c[key]) || !c[key]!.every((v) => typeof v === 'string'))
    )
      throw new Error('Invalid configuration selection: ' + key);
  }
  for (const key of ['downloadImages', 'downloadDocuments', 'fullCapture'] as const)
    if (typeof c[key] !== 'boolean') throw new Error('Invalid configuration flag: ' + key);
  if (c.exploreOnly !== undefined && typeof c.exploreOnly !== 'boolean')
    throw new Error('Invalid exploration flag');
  if (!['SAFE', 'BALANCED', 'FAST', 'CUSTOM'].includes(c.performance))
    throw new Error('Invalid performance profile');
  if (
    c.traverse !== undefined &&
    !['all', 'details', 'pagination', 'categories'].includes(c.traverse)
  )
    throw new Error('Invalid traversal mode');
  return {
    ...c,
    maxPages: Math.floor(clamp(c.maxPages, 1, 10000)),
    maxDepth: Math.floor(clamp(c.maxDepth, 0, 15)),
    maxImages: Math.floor(clamp(c.maxImages, 0, 50000)),
    pageConcurrency: Math.floor(clamp(c.pageConcurrency, 1, 3)),
    downloadConcurrency: Math.floor(clamp(c.downloadConcurrency, 1, 8)),
    delayMs: clamp(c.delayMs, 250, 60000),
    timeoutMs: clamp(c.timeoutMs, 3000, 25000),
    retries: Math.floor(clamp(c.retries, 0, 5)),
    memoryMB: clamp(c.memoryMB, 64, 1024),
    maxResourceMB: clamp(c.maxResourceMB, 1, 100),
    scrollSteps: Math.floor(clamp(c.scrollSteps, 0, 30)),
    loadMoreClicks: Math.floor(clamp(c.loadMoreClicks, 0, 20)),
    include: c.include.slice(0, 50),
    exclude: c.exclude.slice(0, 50),
    branches: c.branches.filter((v) => !!webUrl(v)).slice(0, 100),
    approvedResourceOrigins: c.approvedResourceOrigins
      .filter((v) => {
        try {
          return new URL(v).origin === v;
        } catch {
          return false;
        }
      })
      .slice(0, 30),
    apiPaths: c.apiPaths.filter((v) => v.startsWith('/') && !v.startsWith('//')).slice(0, 10),
  };
}
