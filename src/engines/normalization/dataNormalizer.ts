// Data Normalization Engine with Persian/Arabic support, price parsing, and deduplication

export interface NormalizedResult {
  raw: Record<string, any>;
  normalized: Record<string, any>;
  completenessScore: number;
  fingerprint: string;
}

export class DataNormalizer {
  // Persian / Arabic to English digit mapping
  private static readonly DIGIT_MAP: Record<string, string> = {
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };

  /**
   * Normalizes Persian and Arabic text:
   * - Arabic Kaf (ك) -> Persian Kaf (ک)
   * - Arabic Yeh (ي, ى) -> Persian Yeh (ی)
   * - Persian/Arabic numbers to ASCII numbers
   * - Collapses whitespaces and removes redundant zero-width characters
   */
  static normalizeText(text: string): string {
    if (!text) return '';

    let res = text
      // Replace Arabic kaf
      .replace(/\u0643/g, '\u06a9')
      // Replace Arabic yeh
      .replace(/[\u0649\u064a]/g, '\u06cc')
      // Normalize Persian numbers and Arabic numbers to Latin digits
      .replace(/[۰-۹٠-٩]/g, (char) => this.DIGIT_MAP[char] || char)
      // Normalize whitespaces: tabs, non-breaking spaces, newlines to single space
      .replace(/[\s\u00a0\u200b]+/g, ' ')
      .trim();

    return res;
  }

  /**
   * Parses price strings into clean numbers and currency code:
   * Supports: "850,000 تومان", "1,200,000 ریال", "$199.99", "€ 45", "1500 USD"
   */
  static parsePrice(priceStr: string): { amount: number | null; currency: string; raw: string } {
    if (!priceStr) return { amount: null, currency: 'UNKNOWN', raw: '' };

    const normalizedStr = this.normalizeText(priceStr);

    let currency = 'UNKNOWN';
    if (/تومان|toman/i.test(normalizedStr)) currency = 'TOMAN';
    else if (/ریال|rial/i.test(normalizedStr)) currency = 'IRR';
    else if (/\$|usd|dollar/i.test(normalizedStr)) currency = 'USD';
    else if (/€|eur|euro/i.test(normalizedStr)) currency = 'EUR';
    else if (/£|gbp|pound/i.test(normalizedStr)) currency = 'GBP';

    // Extract numbers, removing commas and periods used as thousands separators
    // Handle formats like "1,250,000" or "45.99"
    const cleaned = normalizedStr.replace(/,/g, '');
    const numMatch = cleaned.match(/(\d+(?:\.\d+)?)/);

    const amount = numMatch ? parseFloat(numMatch[1]) : null;

    return {
      amount,
      currency,
      raw: priceStr.trim(),
    };
  }

  /**
   * Normalizes product codes/SKUs.
   */
  static normalizeProductCode(code: string): string {
    if (!code) return '';
    const norm = this.normalizeText(code);
    return norm.replace(/[^a-zA-Z0-9\-_]/g, '').toUpperCase();
  }

  /**
   * Calculates record completeness score from 0 to 100 based on standard e-commerce fields.
   */
  static calculateCompletenessScore(data: Record<string, any>): number {
    let score = 0;
    const checks: { keys: string[]; weight: number }[] = [
      { keys: ['title', 'name', 'product_name'], weight: 35 },
      { keys: ['price', 'cost', 'amount', 'قیمت'], weight: 25 },
      { keys: ['product_code', 'sku', 'code', 'کد'], weight: 15 },
      { keys: ['description', 'desc', 'شرح', 'توضیحات'], weight: 15 },
      { keys: ['category', 'group', 'دسته'], weight: 10 },
    ];

    for (const check of checks) {
      const match = Object.entries(data).find(
        ([k, v]) => check.keys.some((cKey) => k.toLowerCase().includes(cKey)) &&
          v !== null && v !== undefined && String(v).trim().length > 0
      );
      if (match) {
        score += check.weight;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Generates a deterministic content fingerprint to detect duplicate records.
   */
  static generateFingerprint(data: Record<string, any>): string {
    const primaryKeys = ['title', 'name', 'product_name', 'sku', 'code', 'product_code', 'url', 'source_url'];
    const parts: string[] = [];

    for (const key of primaryKeys) {
      const found = Object.entries(data).find(([k]) => k.toLowerCase() === key);
      if (found && found[1]) {
        parts.push(this.normalizeText(String(found[1])));
      }
    }

    if (parts.length > 0) {
      return parts.join('|').toLowerCase();
    }

    // Fallback: use sorted keys and values
    const sorted = Object.entries(data)
      .filter(([_, v]) => typeof v === 'string' || typeof v === 'number')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${this.normalizeText(String(v))}`)
      .join(';');

    return sorted.toLowerCase();
  }

  /**
   * Full record normalization pipeline preserving raw data.
   */
  static normalizeRecord(rawRecord: Record<string, any>): NormalizedResult {
    const normalized: Record<string, any> = {};

    for (const [key, val] of Object.entries(rawRecord)) {
      if (typeof val === 'string') {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('price') || lowerKey.includes('قیمت')) {
          normalized[key] = this.parsePrice(val);
        } else if (lowerKey.includes('code') || lowerKey.includes('sku') || lowerKey.includes('کد')) {
          normalized[key] = this.normalizeProductCode(val);
        } else {
          normalized[key] = this.normalizeText(val);
        }
      } else {
        normalized[key] = val;
      }
    }

    const completenessScore = this.calculateCompletenessScore(normalized);
    const fingerprint = this.generateFingerprint(normalized);

    return {
      raw: rawRecord,
      normalized,
      completenessScore,
      fingerprint,
    };
  }
}
