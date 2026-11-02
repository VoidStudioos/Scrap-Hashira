import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LearningEngine } from '../../src/engines/learning/learningEngine';
import type { SiteProfile } from '../../src/types';

describe('Smart Learning Engine & Selector Resilience', () => {
  let doc: Document;

  beforeAll(() => {
    const fixturePath = path.resolve(__dirname, '../fixtures/sample-catalog.html');
    const html = fs.readFileSync(fixturePath, 'utf-8');
    const parser = new DOMParser();
    doc = parser.parseFromString(html, 'text/html');
  });

  it('generates a resilient CSS selector and XPath fallback for elements', () => {
    const titleEl = doc.querySelector('.product-title')!;
    const res = LearningEngine.createResilientSelector(titleEl, doc);
    expect(res.cssSelector).toBeDefined();
    expect(res.xpathFallback).toBeDefined();
  });

  it('automatically generalizes numbered IDs to select all repeated items', () => {
    // Simulate elements with IDs like imgEgrp1, imgEgrp2, imgEgrp3
    const container = doc.createElement('div');
    container.innerHTML = `
      <img id="imgEgrp1" class="item" src="1.jpg" />
      <img id="imgEgrp2" class="item" src="2.jpg" />
      <img id="imgEgrp3" class="item" src="3.jpg" />
    `;
    doc.body.appendChild(container);

    const target = container.querySelector('#imgEgrp2')!;
    const res = LearningEngine.createResilientSelector(target, doc);

    expect(res.exactSelector).toBe('#imgEgrp2');
    expect(res.repeatedSelector).toContain('imgEgrp');
    expect(res.repeatedMatchCount).toBe(3);
    expect(res.cssSelector).toBe(res.repeatedSelector);
  });

  it('selects table columns automatically across multiple rows', () => {
    const tableContainer = doc.createElement('div');
    tableContainer.innerHTML = `
      <table id="test-table">
        <tbody>
          <tr><td>A1</td><td>B1</td></tr>
          <tr><td>A2</td><td>B2</td></tr>
          <tr><td>A3</td><td>B3</td></tr>
        </tbody>
      </table>
    `;
    doc.body.appendChild(tableContainer);

    const targetCell = tableContainer.querySelectorAll('td')[1]; // B1 (col 2)
    const repeated = LearningEngine.deriveRepeatedSelector(targetCell, doc);
    expect(repeated.selector).toContain('#test-table');
    expect(repeated.count).toBe(3);
  });

  it('extracts field values reliably using CSS first and attribute types', () => {
    const cardEl = doc.querySelector('.product-card')!;
    const val = LearningEngine.extractFieldValue(cardEl, {
      field: 'title',
      cssSelector: '.product-title',
      attribute: 'text',
      confidence: 0.9,
    });
    expect(val).toContain('لنت ترمز');
  });

  it('generates structural DOM fingerprints to detect site changes', () => {
    const fingerprint1 = LearningEngine.generateDomFingerprint(doc);
    expect(fingerprint1).toBeDefined();
    expect(typeof fingerprint1).toBe('string');
  });

  it('exports and imports site profiles safely without data corruption', async () => {
    const sampleProfiles: SiteProfile[] = [
      {
        domain: 'example.com',
        name: 'Example Store',
        pageType: 'catalog',
        urlPattern: 'https://example.com/catalog.*',
        recordSelector: '.product-card',
        fieldSelectors: [
          { field: 'name', cssSelector: '.product-title', confidence: 0.95 },
          { field: 'price', cssSelector: '.product-price', confidence: 0.9 },
        ],
        confidenceScore: 0.95,
        successCount: 1,
        failureCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const json = LearningEngine.exportProfilesAsJson(sampleProfiles);
    expect(json).toContain('example.com');
    expect(json).toContain('.product-card');

    const res = await LearningEngine.importProfilesFromJson(json);
    expect(res.importedCount).toBe(1);
    expect(res.errors.length).toBe(0);
  });
});
