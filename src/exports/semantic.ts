import { branchFolder } from '../engines/semantics/branch';
import type { PageSnapshot, ExtractedRecord, ResourceTask, TypedField } from '../types';
import { safeFilename } from '../security/policy';
import { hashText } from '../utils/core';
import { csv, flattenRecord } from './format';
const html = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const pathHref = (path: string) =>
  path
    .split('/')
    .map((s) => (s === '..' || s === '.' ? s : encodeURIComponent(s)))
    .join('/');
const sourceLabel = (url: string) => (/^data:image\//i.test(url) ? 'Embedded image' : url);
const link = (s: string | undefined, label: string) =>
  s && /^https?:\/\//i.test(s)
    ? `<a href="${html(s)}" target="_blank" rel="noopener noreferrer">${html(label)}</a>`
    : html(label);
function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'"><title>${html(title)}</title><style>body{font:15px system-ui;margin:32px;color:#183a2c;background:#f5f9f6}table{border-collapse:collapse;width:100%;background:white}th,td{text-align:start;border:1px solid #cbded1;padding:9px;overflow-wrap:anywhere}a{color:#176c45}code{white-space:pre-wrap}h1{font-size:25px}small{color:#52685b}</style></head><body>${body}</body></html>`;
}
export function semanticFiles(
  pages: PageSnapshot[],
  records: ExtractedRecord[],
  resources: ResourceTask[],
  imagePaths: Map<string, string>,
): Map<string, string> {
  const out = new Map<string, string>();
  const categories = [
    ...new Map(pages.flatMap((p) => p.semantic?.categories || []).map((c) => [c.id, c])).values(),
  ];
  const fields = [
    ...new Map(pages.flatMap((p) => p.semantic?.fields || []).map((f) => [f.id, f])).values(),
  ];
  const imageLinks = [
    ...new Map(pages.flatMap((p) => p.semantic?.imageLinks || []).map((l) => [l.id, l])).values(),
  ];
  const verifiedTargets = new Map(
    resources
      .filter((r) => r.hash && r.mime?.startsWith('image/') && imagePaths.has(r.hash))
      .map((r) => [r.url, { local_path: imagePaths.get(r.hash!), mime: r.mime }]),
  );
  const json = (path: string, data: unknown) => out.set(path, JSON.stringify(data, null, 2));
  const rows = (items: TypedField[]) =>
    items.map((f) => ({ ...f, value: f.kind === 'code' ? String(f.value) : f.value }));
  json('classification/fields.json', fields);
  json('classification/tree.json', categories);
  out.set(
    'classification/tree.txt',
    categories.map((c) => '  '.repeat(Math.max(0, c.path.length - 1)) + c.label).join('\n'),
  );
  json(
    'classification/videos.json',
    pages.flatMap((p) => p.videos || []),
  );
  json(
    'classification/image-links.json',
    imageLinks.map((l) => ({
      ...l,
      target_verification: verifiedTargets.has(l.targetUrl || '') ? 'verified-image' : 'unverified',
      ...verifiedTargets.get(l.targetUrl || ''),
    })),
  );
  out.set(
    'classification/image-links.csv',
    csv(imageLinks as unknown as Record<string, unknown>[]),
  );
  for (const [name, kinds] of [
    ['codes', ['code']],
    ['numbers', ['number']],
    ['prices', ['price']],
    ['quantities', ['quantity']],
    ['links', ['link']],
    ['texts', ['text']],
  ] as const) {
    const subset = fields.filter((f) => (kinds as readonly string[]).includes(f.kind));
    json(`classification/${name}.json`, subset);
    out.set(`classification/${name}.csv`, csv(rows(subset)));
  }
  const categoryIndex = [];
  for (const category of categories) {
    const folder = category.id.startsWith('manual_')
      ? 'categories/' + branchFolder(category.path)
      : 'categories/' +
        safeFilename((category.code ? category.code + '_' : '') + category.label).slice(0, 60) +
        '_' +
        hashText(category.id).slice(0, 10);
    const rootHref = '../'.repeat(folder.split('/').length);
    const own = fields.filter((f) => f.categoryId === category.id);
    const ownRecords = records.filter((r) => r.categoryIds?.includes(category.id));
    const recordIds = new Set(ownRecords.map((r) => r.id));
    const links = imageLinks.filter((l) => l.categoryId === category.id);
    const urls = new Set(
      links.flatMap((l) => [l.thumbnailUrl, l.targetUrl].filter((u): u is string => !!u)),
    );
    const assets = resources
      .filter((r) => r.recordIds.some((id) => recordIds.has(id)) || urls.has(r.url))
      .map((r) => ({ ...r, local_path: r.hash ? imagePaths.get(r.hash) : undefined }));
    json(folder + '/category.json', category);
    json(folder + '/records.json', ownRecords);
    out.set(folder + '/records.csv', csv(ownRecords.map(flattenRecord)));
    for (const [name, kinds] of [
      ['codes', ['code']],
      ['numbers', ['number']],
      ['prices', ['price']],
      ['quantities', ['quantity']],
      ['links', ['link']],
      ['texts', ['text']],
    ] as const) {
      const subset = own.filter((f) => (kinds as readonly string[]).includes(f.kind));
      json(folder + '/' + name + '.json', subset);
      out.set(folder + '/' + name + '.csv', csv(rows(subset)));
    }
    json(folder + '/images.json', assets);
    json(
      folder + '/clickable-image-links.json',
      links.map((l) => ({
        ...l,
        target_verification: verifiedTargets.has(l.targetUrl || '')
          ? 'verified-image'
          : 'unverified',
        ...verifiedTargets.get(l.targetUrl || ''),
      })),
    );
    const assetRows = assets
      .map(
        (a) =>
          `<tr><td>${html(sourceLabel(a.url))}</td><td>${html(a.state)}</td><td>${a.local_path ? `<a href="${rootHref}${html(pathHref(a.local_path))}">Open downloaded file</a>` : 'No verified stored file'}</td></tr>`,
      )
      .join('');
    const linkRows = links
      .map(
        (l) =>
          `<tr><td>${link(l.thumbnailUrl, 'Thumbnail source')}</td><td>${link(l.targetUrl, 'Click target')}${verifiedTargets.has(l.targetUrl || '') ? ` · <a href="${rootHref}${html(pathHref(verifiedTargets.get(l.targetUrl || '')!.local_path!))}">Open verified image file</a>` : ''}</td><td>${html(l.relation)}</td><td>${html(l.evidence)}</td></tr>`,
      )
      .join('');
    out.set(
      folder + '/index.html',
      page(
        category.label,
        `<h1 dir="auto">${html(category.label)}</h1><p dir="auto">${html(category.path.join(' / '))}</p><p>${ownRecords.length} records · ${own.filter((f) => f.kind === 'code').length} codes · ${own.filter((f) => ['number', 'price', 'quantity'].includes(f.kind)).length} numeric fields</p><p><a href="codes.csv">Codes CSV</a> · <a href="numbers.csv">Numbers CSV</a> · <a href="texts.csv">Texts CSV</a> · <a href="records.json">Records JSON</a></p><h2>Stored image/document files</h2><table><tr><th>Source</th><th>Status</th><th>Local file</th></tr>${assetRows}</table><h2>Clickable image relationships</h2><table><tr><th>Thumbnail</th><th>Target</th><th>Type</th><th>Evidence</th></tr>${linkRows}</table>`,
      ),
    );
    categoryIndex.push({
      ...category,
      folder,
      fieldCount: own.length,
      recordCount: ownRecords.length,
    });
  }
  json('categories/index.json', categoryIndex);
  out.set(
    'index.html',
    page(
      'Hashira classified export',
      `<h1>Hashira · classified dataset</h1><p>Automatic deterministic classification. Review confidence and evidence in classification/fields.json. Identifier strings retain leading zeroes. Files shared by categories are stored once and linked from each category.</p><ul>${categoryIndex.map((c) => `<li><a href="${html(pathHref(c.folder))}/index.html" dir="auto">${html(c.path.join(' / '))}</a> — ${c.fieldCount} fields, ${c.recordCount} records</li>`).join('')}</ul>`,
    ),
  );
  return out;
}
