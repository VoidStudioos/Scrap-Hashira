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
   * Decodes all HTML entities (named, decimal, hex)
   */
  static decodeHtmlEntities(text: string): string {
    if (!text) return '';
    return text
      // Named entities
      .replace(/&nbsp;/gi, ' ')
      .replace(/&zwnj;/gi, '\u200c')
      .replace(/&zwj;/gi, '\u200d')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&diams;/gi, '♦')
      .replace(/&bull;/gi, '•')
      .replace(/&hellip;/gi, '…')
      .replace(/&ndash;/gi, '–')
      .replace(/&mdash;/gi, '—')
      .replace(/&laquo;/gi, '«')
      .replace(/&raquo;/gi, '»')
      .replace(/&copy;/gi, '©')
      .replace(/&reg;/gi, '®')
      .replace(/&trade;/gi, '™')
      // Numeric decimal entities (e.g. &#1606;)
      .replace(/&#(\d+);/g, (_, dec) => {
        try {
          return String.fromCharCode(parseInt(dec, 10));
        } catch {
          return _;
        }
      })
      // Numeric hex entities (e.g. &#x0646;)
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        try {
          return String.fromCharCode(parseInt(hex, 16));
        } catch {
          return _;
        }
      });
  }

  /**
   * Intelligently extracts readable, formatted text from raw HTML:
   * - Eliminates word fusing caused by unclosed tags or adjacent block elements
   * - Strips scripts, styles, noscript, and SVG tags
   * - Treats block elements (p, div, li, h1-h6, tr, td, br, etc.) as clean linebreaks
   * - Decodes all HTML entities
   * - Normalizes Persian / Arabic characters and ZWNJ
   */
  static cleanHtmlToText(rawHtml: string): string {
    if (!rawHtml) return '';

    let html = rawHtml;

    // 1. Remove script, style, noscript, svg blocks entirely
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    html = html.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
    html = html.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

    // 2. Convert explicit break tags to newline
    html = html.replace(/<br\s*\/?>/gi, '\n');

    // 3. Convert block level elements (opening or closing) to newline
    // Handles unclosed <p>, <div>, <li>, <h3>, <tr>, <td>, etc. without fusing words
    html = html.replace(/<\/?(?:p|div|section|article|main|header|footer|h[1-6]|li|tr|th|td|blockquote|hr)\b[^>]*>/gi, '\n');

    // 4. Strip any remaining inline tags (span, strong, em, a, b, i) by replacing with space
    // to ensure adjacent inline words never get glued together
    html = html.replace(/<[^>]+>/g, ' ');

    // 5. Decode all HTML entities
    html = this.decodeHtmlEntities(html);

    // 6. Normalize Persian/Arabic characters
    html = html
      .replace(/\u0643/g, '\u06a9') // Arabic Kaf -> Persian Kaf
      .replace(/[\u0649\u064a]/g, '\u06cc') // Arabic Yeh -> Persian Yeh
      .replace(/\u200c{2,}/g, '\u200c'); // Collapse multiple ZWNJ into one

    // 7. Clean up spaces around newlines and collapse multiple blank lines
    const lines = html
      .split(/\r?\n/)
      .map((line) => {
        return line
          .replace(/[ \t\u00a0\u200b]+/g, ' ')
          .replace(/^[ \t]+|[ \t]+$/g, '');
      })
      .filter((line) => line.length > 0);

    return lines.join('\n');
  }

  /**
   * Normalizes Persian and Arabic text:
   * - Arabic Kaf (ك) -> Persian Kaf (ک)
   * - Arabic Yeh (ي, ى) -> Persian Yeh (ی)
   * - Persian/Arabic numbers to ASCII numbers
   * - Preserves ZWNJ (\u200c) for Persian words like 'می‌شود', 'نرم‌افزار'
   * - Decodes HTML entities
   * - Preserves linebreaks if preserveLines is true
   */
  static normalizeText(text: string, options?: { preserveLines?: boolean }): string {
    if (!text) return '';

    // Decode entities first if present
    let res = this.decodeHtmlEntities(text)
      // Replace Arabic kaf
      .replace(/\u0643/g, '\u06a9')
      // Replace Arabic yeh
      .replace(/[\u0649\u064a]/g, '\u06cc')
      // Normalize Persian numbers and Arabic numbers to Latin digits
      .replace(/[۰-۹٠-٩]/g, (char) => this.DIGIT_MAP[char] || char)
      // Collapse multiple ZWNJ into one
      .replace(/\u200c{2,}/g, '\u200c')
      // Remove ZWNJ at boundary of whitespace or punctuation
      .replace(/[\s\u00a0\u200b]\u200c|\u200c[\s\u00a0\u200b]/g, ' ');

    if (options?.preserveLines) {
      const lines = res
        .split(/\r?\n/)
        .map((line) => line.replace(/[ \t\u00a0\u200b]+/g, ' ').trim())
        .filter((line) => line.length > 0);
      return lines.join('\n');
    }

    // Collapse all whitespace into single space
    return res.replace(/[\s\u00a0\u200b]+/g, ' ').trim();
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
   * Normalizes product codes/SKUs without deleting Persian alphanumeric characters.
   */
  static normalizeProductCode(code: string): string {
    if (!code) return '';
    const norm = this.normalizeText(code);
    // Keep Latin, Persian, digits, hyphens, slashes, underscores
    return norm.replace(/[^\u0600-\u06FFa-zA-Z0-9\-_/]/g, '').trim().toUpperCase();
  }

  /**
   * Calculates record completeness score from 0 to 100 based on standard e-commerce fields.
   */
  static calculateCompletenessScore(data: Record<string, any>): number {
    let score = 0;
    const checks: { keys: string[]; weight: number }[] = [
      { keys: ['title', 'name', 'product_name', 'عنوان'], weight: 35 },
      { keys: ['price', 'cost', 'amount', 'قیمت'], weight: 25 },
      { keys: ['product_code', 'sku', 'code', 'کد'], weight: 15 },
      { keys: ['description', 'desc', 'شرح', 'توضیحات', 'مشخصات'], weight: 15 },
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
    const primaryKeys = ['title', 'name', 'product_name', 'عنوان', 'sku', 'code', 'product_code', 'url', 'source_url'];
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
        } else if (
          lowerKey.includes('desc') ||
          lowerKey.includes('مشخصات') ||
          lowerKey.includes('توضیحات') ||
          lowerKey.includes('ویژگی')
        ) {
          // Multiline description / specifications
          normalized[key] = this.normalizeText(val, { preserveLines: true });
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
