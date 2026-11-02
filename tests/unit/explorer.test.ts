import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SiteExplorer } from '../../src/engines/explorer/siteExplorer';

describe('Smart Site Explorer Engine', () => {
  let doc: Document;

  beforeAll(() => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sample-catalog.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');
    const parser = new DOMParser();
    doc = parser.parseFromString(html, 'text/html');
  });

  it('classifies discovered links into Categories, Listings, Details, and Documents', () => {
    const tree = SiteExplorer.explorePage(doc, 'https://example.com/catalog', { stayOnDomain: true });

    expect(tree.children).toBeDefined();
    expect(tree.children!.length).toBeGreaterThan(0);

    // Verify categories group exists
    const categoryGroup = tree.children?.find((c) => c.label.includes('Categories'));
    expect(categoryGroup).toBeDefined();

    // Verify document links group exists (catalog-2026.pdf)
    const docGroup = tree.children?.find((c) => c.label.includes('Documents'));
    expect(docGroup).toBeDefined();
    expect(docGroup?.children?.some((d) => d.url.includes('.pdf'))).toBe(true);

    // Verify product detail links group exists
    const detailGroup = tree.children?.find((c) => c.label.includes('Detail'));
    expect(detailGroup).toBeDefined();
    expect(detailGroup?.children?.some((d) => d.url.includes('/product/'))).toBe(true);
  });

  it('filters selected URLs cleanly for crawling', () => {
    const tree = SiteExplorer.explorePage(doc, 'https://example.com/catalog', { stayOnDomain: true });
    const selectedUrls = SiteExplorer.getSelectedUrls(tree);
    expect(selectedUrls.length).toBeGreaterThan(0);
    // Should not include PDF document in standard catalog scrape
    expect(selectedUrls.some((u) => u.endsWith('.pdf'))).toBe(false);
  });
});
