import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ImageDiscovery } from '../../src/engines/images/imageDiscovery';
import { computeSha256 } from '../../src/utils/hash';

describe('Advanced Image Discovery Engine', () => {
  let doc: Document;

  beforeAll(() => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sample-catalog.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');
    const parser = new DOMParser();
    doc = parser.parseFromString(html, 'text/html');
  });

  it('discovers highest available resolution candidate from srcset and data-attributes', () => {
    const images = ImageDiscovery.discoverImages(doc, 'test_job', 'https://example.com/catalog');
    expect(images.length).toBeGreaterThan(0);

    // First product card has srcset with 1920w candidate
    const pad001 = images.find((img) => img.sourceUrl.includes('pad-001'));
    expect(pad001).toBeDefined();
    expect(pad001?.sourceUrl).toContain('1920.webp');
  });

  it('correctly classifies product images with high confidence', () => {
    const images = ImageDiscovery.discoverImages(doc, 'test_job', 'https://example.com/catalog');
    const productImages = images.filter((img) => img.classification === 'product');
    expect(productImages.length).toBeGreaterThanOrEqual(1);
  });

  it('computes deterministic SHA-256 binary hash for image deduplication', async () => {
    const testData = new TextEncoder().encode('HashiraScraperSampleImageBinaryData');
    const hash1 = await computeSha256(testData);
    const hash2 = await computeSha256(testData);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });
});
