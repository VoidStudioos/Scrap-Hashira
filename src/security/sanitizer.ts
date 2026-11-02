// Hashira Scraper Security & Sanitizer Utilities

export class SecuritySanitizer {
  /**
   * Prevents CSV/Excel formula injection (DDE attacks).
   * Any cell starting with =, +, -, @, tab, or carriage return is escaped.
   */
  static sanitizeForSpreadsheet(val: any): string {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (!str) return '';

    const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
    if (dangerousChars.includes(str[0])) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Sanitizes filenames to be safe across Windows, macOS, and Linux file systems.
   * Strips reserved characters, control characters, and truncates length.
   */
  static sanitizeFilename(filename: string, fallback: string = 'file'): string {
    if (!filename) return fallback;

    // Replace reserved characters in Windows/Linux: < > : " / \ | ? *
    let clean = filename
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_')
      .trim();

    // Prevent filenames consisting only of dots
    clean = clean.replace(/^\.+/, '');

    // Max 120 chars to avoid OS path length limits
    if (clean.length > 120) {
      const extMatch = clean.match(/(\.[a-zA-Z0-9]{2,6})$/);
      const ext = extMatch ? extMatch[1] : '';
      clean = clean.substring(0, 120 - ext.length) + ext;
    }

    return clean || fallback;
  }

  /**
   * Strips dangerous tags like <script>, <style>, <iframe>, <object>, <embed>, <form> from HTML
   * for safe inline preview rendering.
   */
  static sanitizeHtmlPreview(dirtyHtml: string): string {
    if (!dirtyHtml) return '';
    return dirtyHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/javascript:[^"']*/gi, '');
  }

  /**
   * Validates if a URL is a valid http/https URL.
   */
  static isValidWebUrl(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
