import { describe, it, expect } from 'vitest';
import { detect } from '../../src/engines/detection';
import { extractTables } from '../../src/engines/detection/tables';
import { applyProfile, validateProfile, matchingProfiles } from '../../src/engines/learning';
import { selectionFor } from '../../src/engines/learning/selectors';
import { buildTree } from '../../src/engines/explorer';
import type { Profile } from '../../src/types';
const url = 'https://custom.test/catalog';
const profile: Profile = {
  id: 'p',
  name: 'Parts',
  origin: 'https://custom.test',
  patterns: ['https://custom.test/*'],
  pageType: 'list',
  record: { css: '.unit' },
  fields: { name: { css: 'h3' }, price: { css: '.price', transform: 'price' } },
  successes: 0,
  failures: 0,
  confidence: 0.5,
  updatedAt: 0,
  history: [],
};
const cards =
  '<main><div class="layout">' +
  [1, 2, 3]
    .map(
      (i) =>
        `<section class="unit"><a href="/p/${i}"><h3>قطعه ${i}</h3><img src="/${i}.png"/></a><b class="price">۸۵۰٬۰۰۰</b></section>`,
    )
    .join('') +
  '</div></main>';
describe('Generic multi-site engine', () => {
  it('finds unfamiliar repeated cards without a platform adapter', () => {
    document.body.innerHTML = cards;
    const d = detect(document, url);
    expect(d.adapter).toBe('Generic DOM');
    expect(d.records.length).toBe(3);
    expect(d.records[0]?.fields.price).toBe(850000);
    expect(d.images.length).toBe(3);
    expect(d.images.every((i) => i.recordIds.length)).toBe(true);
  });
  it('uses optional platform hints then falls back when stale', () => {
    document.body.innerHTML = '<div class="woocommerce">' + cards + '</div>';
    const d = detect(document, url);
    expect(d.adapter).toBe('WooCommerce');
    expect(d.records.length).toBe(3);
  });
  it('extracts and merges JSON-LD product metadata', () => {
    document.body.innerHTML =
      '<script type="application/ld+json">' +
      JSON.stringify({
        '@type': 'Product',
        name: 'لنت',
        sku: '۱۲۳',
        image: '/part.webp',
        offers: { price: '850000' },
      }) +
      '</script>';
    const d = detect(document, url);
    expect(d.records[0]?.fields.product_code).toBe('123');
    expect(d.images[0]?.url).toBe('https://custom.test/part.webp');
  });
  it('preserves uncertain images in preview', () => {
    document.body.innerHTML = '<img src="/mystery.avif">';
    expect(detect(document, url).images[0]?.role).toBe('unknown');
  });
  it('resolves nested tables and spanning headers independently', () => {
    document.body.innerHTML =
      '<table><tr><th rowspan="2">Code</th><th colspan="2">Stock</th></tr><tr><th>A</th><th>B</th></tr><tr><td rowspan="2">P1</td><td>1</td><td>2</td></tr><tr><td>3</td><td>4<table><tr><td>nested</td></tr></table></td></tr></table>';
    const [outer, inner] = extractTables(document, url);
    expect(outer?.headers).toEqual(['Code', 'Stock / A', 'Stock / B']);
    expect(outer?.rows).toEqual([
      ['P1', '1', '2'],
      ['P1', '3', '4'],
    ]);
    expect(inner?.rows).toEqual([['nested']]);
  });
  it('keeps discovery same-origin', () => {
    document.body.innerHTML = '<a href="/a">A</a><a href="https://evil.test/">External</a>';
    expect(detect(document, url).links.map((l) => l.url)).toEqual(['https://custom.test/a']);
  });
});
describe('Learning and visual corrections', () => {
  it('validates reusable rules and detects layout drift', () => {
    document.body.innerHTML = cards;
    expect(applyProfile(document, url, profile).valid).toBe(true);
    document.body.innerHTML = '<section>layout changed</section>';
    const d = detect(document, url, { profiles: [profile] });
    expect(d.profileValid).toBe(false);
    expect(d.warnings[0]).toContain('Generic');
  });
  it('falls back from CSS to semantic attribute and XPath', () => {
    document.body.innerHTML = '<main><b itemprop="name">Part</b></main>';
    const p = {
      ...profile,
      record: { css: 'main' },
      fields: { name: { css: '.stale', semantic: { attribute: 'itemprop', value: 'name' } } },
    };
    expect(applyProfile(document, url, p).records[0]?.fields.name).toBe('Part');
  });
  it('generates selectors from user selections', () => {
    document.body.innerHTML = cards;
    const selected = selectionFor(document.querySelector('.unit')!, url, 'record');
    expect(document.querySelectorAll(selected.repeated).length).toBe(3);
    expect(selected.xpath).toMatch(/^\/html/);
  });
  it('rejects imported cross-origin profile patterns', () => {
    expect(() => validateProfile({ ...profile, patterns: ['https://other.test/*'] })).toThrow();
    expect(matchingProfiles([profile], 'https://other.test/')).toEqual([]);
  });
  it('builds a bounded navigable tree', () => {
    const root = buildTree(
      [
        { url: url + '/a', parentUrl: url, text: 'A', depth: 1, kind: 'category' },
        { url: url + '/a/1', parentUrl: url + '/a', text: 'P1', depth: 2, kind: 'detail' },
      ],
      url,
    );
    expect(root.children[0]?.children[0]?.label).toBe('P1');
  });
});
