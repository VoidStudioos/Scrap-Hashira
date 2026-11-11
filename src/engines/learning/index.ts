import type { ExtractedRecord, Profile } from '../../types';
import { globMatch, webUrl } from '../../security/policy';
import { resolveRule, structuralFingerprint } from './selectors';
import {
  completeness,
  normalizeFields,
  parsePrice,
  normalizeCode,
  recordId,
} from '../normalization';
export function matchingProfiles(profiles: Profile[], url: string) {
  const u = new URL(url);
  return profiles
    .filter(
      (p) =>
        p &&
        p.origin === u.origin &&
        Array.isArray(p.patterns) &&
        p.patterns.some((pattern) => typeof pattern === 'string' && globMatch(url, pattern)),
    )
    .sort((a, b) => b.confidence - a.confidence || b.updatedAt - a.updatedAt);
}
export function applyProfile(document: Document, url: string, profile: Profile) {
  const roots = resolveRule(document, profile.record);
  let successful = 0;
  let structural = 0;
  const records: ExtractedRecord[] = roots.slice(0, 10000).map((root) => {
    const raw: Record<string, unknown> = {};
    let found = 0;
    for (const [key, rule] of Object.entries(profile.fields)) {
      const el = rule.css === ':scope' ? root : resolveRule(root, rule)[0];
      let value = el
        ? (rule.attribute ? el.getAttribute(rule.attribute) || '' : el.textContent || '').trim()
        : '';
      if (value) found++;
      if (rule.transform === 'url') value = webUrl(value, url) || '';
      raw[key] = value;
    }
    if (found >= Math.max(1, Object.keys(profile.fields).length * 0.5)) successful++;
    if (!profile.record.fingerprint || structuralFingerprint(root) === profile.record.fingerprint)
      structural++;
    const fields = normalizeFields(raw);
    for (const [key, rule] of Object.entries(profile.fields)) {
      if (rule.transform === 'price') fields[key] = parsePrice(String(raw[key])) ?? raw[key];
      if (rule.transform === 'code') fields[key] = normalizeCode(String(raw[key]));
    }
    const images = [...root.querySelectorAll<HTMLImageElement>('img')].flatMap((i) => {
      const u = webUrl(
        i.currentSrc || i.getAttribute('src') || i.getAttribute('data-src') || '',
        url,
      );
      return u ? [u] : [];
    });
    const detailElement = profile.detail
      ? resolveRule(root, profile.detail)[0]
      : root.querySelector('a[href]');
    const detailValue =
      fields.source_url ||
      fields.url ||
      detailElement?.getAttribute(profile.detail?.attribute || 'href');
    const detail = detailValue ? webUrl(String(detailValue), url) : undefined;
    return {
      id: recordId(url, profile.id, raw, detail),
      group: profile.name,
      raw,
      fields,
      sourceUrl: url,
      imageUrls: images,
      detailUrl: detail,
      confidence: 0.9,
      completeness: completeness(fields),
    };
  });
  const coverage = roots.length ? successful / roots.length : 0;
  const structure = roots.length ? structural / roots.length : 0;
  const valid = coverage >= 0.6 && structure >= 0.5 && records.length > 0;
  return {
    records,
    valid,
    confidence: coverage * 0.7 + structure * 0.3,
    reason: !roots.length
      ? 'Record selector no longer matches'
      : !valid
        ? 'Field coverage or structure changed'
        : 'Validated',
  };
}
export function validateProfile(input: unknown): Profile {
  if (!input || typeof input !== 'object') throw new Error('Invalid profile');
  const p = input as Profile;
  if (
    typeof p.id !== 'string' ||
    typeof p.name !== 'string' ||
    !webUrl(p.origin) ||
    new URL(p.origin).origin !== p.origin ||
    !Array.isArray(p.patterns) ||
    !p.patterns.every((v) => typeof v === 'string' && v.startsWith(p.origin + '/')) ||
    !p.record ||
    typeof p.record.css !== 'string' ||
    !p.fields ||
    typeof p.fields !== 'object' ||
    Array.isArray(p.fields) ||
    !p.patterns.length ||
    p.patterns.length > 50 ||
    !Object.keys(p.fields).length ||
    Object.keys(p.fields).length > 100
  )
    throw new Error('Profile must have an exact origin, bounded URL patterns and selectors');
  for (const rule of [
    p.record,
    ...Object.values(p.fields),
    p.pagination,
    p.detail,
    p.gallery,
  ].filter((rule) => rule !== undefined)) {
    if (
      !rule ||
      typeof rule !== 'object' ||
      Array.isArray(rule) ||
      typeof rule.css !== 'string' ||
      rule.css.length > 2000 ||
      (rule.xpath !== undefined && (typeof rule.xpath !== 'string' || rule.xpath.length > 2000)) ||
      (rule.attribute !== undefined && typeof rule.attribute !== 'string') ||
      (rule.semantic !== undefined &&
        (!rule.semantic ||
          typeof rule.semantic.attribute !== 'string' ||
          typeof rule.semantic.value !== 'string')) ||
      (rule.transform !== undefined && !['text', 'price', 'code', 'url'].includes(rule.transform))
    )
      throw new Error('Invalid selector rule');
  }
  return {
    ...p,
    successes: Number(p.successes) || 0,
    failures: Number(p.failures) || 0,
    confidence: Math.max(0, Math.min(1, Number(p.confidence) || 0)),
    updatedAt: Date.now(),
    history: Array.isArray(p.history) ? p.history.slice(-50) : [],
  };
}
