import { describe, it, expect } from 'vitest';
import { normalizeText, parsePrice, normalizeCode } from '../../src/engines/normalization';
import {
  canonical,
  inScope,
  safeFilename,
  safeCell,
  validateConfig,
  sanitizeCapture,
  redact,
} from '../../src/security/policy';
import { robotsAllows, retryAfter } from '../../src/engines/crawler/policy';
import { sniffMime } from '../../src/engines/images/verify';
import { hashText } from '../../src/utils/core';
import { csv } from '../../src/exports/format';
import { srcsetCandidates } from '../../src/engines/images/discover';
describe('Normalization and export security', () => {
  it('preserves Persian while normalizing Arabic variants', () => {
    expect(normalizeText('  شركت يارا  ')).toBe('شرکت یارا');
    expect(normalizeCode('ab ۱۲٣')).toBe('AB123');
  });
  it.each([
    ['۸۵۰٬۰۰۰ تومان', 850000],
    ['€ 1.234,56', 1234.56],
    ['$1,234.56', 1234.56],
    ['۱۲٫۵', 12.5],
    ['1.000', 1000],
  ])('parses %s', (v, n) => expect(parsePrice(v)).toBe(n));
  it('guards formulas including whitespace', () => {
    expect(safeCell(' \t=HYPERLINK("bad")')).toMatch(/^'/);
    expect(csv([{ نام: 'لنت', price: '=1+1' }])).toContain("'=1+1");
    expect(csv([{ a: 1 }]).charCodeAt(0)).toBe(0xfeff);
  });
  it('normalizes Windows filenames', () => {
    expect(safeFilename('../../CON')).not.toContain('/');
    expect(safeFilename('CON.txt')).toBe('file_CON.txt');
  });
  it('redacts secrets recursively', () =>
    expect(redact({ token: 'x', nested: { password: 'y', sku: 1 } })).toEqual({
      nested: { sku: 1 },
    }));
  it('captures inert HTML without passwords or scripts', () => {
    document.body.innerHTML =
      '<input type="password" value="sensitive"><img onerror="alert(1)"><script>evil()</script>';
    const result = sanitizeCapture(document);
    expect(result).not.toContain('sensitive');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<script');
    expect(result).toContain("default-src 'none'");
  });
});
describe('Scope and scheduling policies', () => {
  it('canonicalizes only tracking data', () =>
    expect(canonical('/p?utm_source=x&b=2&a=1#x', 'https://s.test')).toBe(
      'https://s.test/p?a=1&b=2',
    ));
  it('never crosses an origin and follows explicit filters', () => {
    const c = validateConfig({ include: ['https://s.test/catalog/*'], exclude: ['*delete*'] });
    expect(inScope('https://s.test/catalog/1', 'https://s.test', c)).toBe(true);
    expect(inScope('https://other.test/catalog/1', 'https://s.test', c)).toBe(false);
    expect(inScope('https://s.test/catalog/delete', 'https://s.test', c)).toBe(false);
  });
  it('respects robot specificity and allow precedence', () => {
    const rules = 'User-agent: *\nDisallow: /private\nAllow: /private/public\n';
    expect(robotsAllows(rules, 'https://s.test/private/a')).toBe(false);
    expect(robotsAllows(rules, 'https://s.test/private/public/a')).toBe(true);
    expect(
      robotsAllows(
        'User-agent: HashiraScraper\nDisallow: /\nUser-agent: *\nAllow: /',
        'https://s.test/',
      ),
    ).toBe(false);
  });
  it('honors Retry-After and bounds settings', () => {
    expect(retryAfter('60')).toBe(60000);
    expect(validateConfig({ pageConcurrency: 900, delayMs: 0 }).pageConcurrency).toBe(3);
    expect(validateConfig({ delayMs: 0 }).delayMs).toBe(250);
  });
  it('rejects HTML as an image', () => {
    expect(sniffMime(new TextEncoder().encode('<html>login</html>'), 'image/png')).toBeUndefined();
    expect(sniffMime(new TextEncoder().encode('GIF89a...'))).toBe('image/gif');
  });
  it('orders only advertised resolution candidates', () =>
    expect(srcsetCandidates('/s.jpg 100w, /l.webp 1200w')[0]?.url).toBe('/l.webp'));
});

it('uses SHA-256 for durable text identifiers', () => {
  expect(hashText('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
