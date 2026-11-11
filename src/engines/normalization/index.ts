import { hashText } from '../../utils/core';
export const normalizeText = (value: string) =>
  value
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
export function latinDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (c) => String(c.charCodeAt(0) - (c >= '۰' ? 1776 : 1632)));
}
export function parsePrice(value: string): number | undefined {
  let text = latinDigits(value).replace(/٬/g, ',').replace(/٫/g, '.');
  const match = text.match(/-?\d[\d\s,.]*/);
  if (!match) return;
  text = match[0].trim().replace(/\s/g, '');
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(text)) text = text.replace(/[.,]/g, '');
  else if (text.includes(',') && text.includes('.')) {
    text =
      text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
  } else if (/,\d{1,2}$/.test(text)) text = text.replace(',', '.');
  else text = text.replace(/,/g, '');
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}
export const normalizeCode = (v: string) =>
  latinDigits(normalizeText(v)).replace(/\s+/g, '').toUpperCase();
export function normalizeFields(raw: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => {
      if (typeof value !== 'string') return [key, value];
      const text = normalizeText(value);
      return [
        key,
        /^(price|قیمت)$/i.test(key)
          ? (parsePrice(text) ?? text)
          : /^(product_code|sku|کد)$/i.test(key)
            ? normalizeCode(text)
            : text,
      ];
    }),
  );
}
export function recordId(
  source: string,
  group: string,
  raw: Record<string, unknown>,
  detail?: string,
) {
  return `r_${hashText(detail ? `${detail}|${raw.product_code || raw.sku || ''}|${raw.name || ''}` : `${source}|${group}|${JSON.stringify(raw)}`)}`;
}
export function completeness(fields: Record<string, unknown>): number {
  const list = Object.values(fields);
  return list.length
    ? Math.round(
        (100 *
          list.filter((v) => v !== '' && v != null && (!Array.isArray(v) || v.length)).length) /
          list.length,
      )
    : 0;
}
