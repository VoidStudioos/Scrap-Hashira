import { safeCell } from '../security/policy';
export function csv(rows: Record<string, unknown>[]): string {
  const headers = [...new Set(rows.flatMap(Object.keys))];
  const encode = (value: unknown) => `"${safeCell(value).replace(/"/g, '""')}"`;
  return (
    '\uFEFF' +
    [
      headers.map(encode).join(','),
      ...rows.map((row) => headers.map((h) => encode(row[h])).join(',')),
    ].join('\r\n')
  );
}
export const flattenRecord = (record: {
  id: string;
  fields: Record<string, unknown>;
  sourceUrl: string;
  imageUrls: string[];
  confidence: number;
  completeness: number;
}) => ({
  id: record.id,
  ...record.fields,
  source_url: record.sourceUrl,
  image_urls: record.imageUrls,
  confidence: record.confidence,
  completeness: record.completeness,
});
