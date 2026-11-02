import { describe, it, expect } from 'vitest';
import { ExportManager } from '../../src/exports/exportManager';

describe('Export System', () => {
  const sampleRecords = [
    {
      product_name: 'لنت ترمز ۲۰۶',
      price: '850,000 تومان',
      product_code: 'HP-001',
      formula_test: '=cmd|/c calc',
    },
    {
      product_name: 'دیسک چرخ سمند',
      price: '1,450,000 تومان',
      product_code: 'HP-002',
      formula_test: '@sum(1,2)',
    },
  ];

  it('generates formatted JSON', () => {
    const json = ExportManager.toJson(sampleRecords);
    expect(json).toContain('لنت ترمز ۲۰۶');
    const parsed = JSON.parse(json);
    expect(parsed.length).toBe(2);
  });

  it('generates JSON Lines with one JSON object per line', () => {
    const jsonl = ExportManager.toJsonLines(sampleRecords);
    const lines = jsonl.split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).product_code).toBe('HP-001');
  });

  it('generates CSV with UTF-8 BOM and formula injection protection', () => {
    const csv = ExportManager.toCsv(sampleRecords);
    // Starts with UTF-8 BOM \uFEFF
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    // Dangerous characters escaped with single quote
    expect(csv).toContain("'=cmd|/c calc");
    expect(csv).toContain("'@sum(1,2)");
    expect(csv).toContain('لنت ترمز ۲۰۶');
  });

  it('generates valid XLSX Excel binary array buffer', () => {
    const xlsxBuffer = ExportManager.toXlsx(sampleRecords, 'Products');
    expect(xlsxBuffer).toBeDefined();
    expect(xlsxBuffer.byteLength).toBeGreaterThan(100);
  });
});
