import { describe, it, expect } from 'vitest';
import { DataNormalizer } from '../../src/engines/normalization/dataNormalizer';

describe('DataNormalizer Engine', () => {
  it('normalizes Persian and Arabic numbers to ASCII digits', () => {
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    expect(DataNormalizer.normalizeText(persianDigits)).toBe('0123456789');
    expect(DataNormalizer.normalizeText(arabicDigits)).toBe('0123456789');
  });

  it('normalizes Arabic Kaf and Yeh to Persian characters', () => {
    // Arabic Kaf (\u0643) -> Persian Kaf (\u06a9)
    // Arabic Yeh (\u064a) -> Persian Yeh (\u06cc)
    const arabicText = 'كتاب ياقوت';
    const normalized = DataNormalizer.normalizeText(arabicText);
    expect(normalized).toBe('کتاب یاقوت');
  });

  it('decodes HTML entities correctly', () => {
    const raw = 'پکیج چیپ H&amp;G &nbsp; &quot;تست&quot; &diams; &#1606;';
    const decoded = DataNormalizer.decodeHtmlEntities(raw);
    expect(decoded).toContain('H&G');
    expect(decoded).toContain('"تست"');
    expect(decoded).toContain('♦');
    expect(decoded).toContain('ن');
    expect(decoded).not.toContain('&amp;');
  });

  it('prevents word fusing from unclosed HTML tags and adjacent blocks', () => {
    const unclosedHtml = `
      <h3>عنوان محصول</h3>
      <p>پاراگراف اول
      <p>پاراگراف دوم
      <script>var x = 123;</script>
    `;
    const clean = DataNormalizer.cleanHtmlToText(unclosedHtml);
    expect(clean).not.toContain('var x');
    expect(clean).toContain('عنوان محصول');
    expect(clean).toContain('پاراگراف اول');
    expect(clean).toContain('پاراگراف دوم');
    // Ensure words did NOT get glued together into 'محصولپاراگراف'
    expect(clean).not.toContain('محصولپاراگراف');
    expect(clean).not.toContain('اولپاراگراف');
  });

  it('preserves multi-line structure when preserveLines is enabled', () => {
    const multiline = "خط اول\nخط دوم\n• قابلیت جدید";
    const result = DataNormalizer.normalizeText(multiline, { preserveLines: true });
    expect(result.split('\n').length).toBe(3);
    expect(result).toContain('خط اول');
    expect(result).toContain('خط دوم');
  });

  it('parses Persian prices in Toman correctly', () => {
    const priceStr = '۸۵۰,۰۰۰ تومان';
    const parsed = DataNormalizer.parsePrice(priceStr);
    expect(parsed.amount).toBe(850000);
    expect(parsed.currency).toBe('TOMAN');
  });

  it('parses International currency formats correctly', () => {
    const usdPrice = '$ 1,299.99 USD';
    const parsedUsd = DataNormalizer.parsePrice(usdPrice);
    expect(parsedUsd.amount).toBe(1299.99);
    expect(parsedUsd.currency).toBe('USD');

    const eurPrice = '45.50 €';
    const parsedEur = DataNormalizer.parsePrice(eurPrice);
    expect(parsedEur.amount).toBe(45.5);
    expect(parsedEur.currency).toBe('EUR');
  });

  it('normalizes product SKUs and codes', () => {
    const messyCode = ' hp-brk-001 / a ';
    expect(DataNormalizer.normalizeProductCode(messyCode)).toBe('HP-BRK-001/A');
  });

  it('calculates record completeness score accurately', () => {
    const completeRecord = {
      title: 'Brake Pad',
      price: 850000,
      product_code: 'BP-100',
      description: 'High performance ceramic pad',
      category: 'Brakes',
    };
    const score = DataNormalizer.calculateCompletenessScore(completeRecord);
    expect(score).toBeGreaterThanOrEqual(80);

    const emptyRecord = { notes: 'just a note' };
    expect(DataNormalizer.calculateCompletenessScore(emptyRecord)).toBe(0);
  });

  it('generates consistent deduplication fingerprints', () => {
    const recordA = { title: 'لنت ترمز پژو ۲۰۶', sku: 'HP-206' };
    const recordB = { title: 'لنت ترمز پژو 206', sku: 'hp-206' };
    const fpA = DataNormalizer.generateFingerprint(recordA);
    const fpB = DataNormalizer.generateFingerprint(recordB);
    expect(fpA).toBe(fpB);
  });
});
