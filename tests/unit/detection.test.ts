import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoDetector } from '../../src/engines/detection/autoDetector';

describe('AutoDetector Multi-stage Engine', () => {
  let doc: Document;

  beforeAll(() => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sample-catalog.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');
    const parser = new DOMParser();
    doc = parser.parseFromString(html, 'text/html');
  });

  it('detects JSON-LD Schema.org product data', () => {
    const jsonLd = AutoDetector.detectJsonLd(doc);
    expect(jsonLd.length).toBeGreaterThan(0);
    expect(jsonLd[0].name).toContain('لنت ترمز');
    expect(jsonLd[0].sku).toBe('HP-BRK-206');
  });

  it('detects repeated product cards and generates candidate schema', () => {
    const detection = AutoDetector.detect(doc, 'https://example.com/catalog');
    expect(detection.schemas.length).toBeGreaterThan(0);

    const topSchema = detection.schemas[0];
    expect(topSchema.sampleCount).toBeGreaterThanOrEqual(1);
    expect(topSchema.confidence).toBeGreaterThan(0.7);
  });

  it('detects and parses HTML tables with headers and row data', () => {
    const tables = AutoDetector.detectTables(doc, 'https://example.com/catalog');
    expect(tables.length).toBe(1);

    const table = tables[0];
    expect(table.headers).toContain('کد محصول');
    expect(table.headers).toContain('نام قطعه');
    expect(table.rows.length).toBe(3);
    expect(table.rows[0][0]).toBe('HP-BRK-001');
  });

  it('detects ARIA role="grid" tables when no standard <table> is present', () => {
    const gridHtml = `
      <div role="grid" aria-label="Product Pricing Matrix">
        <div role="row">
          <div role="columnheader">Plan</div>
          <div role="columnheader">Price</div>
        </div>
        <div role="row">
          <div role="gridcell">Starter</div>
          <div role="gridcell">Free</div>
        </div>
        <div role="row">
          <div role="gridcell">Pro</div>
          <div role="gridcell">99000</div>
        </div>
      </div>
    `;
    const gridDoc = new DOMParser().parseFromString(gridHtml, 'text/html');
    const tables = AutoDetector.detectTables(gridDoc, 'https://example.com/pricing');
    expect(tables.length).toBe(1);
    expect(tables[0].title).toBe('Product Pricing Matrix');
    expect(tables[0].headers).toEqual(['Plan', 'Price']);
    expect(tables[0].rows.length).toBe(2);
    expect(tables[0].rows[0]).toEqual(['Starter', 'Free']);
  });

  it('detects pagination next-button accurately', () => {
    const pagination = AutoDetector.detectPagination(doc);
    expect(pagination).toBeDefined();
    expect(pagination?.type).toBe('next_button');
  });
});
