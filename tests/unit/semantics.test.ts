import { describe, it, expect } from 'vitest';
import { classifyValue, analyzeSemantics } from '../../src/engines/semantics';
import { semanticFiles } from '../../src/exports/semantic';
import { detect } from '../../src/engines/detection';
import type { PageSnapshot } from '../../src/types';
const url = 'https://example.test/catalog';
const fixture =
  '<nav aria-label="breadcrumb"><a href="/cars">خودرو</a><a href="/brakes">ترمز</a></nav><ul role="tree"><li role="treeitem" data-id="01" aria-expanded="false"><span>سیستم ترمز</span><ul role="group"><li role="treeitem" data-id="02"><span>لنت</span></li></ul></li></ul><main><section class="unit"><h3>لنت جلو</h3><b class="sku">00123</b><b class="price">۸۵۰٬۰۰۰ تومان</b><dl><dt>موجودی</dt><dd>۱۲</dd></dl><a class="gallery" href="/media/original?id=123"><img src="/thumb.jpg" alt="لنت"></a></section><section class="unit"><h3>لنت عقب</h3><b class="sku">AB-456</b><a href="/product/456"><img src="/second.jpg"></a></section></main>';
describe('Automatic semantic extraction', () => {
  it.each([
    ['00123', 'کد فنی', 'code', '00123'],
    ['۰۰۱۲۳', 'شناسه', 'code', '۰۰۱۲۳'],
    ['۸۵۰٬۰۰۰', 'قیمت', 'price', 850000],
    ['۱۲', 'موجودی', 'quantity', 12],
    ['2026', 'year', 'number', 2026],
    ['AB-123', '', 'code', 'AB-123'],
    ['کفش ورزشی', '', 'text', 'کفش ورزشی'],
    ['000123', '', 'code', '000123'],
  ])('classifies %s using %s', (raw, label, kind, value) => {
    const result = classifyValue(raw, label);
    expect(result.kind).toBe(kind);
    expect(result.value).toBe(value);
    expect(result.evidence).toBeTruthy();
  });
  it('preserves tree parent/child nodes and collapsed uncertainty', () => {
    document.body.innerHTML = fixture;
    const data = analyzeSemantics(document, url, [], []);
    const parent = data.categories.find((c) => c.code === '01')!,
      child = data.categories.find((c) => c.code === '02')!;
    expect(child.parentId).toBe(parent.id);
    expect(child.path).toEqual(['سیستم ترمز', 'لنت']);
    expect(parent.collapsed).toBe(true);
    expect(data.warnings.join(' ')).toContain('Unloaded');
  });
  it('uses breadcrumbs to keep a product and its typed values in the same category', () => {
    document.body.innerHTML = fixture;
    const data = detect(document, url);
    const category = data.semantic!.categories.find(
      (c) => c.source === 'breadcrumb' && c.label === 'ترمز',
    )!;
    expect(data.records.every((r) => r.categoryIds?.includes(category.id))).toBe(true);
    expect(
      data.semantic!.fields.some(
        (f) => f.kind === 'code' && f.raw === '00123' && f.categoryId === category.id,
      ),
    ).toBe(true);
  });
  it('recognizes extensionless zoom targets without confusing page links with verified images', () => {
    document.body.innerHTML = fixture;
    const data = detect(document, url);
    expect(data.semantic!.imageLinks.find((l) => l.targetUrl?.includes('/media/'))?.relation).toBe(
      'candidate-image',
    );
    expect(data.images.find((i) => i.url.includes('/media/'))?.sources).toContain('click-target');
    expect(data.images.some((i) => i.url.includes('/product/456'))).toBe(false);
  });
  it('exports type-separated category files and safe clickable offline indexes', () => {
    document.body.innerHTML = fixture;
    const data = detect(document, url);
    const page = {
      id: 'p',
      jobId: 'j',
      url,
      title: 'test',
      at: 0,
      fingerprint: 'x',
      metadata: {},
      structured: [],
      embedded: [],
      tables: data.tables,
      links: data.links,
      warnings: [],
      semantic: data.semantic,
    } satisfies PageSnapshot;
    const files = semanticFiles([page], data.records, [], new Map());
    expect(files.has('classification/tree.json')).toBe(true);
    expect(files.has('classification/codes.csv')).toBe(true);
    expect(files.has('classification/prices.csv')).toBe(true);
    expect(files.get('classification/codes.csv')).toContain('00123');
    const category = JSON.parse(files.get('categories/index.json')!) as {
      label: string;
      folder: string;
    }[];
    const folder = category.find((c) => c.label === 'ترمز')!.folder;
    expect(
      JSON.parse(files.get(folder + '/codes.json')!).some(
        (f: { raw: string }) => f.raw === '00123',
      ),
    ).toBe(true);
    expect(files.get(folder + '/index.html')).toContain('Click target');
    expect(files.get(folder + '/index.html')).not.toContain('<script');
  });
  it('records generic nested lists as a hierarchy with lower confidence', () => {
    document.body.innerHTML = '<ul><li>موتور<ul><li>پیستون</li></ul></li></ul>';
    const data = analyzeSemantics(document, url, [], []);
    const child = data.categories.find((c) => c.label === 'پیستون')!;
    expect(child.path).toEqual(['موتور', 'پیستون']);
    expect(child.source).toBe('list');
  });
});
